# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.8.1 --activate

FROM base AS deps

ARG DATABASE_URL=postgresql://morgan:morgan@postgres:5432/morgan?schema=public
ARG DIRECT_URL=postgresql://morgan:morgan@postgres:5432/morgan?schema=public

ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_URL=$DIRECT_URL
ENV MORGAN_DATABASE_PROVIDER=postgresql

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

FROM base AS builder

ARG DATABASE_URL=postgresql://morgan:morgan@postgres:5432/morgan?schema=public
ARG DIRECT_URL=postgresql://morgan:morgan@postgres:5432/morgan?schema=public

ENV NODE_ENV=production
ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_URL=$DIRECT_URL
ENV MORGAN_DATABASE_PROVIDER=postgresql
ENV BETTER_AUTH_SECRET=build-time-placeholder-only-not-runtime-2026-05-28-93f2a7c4e8d1b6a0
ENV BETTER_AUTH_URL=http://localhost:3001
ENV BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001
ENV BETTER_AUTH_IP_HEADERS=x-forwarded-for
ENV MORGAN_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm exec prisma generate --schema=prisma/schema.prisma
RUN pnpm run build

FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV MORGAN_DATABASE_PROVIDER=postgresql

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy --schema=prisma/schema.prisma && pnpm start"]
