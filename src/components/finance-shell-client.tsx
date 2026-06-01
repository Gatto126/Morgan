"use client";

import dynamic from "next/dynamic";

import type { FinanceShellProps } from "./finance-shell";

const FinanceShellNoSsr = dynamic(
  () => import("./finance-shell").then((mod) => mod.FinanceShell),
  { loading: () => null, ssr: false }
);

export function FinanceShellClient(props: FinanceShellProps) {
  return <FinanceShellNoSsr {...props} />;
}
