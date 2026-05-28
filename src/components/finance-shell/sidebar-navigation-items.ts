import type { UserRecord } from "./types";

export type PrimaryNavKey = "home" | "dashboard" | "checking" | "investment" | "crypto";
export type ActionNavKey = PrimaryNavKey | "binance" | "settings" | "profile";

export function getPrimaryNavigationKeys(activeUser: UserRecord | null): PrimaryNavKey[] {
  const keys: PrimaryNavKey[] = ["home"];

  if (!activeUser) {
    return keys;
  }

  keys.push("dashboard");

  if (activeUser.checkingCount > 0) keys.push("checking");
  if (activeUser.investmentCount > 0) keys.push("investment");
  if (activeUser.cryptoCount > 0) keys.push("crypto");

  return keys;
}

export function getActionNavigationKeys({
  activeUser,
  binanceFading,
  hasUsers
}: {
  activeUser: UserRecord | null;
  binanceFading: boolean;
  hasUsers: boolean;
}): ActionNavKey[] {
  const keys: ActionNavKey[] = getPrimaryNavigationKeys(activeUser);

  if (activeUser && (activeUser.hasBinanceCredentials || binanceFading)) {
    keys.push("binance");
  }

  if (activeUser) {
    keys.push("settings");
  }

  if (hasUsers) {
    keys.push("profile");
  }

  return keys;
}
