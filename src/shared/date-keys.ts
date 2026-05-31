export function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getMillisecondsUntilNextUtcDate(date = new Date()) {
  const nextDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1
  ));

  return Math.max(0, nextDate.getTime() - date.getTime());
}
