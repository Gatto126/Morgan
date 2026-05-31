export type PortfolioTransaction = {
  id: string;
  sourceInstitution: string;
  bookingDate: Date;
  typeLabel: string;
  description: string;
  direction: string;
  amountCents: number;
  tradeType: string | null;
  productName: string | null;
  isin: string | null;
  quantityUnits: number | null;
};

export type PortfolioHistoryPrice = {
  isin: string;
  date: string;
  value: number;
};

export type PortfolioProductSummary = {
  productName: string;
  quantity: number;
  investedValue: number;
  cashback: number;
  isin: string | null;
};

export type PortfolioProviderSummary = {
  sourceInstitution: string;
  total: number;
  income: number;
  expenses: number;
  interest: number;
  cashback: number;
  tax: number;
  transactionCount?: number;
  transactions: {
    id: string;
    bookingDate: Date;
    typeLabel: string;
    description: string;
    direction: string;
    amountCents: number;
    tradeType: string | null;
    productName: string | null;
    isin: string | null;
  }[];
  products: PortfolioProductSummary[];
};

export type PortfolioMonthBucket = {
  month: string;
  total: number;
  providers: Record<string, number>;
  providerProducts: Record<string, Record<string, number>>;
};

export type PortfolioDailyBucket = PortfolioMonthBucket & {
  date: string;
};

type ProductPosition = {
  quantity: number;
  investedValue: number;
  isin: string | null;
};

type PortfolioSnapshot = {
  total: number;
  providers: Record<string, number>;
  providerProducts: Record<string, Record<string, number>>;
};

type BuildPortfolioTimeSeriesOptions = {
  includeProviderTransactions?: boolean;
  transactions: PortfolioTransaction[];
  historyPrices: PortfolioHistoryPrice[];
  priceKeys: string[];
  now?: Date;
};

export function getPortfolioPriceKeys(
  transactions: Array<Pick<PortfolioTransaction, "isin">>,
  isSupportedKey: (key: string) => boolean = Boolean
) {
  return Array.from(
    new Set(
      transactions
        .map((transaction) => transaction.isin)
        .filter((key): key is string => !!key && isSupportedKey(key))
    )
  );
}

function toDayKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function toMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function cloneProviderProducts(providerProducts: Record<string, Record<string, number>>) {
  return Object.fromEntries(
    Object.entries(providerProducts).map(([source, products]) => [source, { ...products }])
  );
}

function getOrCreateProvider(
  providerMap: Map<string, PortfolioProviderSummary>,
  sourceInstitution: string
) {
  let provider = providerMap.get(sourceInstitution);
  if (!provider) {
    provider = {
      sourceInstitution,
      total: 0,
      income: 0,
      expenses: 0,
      interest: 0,
      cashback: 0,
      tax: 0,
      transactions: [],
      products: []
    };
    providerMap.set(sourceInstitution, provider);
  }

  return provider;
}

function applyProviderFlow(provider: PortfolioProviderSummary, transaction: PortfolioTransaction) {
  const loweredDescription = transaction.description.toLowerCase();
  const loweredType = transaction.typeLabel.toLowerCase();

  if (
    loweredDescription.includes("interest payment") ||
    loweredType === "interessi" ||
    loweredType === "liquidazione interessi-commissioni-spese"
  ) {
    provider.interest += transaction.amountCents;
  } else if (
    loweredDescription.includes("saveback payment") ||
    loweredDescription.includes("cash reward") ||
    loweredType === "premio" ||
    loweredType === "cashback promozione commerciale"
  ) {
    provider.cashback += transaction.amountCents;
  } else if (loweredType.includes("tax") || loweredType === "imposta" || loweredType === "ritenuta") {
    provider.tax += transaction.amountCents;
  } else if (transaction.direction === "IN") {
    provider.income += transaction.amountCents;
  } else {
    provider.expenses += transaction.amountCents;
  }
}

