const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2
});

export function formatEuroCents(cents: number) {
  return euroFormatter.format(cents / 100);
}

export function formatSignedEuroCents(cents: number, direction: "IN" | "OUT") {
  if (cents === 0) {
    return formatEuroCents(cents);
  }
  const sign = direction === "IN" ? "+" : "-";
  return `${sign}${formatEuroCents(cents)}`;
}

export function formatProviderLabel(source: string) {
  return source.replace(/_/g, " ").toUpperCase();
}

export function getAbbreviatedLabel(label: string) {
  const upper = label.trim().toUpperCase();
  if (upper === "TRADE REPUBLIC") return "TR";
  if (upper === "REVOLUT") return "REV";
  if (upper === "BINANCE") return "BIN";
  if (upper === "COINBASE") return "CB";
  if (upper === "BBVA") return "BBVA";

  const words = upper.split(/\s+/);
  if (words.length > 1) {
    return words.map(word => word[0]).join("");
  }
  return upper.length > 4 ? upper.slice(0, 3) : upper;
}

export function getMonthLabel(month: string) {
  const [year, m] = month.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const shortYear = year.slice(2);
  return `${monthNames[Number.parseInt(m, 10) - 1]} ${shortYear}`;
}
