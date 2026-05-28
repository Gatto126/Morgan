export const TRADE_REPUBLIC_INSTITUTION = "trade_republic" as const;
export const BBVA_INSTITUTION = "bbva" as const;

export const SOURCE_INSTITUTIONS = [TRADE_REPUBLIC_INSTITUTION, BBVA_INSTITUTION] as const;

export type SourceInstitution = (typeof SOURCE_INSTITUTIONS)[number];
