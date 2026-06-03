export function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getEuropeRomeDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric"
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));

  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function getMillisecondsUntilNextUtcDate(date = new Date()) {
  const nextDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1
  ));

  return Math.max(0, nextDate.getTime() - date.getTime());
}
