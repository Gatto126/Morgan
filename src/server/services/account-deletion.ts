import { verifyPassword } from "better-auth/crypto";

import { hasLocalPasswordInput } from "@/domain/auth/local-auth";
import {
  accountDeletionRepository,
  type AccountDeletionRepository
} from "@/server/repositories/account-deletion-repository";

export class AccountDeleteValidationError extends Error {
  constructor(
    public status: 400 | 422,
    message: string
  ) {
    super(message);
    this.name = "AccountDeleteValidationError";
  }
}

export type AccountDeletionResult = {
  deletedProfiles: number;
  cleanupMode: "full" | "scoped";
  deletedHistory: number;
  deletedAssets: number;
  deletedCryptoAssets: number;
  deletedPriceCache: number;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

export async function parseAccountDeletePassword(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AccountDeleteValidationError(400, "Invalid request body.");
  }

  if (!body || typeof body !== "object") {
    throw new AccountDeleteValidationError(400, "Password is required.");
  }

  const password = (body as { password?: unknown }).password;
  if (typeof password !== "string" || !hasLocalPasswordInput(password)) {
    throw new AccountDeleteValidationError(400, "Password is required.");
  }

  return password;
}

export async function verifyAccountDeletePassword(
  ownerId: string,
  password: string,
  repository: AccountDeletionRepository = accountDeletionRepository
) {
  const credentialPassword = await repository.getCredentialPassword(ownerId);

  if (!credentialPassword) {
    return false;
  }

  return verifyPassword({
    hash: credentialPassword,
    password
  });
}

export async function deleteAccount(
  ownerId: string,
  repository: AccountDeletionRepository = accountDeletionRepository
): Promise<AccountDeletionResult> {
  const profileIds = await repository.listProfileIds(ownerId);
  const binanceSyncKeys = profileIds.map((profileId) => `binance_sync_${profileId}`);

  let isinsToDelete: string[] = [];
  let tokensToDelete: string[] = [];

  if (profileIds.length > 0) {
    const [userIsins, userCryptoTokens, userBinanceTokens] = await Promise.all([
      repository.listInvestmentIsins(profileIds),
      repository.listCryptoTokens(profileIds),
      repository.listBinanceTokens(profileIds)
    ]);

    const userTokens = uniqueStrings([
      ...userCryptoTokens,
      ...userBinanceTokens
    ]);

    if (userIsins.length > 0) {
      const otherIsins = new Set(await repository.listOtherInvestmentIsins(profileIds, userIsins));
      isinsToDelete = userIsins.filter((isin) => !otherIsins.has(isin));
    }

    if (userTokens.length > 0) {
      const [otherCryptoTokens, otherBinanceTokens] = await Promise.all([
        repository.listOtherCryptoTokens(profileIds, userTokens),
        repository.listOtherBinanceTokens(profileIds, userTokens)
      ]);
      const otherTokens = new Set(uniqueStrings([
        ...otherCryptoTokens,
        ...otherBinanceTokens
      ]));
      tokensToDelete = userTokens.filter((token) => !otherTokens.has(token));
    }
  }

  const scopedPriceCacheKeys = uniqueStrings([
    ...isinsToDelete,
    ...tokensToDelete,
    ...binanceSyncKeys
  ]);

  const result = await repository.deleteAccountData(ownerId, {
    profileIds,
    isinsToDelete,
    tokensToDelete,
    scopedPriceCacheKeys
  });

  return {
    deletedProfiles: profileIds.length,
    ...result
  };
}
