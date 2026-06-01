export function areLivePriceKeysSettled(
  keys: string[],
  livePrices: Record<string, number | null>
) {
  if (keys.length === 0) {
    return true;
  }

  return keys.every((key) => Object.hasOwn(livePrices, key));
}

export function areLivePriceKeysValued(
  keys: string[],
  livePrices: Record<string, number | null>
) {
  if (keys.length === 0) {
    return true;
  }

  return keys.every((key) => {
    const price = livePrices[key];
    return typeof price === "number" && Number.isFinite(price) && price > 0;
  });
}
