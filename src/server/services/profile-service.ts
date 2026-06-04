import { z } from "zod";

import { toSafeUser, toSafeUserSummary } from "@/server/auth/user-response";
import { profileRepository } from "@/server/repositories/profile-repository";
import { encryptSecret, makeBinanceApiKeyPreview } from "@/server/security/secrets";
import { invalidateProfileDataCache } from "@/server/services/profile-data-cache";
import { invalidateProfileStageSnapshots } from "@/server/services/profile-stage-snapshot";

export class ProfileConflictError extends Error {
  constructor(message = "This profile already exists.") {
    super(message);
    this.name = "ProfileConflictError";
  }
}

export class ProfileNotFoundError extends Error {
  constructor(message = "Profile not found.") {
    super(message);
    this.name = "ProfileNotFoundError";
  }
}

export class ProfileBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileBadRequestError";
  }
}

export const createProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Profile name is required.")
    .max(24, "Profile name must be 24 characters or fewer.")
});

export const patchProfileSchema = z.object({
  apiKey: z.string().trim().min(1).max(512).nullable().optional(),
  apiSecret: z.string().trim().min(1).max(512).nullable().optional(),
  deleteBalances: z.boolean().optional()
});

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

export async function listProfiles(ownerId: string) {
  const users = await profileRepository.listByOwner(ownerId);

  return users.map(toSafeUserSummary);
}

export async function createProfile(ownerId: string, input: unknown) {
  const { name } = createProfileSchema.parse(input);

  const existingUser = await profileRepository.findByOwnerAndName(ownerId, name);

  if (existingUser) {
    throw new ProfileConflictError();
  }

  const user = await profileRepository.create(ownerId, name);

  const users = await listProfiles(ownerId);

  return {
    user: {
      ...toSafeUser(user),
      transactionCount: 0,
      checkingCount: 0,
      investmentCount: 0,
      cryptoCount: 0
    },
    users
  };
}

export async function getProfile(ownerId: string, id: string) {
  const user = await profileRepository.findByOwner(ownerId, id);

  if (!user) {
    throw new ProfileNotFoundError();
  }

  return toSafeUser(user);
}

export async function deleteProfile(id: string) {
  const userIsins = await profileRepository.listInvestmentIsins(id);

  let isinsToDelete: string[] = [];
  if (userIsins.length > 0) {
    const otherIsins = new Set(await profileRepository.listOtherInvestmentIsins(id, userIsins));
    isinsToDelete = userIsins.filter((isin) => !otherIsins.has(isin));
  }

  if (isinsToDelete.length > 0) {
    await profileRepository.deleteAssetHistory(isinsToDelete);
    await profileRepository.deleteAssets(isinsToDelete);
  }

  const userTokens = uniqueStrings([
    ...(await profileRepository.listCryptoTokens(id)),
    ...(await profileRepository.listBinanceTokens(id))
  ]);

  let tokensToDelete: string[] = [];
  if (userTokens.length > 0) {
    const [otherCryptoTokens, otherBinanceTokens] = await Promise.all([
      profileRepository.listOtherCryptoTokens(id, userTokens),
      profileRepository.listOtherBinanceTokens(id, userTokens)
    ]);
    const otherTokens = new Set(uniqueStrings([
      ...otherCryptoTokens,
      ...otherBinanceTokens
    ]));
    tokensToDelete = userTokens.filter((token) => !otherTokens.has(token));
  }

  if (tokensToDelete.length > 0) {
    await profileRepository.deleteAssetHistory(tokensToDelete);
    await profileRepository.deleteCryptoAssets(tokensToDelete);
  }

  const priceCacheKeysToDelete = uniqueStrings([
    ...isinsToDelete,
    ...tokensToDelete,
    `binance_sync_${id}`
  ]);

  if (priceCacheKeysToDelete.length > 0) {
    await profileRepository.deletePriceCache(priceCacheKeysToDelete);
  }

  await profileRepository.deleteProfile(id);

  return {
    isinsToDelete,
    tokensToDelete,
    priceCacheKeysToDelete
  };
}

export async function updateProfileBinanceSettings(id: string, input: unknown) {
  const json = patchProfileSchema.parse(input);
  const hasApiKeyField = json.apiKey !== undefined;
  const hasApiSecretField = json.apiSecret !== undefined;
  const apiKey = json.apiKey;
  const apiSecret = json.apiSecret;

  if (hasApiKeyField !== hasApiSecretField) {
    throw new ProfileBadRequestError("API key and secret must be updated together.");
  }

  const data: {
    binanceApiKeyEncrypted?: string | null;
    binanceApiSecretEncrypted?: string | null;
    binanceApiKeyPreview?: string | null;
  } = {};

  if (hasApiKeyField && hasApiSecretField) {
    if (apiKey === null && apiSecret === null) {
      data.binanceApiKeyEncrypted = null;
      data.binanceApiSecretEncrypted = null;
      data.binanceApiKeyPreview = null;
    } else if (typeof apiKey === "string" && typeof apiSecret === "string") {
      data.binanceApiKeyEncrypted = encryptSecret(apiKey);
      data.binanceApiSecretEncrypted = encryptSecret(apiSecret);
      data.binanceApiKeyPreview = makeBinanceApiKeyPreview(apiKey);
    } else {
      throw new ProfileBadRequestError("API key and secret must both be provided.");
    }
  }

  if (apiKey === null && apiSecret === null && json.deleteBalances === true) {
    await Promise.all([
      profileRepository.deleteBinanceBalances(id),
      profileRepository.deleteBinanceDailySnapshots(id),
      profileRepository.deletePriceCache([`binance_sync_${id}`]),
      invalidateProfileStageSnapshots(id)
    ]);
  }

  const user = await profileRepository.updateBinanceCredentials(id, data);
  if (hasApiKeyField || json.deleteBalances === true) {
    invalidateProfileDataCache(id);
  }

  return toSafeUser(user);
}
