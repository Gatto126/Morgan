export function getDashboardTopbarValueTextClass(value: string) {
  const compactLength = value.replace(/\s/g, "").length;

  if (compactLength >= 13) return "text-[9.5px] tracking-normal";
  if (compactLength >= 10) return "text-[10px] tracking-normal";
  return "text-[11px] tracking-[0.01em]";
}
