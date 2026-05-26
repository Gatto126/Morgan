import { NextRequest, NextResponse } from "next/server";
import { authGuardResponse, requireOwnedProfile } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { BBVA_INSTITUTION } from "@/lib/institutions";
import { apiLogger } from "@/lib/logger";

const log = apiLogger("Checking");

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    log.request("GET", "/api/transactions/checking", { userId });

    if (!userId) {
      log.response("GET", "/api/transactions/checking", 400, { error: "userId mancante" });
      return NextResponse.json({ error: "userId richiesto." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);

    const transactions = await prisma.checkingTransaction.findMany({
      where: { userId },
      orderBy: { bookingDate: "desc" },
      select: {
        id: true,
        sourceInstitution: true,
        bookingDate: true,
        typeLabel: true,
        description: true,
        direction: true,
        amountCents: true,
        balanceCents: true
      }
    });

    type CheckingProviderSummary = {
      sourceInstitution: string;
      total: number;
      income: number;
      expenses: number;
      interest: number;
      cashback: number;
      tax: number;
      transactions: any[];
    };

    const providerMap = new Map<string, CheckingProviderSummary>();

    function getProvider(source: string): CheckingProviderSummary {
      if (!providerMap.has(source)) {
        providerMap.set(source, {
          sourceInstitution: source,
          total: 0,
          income: 0,
          expenses: 0,
          interest: 0,
          cashback: 0,
          tax: 0,
          transactions: []
        });
      }
      return providerMap.get(source)!;
    }

    const ascendingTransactions = [...transactions].reverse();
    const providerBalances = new Map<string, number>();
    const bbvaAcc = { income: 0, expenses: 0, interest: 0, cashback: 0 };

    // Maps to track period-specific totals
    const monthlyIncomeTotals = new Map<string, Record<string, number>>();
    const monthlyExpenseTotals = new Map<string, Record<string, number>>();
    const dailyIncomeTotals = new Map<string, Record<string, number>>();
    const dailyExpenseTotals = new Map<string, Record<string, number>>();

    type MonthBucket = {
      month: string;
      total: number;
      providers: Record<string, number>;
      providerIncome: Record<string, number>;
      providerExpenses: Record<string, number>;
    };

    const monthlyMap = new Map<string, MonthBucket>();
    const dailyMap = new Map<string, any>();

    function getCheckingSnapshot(monthKey: string, dayKey: string) {
      let total = 0;
      const providers: Record<string, number> = {};
      
      const mInc = monthlyIncomeTotals.get(monthKey) || {};
      const mExp = monthlyExpenseTotals.get(monthKey) || {};
      const dInc = dailyIncomeTotals.get(dayKey) || {};
      const dExp = dailyExpenseTotals.get(dayKey) || {};

      for (const [source, bal] of providerBalances.entries()) {
        total += bal;
        providers[source] = bal;
      }

      return { total, providers, mInc, mExp, dInc, dExp };
    }

    for (const tx of ascendingTransactions) {
      const loweredDesc = tx.description.toLowerCase();
      const date = new Date(tx.bookingDate);
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const dayKey = date.toISOString().split('T')[0];

      let isIncome = false;
      let isExpense = false;

      if (tx.sourceInstitution === BBVA_INSTITUTION) {
        if (
          loweredDesc.includes("interest payment") ||
          tx.typeLabel.toLowerCase() === "interessi" ||
          tx.typeLabel.toLowerCase() === "liquidazione interessi-commissioni-spese"
        ) {
          bbvaAcc.interest += tx.amountCents;
          isIncome = true;
        } else if (
          loweredDesc.includes("saveback payment") ||
          loweredDesc.includes("cash reward") ||
          tx.typeLabel.toLowerCase() === "premio" ||
          tx.typeLabel.toLowerCase() === "cashback promozione commerciale"
        ) {
          bbvaAcc.cashback += tx.amountCents;
          isIncome = true;
        } else if (tx.direction === "IN") {
          bbvaAcc.income += tx.amountCents;
          isIncome = true;
        } else {
          bbvaAcc.expenses += tx.amountCents;
          isExpense = true;
        }
        const bal = bbvaAcc.income + bbvaAcc.interest + bbvaAcc.cashback - bbvaAcc.expenses;
        providerBalances.set(tx.sourceInstitution, bal);
      } else {
        providerBalances.set(tx.sourceInstitution, tx.balanceCents);
        if (tx.direction === "IN") isIncome = true;
        else isExpense = true;
      }

      // Update period totals
      if (isIncome) {
        const m = monthlyIncomeTotals.get(monthKey) || {};
        m[tx.sourceInstitution] = (m[tx.sourceInstitution] || 0) + tx.amountCents;
        monthlyIncomeTotals.set(monthKey, m);

        const d = dailyIncomeTotals.get(dayKey) || {};
        d[tx.sourceInstitution] = (d[tx.sourceInstitution] || 0) + tx.amountCents;
        dailyIncomeTotals.set(dayKey, d);
      }
      if (isExpense) {
        const m = monthlyExpenseTotals.get(monthKey) || {};
        m[tx.sourceInstitution] = (m[tx.sourceInstitution] || 0) + tx.amountCents;
        monthlyExpenseTotals.set(monthKey, m);

        const d = dailyExpenseTotals.get(dayKey) || {};
        d[tx.sourceInstitution] = (d[tx.sourceInstitution] || 0) + tx.amountCents;
        dailyExpenseTotals.set(dayKey, d);
      }

      const snapshot = getCheckingSnapshot(monthKey, dayKey);
      monthlyMap.set(monthKey, { 
        month: monthKey, 
        total: snapshot.total, 
        providers: snapshot.providers,
        providerIncome: snapshot.mInc,
        providerExpenses: snapshot.mExp 
      });
      dailyMap.set(dayKey, { 
        date: dayKey, 
        total: snapshot.total, 
        providers: snapshot.providers,
        providerIncome: snapshot.dInc,
        providerExpenses: snapshot.dExp 
      });
    }

    for (const tx of transactions) {
      const provider = getProvider(tx.sourceInstitution);
      provider.transactions.push({
        id: tx.id,
        bookingDate: tx.bookingDate,
        typeLabel: tx.typeLabel,
        description: tx.description,
        direction: tx.direction,
        amountCents: tx.amountCents,
      });

      const loweredDesc = tx.description.toLowerCase();
      if (
        loweredDesc.includes("interest payment") ||
        tx.typeLabel.toLowerCase() === "interessi" ||
        tx.typeLabel.toLowerCase() === "liquidazione interessi-commissioni-spese"
      ) {
        provider.interest += tx.amountCents;
      } else if (
        loweredDesc.includes("saveback payment") ||
        loweredDesc.includes("cash reward") ||
        tx.typeLabel.toLowerCase() === "premio" ||
        tx.typeLabel.toLowerCase() === "cashback promozione commerciale"
      ) {
        provider.cashback += tx.amountCents;
      } else if (tx.typeLabel.toLowerCase().includes("tax")) {
        provider.tax += tx.amountCents;
      } else if (tx.direction === "IN") {
        provider.income += tx.amountCents;
      } else {
        provider.expenses += tx.amountCents;
      }

      if (tx.sourceInstitution === BBVA_INSTITUTION) {
         provider.total = provider.income + provider.interest + provider.cashback - provider.expenses;
      } else if (provider.total === 0 || tx.balanceCents > 0) {
         if (provider.transactions.length === 1) {
           provider.total = tx.balanceCents;
         }
      }
    }

    const filledMonthlyData: MonthBucket[] = [];
    const monthlyDataRaw = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month));
    const filledDailyData: any[] = [];
    
    if (ascendingTransactions.length > 0) {
      const firstTxDate = new Date(ascendingTransactions[0].bookingDate);
      const start = new Date(Date.UTC(firstTxDate.getUTCFullYear(), firstTxDate.getUTCMonth(), firstTxDate.getUTCDate()));
      const now = new Date();
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      
      let lastBucket = monthlyDataRaw[0];
      let currentRunningDay = {
        date: "",
        month: "",
        total: 0,
        providers: {},
        providerIncome: {},
        providerExpenses: {}
      };
      const current = new Date(start);
      
      while (current <= end) {
        const curMonthKey = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}`;
        const curDayKey = current.toISOString().split('T')[0];
        
        const existingMonth = monthlyMap.get(curMonthKey);
        if (existingMonth) {
          lastBucket = existingMonth;
        } else {
          lastBucket = { 
            ...lastBucket, 
            month: curMonthKey,
            providerIncome: {},
            providerExpenses: {}
          };
        }

        if (current.getUTCDate() === 1 || current.getTime() === end.getTime()) {
           if (filledMonthlyData.length === 0 || filledMonthlyData[filledMonthlyData.length - 1].month !== curMonthKey) {
             filledMonthlyData.push({ ...lastBucket });
           } else {
             filledMonthlyData[filledMonthlyData.length - 1] = { ...lastBucket };
           }
        }

        const existingDay = dailyMap.get(curDayKey);
        if (existingDay) {
           currentRunningDay = {
             ...existingDay,
             month: curMonthKey
           };
        } else {
           currentRunningDay = { 
             ...currentRunningDay, 
             date: curDayKey,
             month: curMonthKey,
             providerIncome: {},
             providerExpenses: {}
           };
        }
        filledDailyData.push({ ...currentRunningDay });

        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    log.response("GET", "/api/transactions/checking", 200, {
      providers: providerMap.size,
      transactions: transactions.length,
      monthlyPoints: filledMonthlyData.length,
      dailyPoints: filledDailyData.length
    });

    return NextResponse.json({
      monthlyData: filledMonthlyData,
      dailyData: filledDailyData,
      providers: [...providerMap.values()].sort((a, b) => a.sourceInstitution.localeCompare(b.sourceInstitution)) 
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/transactions/checking", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore durante il caricamento." },
      { status: 500 }
    );
  }
}
