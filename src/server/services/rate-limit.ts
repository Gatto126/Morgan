import {
  rateLimitRepository,
  type RateLimitRepository
} from "@/server/repositories/rate-limit-repository";

type RateLimitScope = {
  namespace: string;
  subject: string;
};

type ConsumeScopedRateLimitInput = RateLimitScope & {
  windowMs: number;
  maxAttempts: number;
  nowMs?: number;
  repository?: RateLimitRepository;
};

type ClearScopedRateLimitInput = RateLimitScope & {
  repository?: RateLimitRepository;
};

function buildRateLimitKey({ namespace, subject }: RateLimitScope) {
  return `morgan:${namespace}:${subject}`;
}

export function getScopedRateLimitKey(scope: RateLimitScope) {
  return buildRateLimitKey(scope);
}

export async function consumeScopedRateLimit({
  namespace,
  subject,
  windowMs,
  maxAttempts,
  nowMs,
  repository = rateLimitRepository
}: ConsumeScopedRateLimitInput) {
  return repository.consume({
    key: buildRateLimitKey({ namespace, subject }),
    windowMs,
    maxAttempts,
    nowMs
  });
}

export async function clearScopedRateLimit({
  namespace,
  subject,
  repository = rateLimitRepository
}: ClearScopedRateLimitInput) {
  await repository.clear(buildRateLimitKey({ namespace, subject }));
}
