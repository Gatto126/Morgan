import { headers } from "next/headers";

import { AuthShell } from "@/components/auth-shell";
import { FinanceShell } from "@/components/finance-shell";
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

  return <FinanceShell accountName={session.user.name} initialUsers={usersWithCount} />;
}
