const topbarAmountFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true
});

function formatTopbarAmount(amount: string) {
  const normalized = amount.trim().replace(/\u2212/g, "-");
  if (normalized === "") {
    return "";
  }

  const numericText = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  const value = Number(numericText);

  if (!Number.isFinite(value)) {
    return normalized;
  }

  return topbarAmountFormatter.format(value);
}

export function getDashboardTopbarValueParts(value: string) {
  const normalized = value.trim().replace(/\u00a0/g, " ");
  if (normalized === "") {
    return { amount: "", currency: "" };
  }

  const match = normalized.match(/^(.*?)[\s]*([^\d\s.,+-]+)$/);

  if (!match) {
    return { amount: formatTopbarAmount(normalized), currency: "" };
  }

  return {
    amount: formatTopbarAmount(match[1]),
    currency: match[2].trim()
  };
}

export function getDashboardTopbarIdentityTextClass(label: string) {
  const compactLength = label.replace(/\s/g, "").length;

  if (compactLength >= 8) return "text-[8px] tracking-normal";
  if (compactLength >= 6) return "text-[9px] tracking-normal";
  if (compactLength >= 4) return "text-[11px] tracking-[0.03em]";
  return "text-[12px] tracking-[0.06em]";
}

export function getDashboardTopbarValueTextClass(value: string) {
  const { amount } = getDashboardTopbarValueParts(value);
  const compactLength = amount.replace(/\s/g, "").length;

  if (compactLength >= 12) return "text-[12px] tracking-normal";
  if (compactLength >= 9) return "text-[14px] tracking-normal";
  return "text-[15px] tracking-normal";
}
