export function hasDeletableBinanceSettings({
  hasBinanceData,
  isApiKeySaved
}: {
  hasBinanceData: boolean;
  isApiKeySaved: boolean;
}) {
  return isApiKeySaved || hasBinanceData;
}
