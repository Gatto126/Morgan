export const TRANSACTION_IMPORT_FILE_ACCEPT = [
  ".csv",
  "text/csv",
  ".xlsx",
  ".excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
].join(",");

type FilePickerNavigator = Pick<Navigator, "maxTouchPoints" | "platform" | "userAgent">;

export function usesAppleMobileFilePicker(navigatorLike: FilePickerNavigator | null | undefined) {
  if (!navigatorLike) return false;

  const userAgent = navigatorLike.userAgent ?? "";
  const platform = navigatorLike.platform ?? "";
  const maxTouchPoints = navigatorLike.maxTouchPoints ?? 0;

  return /\b(iPhone|iPad|iPod)\b/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export function getTransactionImportFileAccept(navigatorLike?: FilePickerNavigator | null) {
  if (navigatorLike === null) return undefined;

  const currentNavigator = navigatorLike ?? (typeof window === "undefined" ? null : window.navigator);
  if (!currentNavigator) return undefined;

  return usesAppleMobileFilePicker(currentNavigator) ? undefined : TRANSACTION_IMPORT_FILE_ACCEPT;
}