function buildPriceMaps(historyPrices: PortfolioHistoryPrice[]) {
  const priceMap = new Map<string, Map<string, number>>();
  for (const historyPrice of historyPrices) {
    let pricesByDate = priceMap.get(historyPrice.isin);
    if (!pricesByDate) {
      pricesByDate = new Map();
      priceMap.set(historyPrice.isin, pricesByDate);
    }
    pricesByDate.set(historyPrice.date, historyPrice.value);
  }

  const firstAvailablePrice = new Map<string, number>();
  for (const [isin, dates] of priceMap.entries()) {
    const sortedDates = Array.from(dates.keys()).sort();
    if (sortedDates.length > 0) {
      firstAvailablePrice.set(isin, dates.get(sortedDates[0])!);
    }
  }

  return { priceMap, firstAvailablePrice };
}

function updateProductPositions(
  productStatus: Map<string, Map<string, ProductPosition>>,
  transactions: PortfolioTransaction[]
) {
  for (const transaction of transactions) {
    const productKey = transaction.productName ?? transaction.description;
    let providerProducts = productStatus.get(transaction.sourceInstitution);
    if (!providerProducts) {
      providerProducts = new Map();
      productStatus.set(transaction.sourceInstitution, providerProducts);
    }

    let product = providerProducts.get(productKey);
    if (!product) {
      product = { quantity: 0, investedValue: 0, isin: transaction.isin };
      providerProducts.set(productKey, product);
    } else if (transaction.isin && !product.isin) {
      product.isin = transaction.isin;
    }

    const quantity = transaction.quantityUnits ?? 0;
    if (transaction.direction === "IN") {
      product.quantity -= quantity;
      product.investedValue -= transaction.amountCents;
    } else {
      product.quantity += quantity;
      product.investedValue += transaction.amountCents;
    }
  }
}

function calculateSnapshot(
  productStatus: Map<string, Map<string, ProductPosition>>,
  lastKnownPrice: Map<string, number>,
  firstAvailablePrice: Map<string, number>
) {
  let total = 0;
  const providers: Record<string, number> = {};
  const providerProducts: Record<string, Record<string, number>> = {};

  for (const [source, products] of productStatus.entries()) {
    let providerTotal = 0;
    const productsForProvider: Record<string, number> = {};
    for (const [productName, product] of products.entries()) {
      if (product.quantity <= 0.000001) {
        continue;
      }

      let value = product.investedValue;
      if (product.isin) {
        const price = lastKnownPrice.get(product.isin) ?? firstAvailablePrice.get(product.isin);
        if (price !== undefined) {
          value = Math.round(product.quantity * price * 100);
        }
      }

      providerTotal += value;
      productsForProvider[productName] = value;
    }
    total += providerTotal;
    providers[source] = providerTotal;
    providerProducts[source] = productsForProvider;
  }

  return {
    total,
    providers,
    providerProducts
  };
}

