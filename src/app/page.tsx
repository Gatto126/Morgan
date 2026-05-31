import { cookies, headers } from "next/headers";

import { AuthShell } from "@/components/auth-shell";
import { FinanceShell } from "@/components/finance-shell";
import {
  ACTIVE_PROFILE_PERSISTENCE_KEY,
  ACTIVE_STAGE_PERSISTENCE_KEY,
  type PersistedFinanceSelection,
  resolveRestoredStage
} from "@/components/finance-shell/persistence-state";
import { auth } from "@/server/auth/auth";
import { listProfiles } from "@/server/services/profile-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user?.id) {
    return <AuthShell />;
  }

  const usersWithCount = await listProfiles(session.user.id);
  const cookieStore = await cookies();
  const persistedActiveUserId = cookieStore.get(ACTIVE_PROFILE_PERSISTENCE_KEY)?.value ?? null;
  const persistedStage = resolveRestoredStage(cookieStore.get(ACTIVE_STAGE_PERSISTENCE_KEY)?.value ?? null);
  const persistedActiveUser = persistedActiveUserId
    ? usersWithCount.find((user) => user.id === persistedActiveUserId) ?? null
    : null;
  const initialSelection: PersistedFinanceSelection | null = persistedActiveUser
    ? { activeUserId: persistedActiveUser.id, stage: persistedStage }
    : null;

  return (
    <FinanceShell
      accountName={session.user.name}
      initialSelection={initialSelection}
      initialUsers={usersWithCount}
    />
  );
}
