import type { AccountTab, TimeRange } from "./types";

export const ACCOUNT_TABS: { key: AccountTab; label: string }[] = [
  { key: "heritage", label: "HERITAGE" },
  { key: "checking", label: "CHECKING" },
  { key: "investment", label: "INVESTMENT" },
  { key: "crypto", label: "CRYPTO" }
];

export const TIME_RANGES: TimeRange[] = ["ALL", "1Y", "6M", "3M", "1M", "1W"];

export const GRAYSCALE_PALETTE = ["#a3a3a3", "#737373", "#525252", "#d4d4d4", "#a8a29e", "#78716c", "#57534e"];