export function buildPortfolioTimeSeries({
  includeProviderTransactions = true,
  transactions,
  historyPrices,
  priceKeys,
  now = new Date()
}: BuildPortfolioTimeSeriesOptions) {
  const ascendingTransactions = [...transactions].sort(
    (left, right) => left.bookingDate.getTime() - right.bookingDate.getTime()
  );
  const transactionsByDay = new Map<string, PortfolioTransaction[]>();
  for (const transaction of ascendingTransactions) {
    const dayKey = toDayKey(transaction.bookingDate);
    const dayTransactions = transactionsByDay.get(dayKey) ?? [];
    dayTransactions.push(transaction);
    transactionsByDay.set(dayKey, dayTransactions);
  }

  const startOfDefaultRange = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
  const start = ascendingTransactions.length > 0
    ? new Date(
        Date.UTC(
          ascendingTransactions[0].bookingDate.getUTCFullYear(),
          ascendingTransactions[0].bookingDate.getUTCMonth(),
          ascendingTransactions[0].bookingDate.getUTCDate()
        )
      )
    : startOfDefaultRange;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const providerMap = new Map<string, PortfolioProviderSummary>();
  for (const transaction of transactions) {
    const provider = getOrCreateProvider(providerMap, transaction.sourceInstitution);
    provider.transactionCount = (provider.transactionCount ?? 0) + 1;

    if (includeProviderTransactions) {
      provider.transactions.push({
        id: transaction.id,
        bookingDate: transaction.bookingDate,
        typeLabel: transaction.typeLabel,
        description: transaction.description,
        direction: transaction.direction,
        amountCents: transaction.amountCents,
        tradeType: transaction.tradeType,
        productName: transaction.productName,
        isin: transaction.isin
      });
    }
    applyProviderFlow(provider, transaction);
  }

  const { priceMap, firstAvailablePrice } = buildPriceMaps(historyPrices);
  const productStatus = new Map<string, Map<string, ProductPosition>>();
  const lastKnownPrice = new Map<string, number>();
  const monthlyData: PortfolioMonthBucket[] = [];
  const dailyData: PortfolioDailyBucket[] = [];
  let lastSnapshot: PortfolioSnapshot | null = null;

  const current = new Date(start);
  while (current <= end) {
    const currentMonthKey = toMonthKey(current);
    const currentDayKey = toDayKey(current);
    const dayTransactions = transactionsByDay.get(currentDayKey);

    if (dayTransactions) {
      updateProductPositions(productStatus, dayTransactions);
    }

    let pricesChanged = false;
    for (const priceKey of priceKeys) {
      if (priceMap.get(priceKey)?.has(currentDayKey)) {
        pricesChanged = true;
        break;
      }
    }

    let snapshot: PortfolioSnapshot;
    if (!lastSnapshot || dayTransactions || pricesChanged) {
      for (const priceKey of priceKeys) {
        const dayPrice = priceMap.get(priceKey)?.get(currentDayKey);
        if (dayPrice !== undefined) {
          lastKnownPrice.set(priceKey, dayPrice);
        }
      }

      snapshot = calculateSnapshot(productStatus, lastKnownPrice, firstAvailablePrice);
      lastSnapshot = {
        total: snapshot.total,
        providers: { ...snapshot.providers },
        providerProducts: cloneProviderProducts(snapshot.providerProducts)
      };
    } else {
      snapshot = lastSnapshot;
    }

    dailyData.push({
      date: currentDayKey,
      month: currentMonthKey,
      total: snapshot.total,
      providers: snapshot.providers,
      providerProducts: snapshot.providerProducts
    });

    if (current.getUTCDate() === 1 || current.getTime() === end.getTime()) {
      const monthlySnapshot = {
        month: currentMonthKey,
        total: snapshot.total,
        providers: snapshot.providers,
        providerProducts: snapshot.providerProducts
      };

      if (monthlyData.length === 0 || monthlyData[monthlyData.length - 1].month !== currentMonthKey) {
        monthlyData.push(monthlySnapshot);
      } else {
        monthlyData[monthlyData.length - 1] = monthlySnapshot;
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  for (const [source, products] of productStatus.entries()) {
    const provider = getOrCreateProvider(providerMap, source);
    for (const [productName, product] of products.entries()) {
      provider.products.push({
        productName,
        quantity: product.quantity,
        investedValue: product.investedValue,
        cashback: 0,
        isin: product.isin
      });
    }

    let finalProviderTotal = 0;
    for (const product of products.values()) {
      if (product.quantity <= 0.000001) {
        continue;
      }

      let value = product.investedValue;
      if (product.isin) {
        const price = lastKnownPrice.get(product.isin) ?? firstAvailablePrice.get(product.isin);
        if (price !== undefined) {
          value = Math.round(product.quantity * price * 100);
        }
      }
      finalProviderTotal += value;
    }
    provider.total = finalProviderTotal;
  }

  return {
    monthlyData,
    dailyData,
    providers: [...providerMap.values()].sort((left, right) =>
      left.sourceInstitution.localeCompare(right.sourceInstitution)
    )
  };
}
