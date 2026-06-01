export function areLivePriceKeysSettled(
  keys: string[],
  livePrices: Record<string, number | null>
) {
  if (keys.length === 0) {
    return true;
  }

  return keys.every((key) => Object.hasOwn(livePrices, key));
}
