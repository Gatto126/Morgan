import { headers } from "next/headers";

import { AuthShell } from "@/components/auth-shell";
import { FinanceShell } from "@/components/finance-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toSafeUserSummary } from "@/lib/user-response";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user?.id) {
    return <AuthShell />;
  }

  const users = await prisma.user.findMany({
    where: {
      ownerId: session.user.id
    },
    include: {
      _count: {
        select: {
          checkingTransactions: true,
          investmentTransactions: true,
          cryptoTransactions: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const usersWithCount = users.map(toSafeUserSummary);

  return <FinanceShell accountName={session.user.name} initialUsers={usersWithCount} />;
}
