export const BINANCE_MATERIAL_VALUE_THRESHOLD_EUR = 0.49;

export function isMaterialBinanceEurValue(value: number | null | undefined) {
  return typeof value === "number"
    && Number.isFinite(value)
    && value > BINANCE_MATERIAL_VALUE_THRESHOLD_EUR;
}
