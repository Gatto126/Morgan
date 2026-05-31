"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  House,
  KeyRound,
  Mail,
  Send
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { getAuthLandingResetState, getAuthSubmitButtonClass } from "@/components/auth-shell-helpers";
import { warmFinanceSessionAfterLogin } from "@/components/finance-shell/login-live-price-warmup";
import { clearPersistedFinanceProfileSelection } from "@/components/finance-shell/use-finance-profile-persistence";
import { PortfolioPreviewChart } from "@/components/portfolio-preview-chart";
import { authClient } from "@/client/auth-client";
import {
  getLocalPasswordPolicyHint,
  hasLocalPasswordInput,
  isValidLocalEmail,
  isValidLocalPassword,
  normalizeLocalEmail,
} from "@/domain/auth/local-auth";
import { cn } from "@/shared/utils";

type AuthView = "landing" | "signIn" | "signUp";

const LANDING_PROMO_COPY = [
  {
    label: "Import",
    text: "Upload CSV or Excel files, preview parsed rows, then approve only the transactions you want to add."
  },
  {
    label: "Aggregate",
    text: "Keep cash accounts, ETF and stock positions, and crypto wallets separated by profile but visible in one workspace."
  },
  {
    label: "Monitor",
    text: "Use topbar totals, chart ranges and portfolio cards to compare current values with imported transactions."
  }
];

const LOGIN_WELCOME_MESSAGES = [
  "Benvenuto",
  "Welcome",
  "Bienvenido",
  "Bienvenue",
  "Willkommen",
  "Bem-vindo",
  "Welkom",
  "Velkommen",
  "Välkommen",
  "Tervetuloa",
  "Witamy",
  "Vítejte",
  "Добро пожаловать",
  "Καλώς ήρθατε",
  "Hoş geldiniz",
  "أهلاً بك",
  "ברוך הבא",
  "स्वागत है",
  "欢迎",
  "ようこそ",
  "환영합니다",
  "Chào mừng",
  "ยินดีต้อนรับ",
  "Selamat datang",
  "Karibu",
  "E komo mai"
];

function getRandomLoginWelcome() {
  if (typeof window === "undefined") return LOGIN_WELCOME_MESSAGES[1];

  const storageKey = "morgan_login_welcome_index";
  const previousIndex = Number(window.localStorage.getItem(storageKey));
  let nextIndex = Math.floor(Math.random() * LOGIN_WELCOME_MESSAGES.length);

  if (Number.isFinite(previousIndex) && LOGIN_WELCOME_MESSAGES.length > 1 && nextIndex === previousIndex) {
    nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (LOGIN_WELCOME_MESSAGES.length - 1))) % LOGIN_WELCOME_MESSAGES.length;
  }

  window.localStorage.setItem(storageKey, String(nextIndex));
  return LOGIN_WELCOME_MESSAGES[nextIndex];
}

function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invite")) {
    return "Invalid invite code.";
  }

  if (normalized.includes("email")) {
    return "Enter a valid email address.";
  }

  if (normalized.includes("invalid") || normalized.includes("unauthorized")) {
    return "Invalid email or password.";
  }

  if (normalized.includes("already") || normalized.includes("taken") || normalized.includes("exists") || normalized.includes("esiste")) {
    return "This email already exists.";
  }

  return message || "Access failed.";
}

function LandingPromoCopy() {
  return (
    <section className="grid gap-8 px-1 py-6 text-left md:grid-cols-3 md:py-8">
      {LANDING_PROMO_COPY.map((item) => (
        <article className="max-w-[360px] space-y-2" key={item.label}>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
            {item.label}
          </div>
          <p className="text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
            {item.text}
          </p>
        </article>
      ))}
    </section>
  );
}

export function AuthShell() {
  const router = useRouter();
  const [view, setView] = useState<AuthView>("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loginWelcome, setLoginWelcome] = useState(LOGIN_WELCOME_MESSAGES[1]);
  const [loginWelcomeKey, setLoginWelcomeKey] = useState(0);
  const authShellRef = useRef<HTMLElement | null>(null);

  const normalizedEmail = useMemo(() => normalizeLocalEmail(email), [email]);
  const isAuthForm = view === "signIn" || view === "signUp";
  const hasValidPassword = view === "signUp"
    ? isValidLocalPassword(password)
    : hasLocalPasswordInput(password);
  const hasValidEmail = isAuthForm && isValidLocalEmail(normalizedEmail);
  const hasInviteCode = view !== "signUp" || inviteCode.trim().length > 0;
  const hasValidAuthInput = isAuthForm && hasValidEmail && hasValidPassword && hasInviteCode;
  const canSubmit = hasValidAuthInput && !isSubmitting;

  useEffect(() => {
    authShellRef.current?.setAttribute("data-auth-shell-ready", "true");
  }, []);

  function openAuthView(nextView: Exclude<AuthView, "landing">) {
    if (nextView === view) return;

    setView(nextView);
    setEmail("");
    setPassword("");
    setInviteCode("");
    setError(null);
    setSuccessMessage(null);

    if (nextView === "signIn") {
      setLoginWelcome(getRandomLoginWelcome());
      setLoginWelcomeKey((value) => value + 1);
    }
  }

  function returnToLanding() {
    const resetState = getAuthLandingResetState();

    setView(resetState.view);
    setEmail(resetState.email);
    setPassword(resetState.password);
    setInviteCode(resetState.inviteCode);
    setError(resetState.error);
    setSuccessMessage(resetState.successMessage);
  }

  const submitCredentials = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result =
        view === "signIn"
          ? await authClient.signIn.email({
              email: normalizedEmail,
              password,
              rememberMe: true
            })
          : await authClient.signUp.email({
              email: normalizedEmail,
              password,
              name: normalizedEmail,
              inviteCode: inviteCode.trim()
            } as Parameters<typeof authClient.signUp.email>[0] & { inviteCode: string });

      if (result.error) {
        throw new Error(authErrorMessage(result.error.message || ""));
      }

      const warmupPromise = view === "signIn"
        ? warmFinanceSessionAfterLogin()
        : Promise.resolve();

      clearPersistedFinanceProfileSelection();

      if (view === "signIn") {
        setSuccessMessage("Login successful.");
        await Promise.all([
          new Promise((resolve) => window.setTimeout(resolve, 750)),
          warmupPromise
        ]);
      }

      router.refresh();
    } catch (submitError) {
      setSuccessMessage(null);
      setError(submitError instanceof Error ? submitError.message : "Access failed.");
      if (view === "signIn") {
        setPassword("");
      }
      setIsSubmitting(false);
    }
  }, [canSubmit, inviteCode, normalizedEmail, password, router, view]);

  function renderLanding() {
    return (
      <div className="mx-auto grid h-full w-full min-w-0 gap-5 text-left md:grid-cols-[minmax(0,1fr)_2px_minmax(0,1fr)]">
        <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-[380px] flex-col justify-center gap-10 py-1 sm:gap-12 md:gap-16 lg:gap-24 lg:py-2">
          <div className="space-y-4 md:space-y-6">
            <div className="space-y-2 select-none">
              <h1 className="text-4xl font-bold tracking-[-0.06em] text-white sm:text-[3rem]">
                Morgan
              </h1>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/60">
                Personal finance workspace
              </div>
            </div>
            <p className="max-w-[430px] text-sm font-semibold leading-relaxed text-[color:var(--text-dim)] sm:text-base">
              Aggregate cash accounts, ETF, stocks and crypto wallets in one private financial dashboard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:block md:space-y-5">
            <button className="group block cursor-pointer select-none space-y-1 text-left" onClick={() => openAuthView("signIn")} type="button">
              <div className="text-2xl font-bold tracking-[-0.06em] text-[color:var(--text-dim)] transition-colors group-hover:text-white md:text-3xl sm:text-[2.2rem]">
                Log in
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50 transition-colors group-hover:text-[color:var(--text-dim)]">
                Existing account
              </div>
            </button>

            <button className="group block cursor-pointer select-none space-y-1 text-left" onClick={() => openAuthView("signUp")} type="button">
              <div className="text-2xl font-bold tracking-[-0.06em] text-[color:var(--text-dim)] transition-colors group-hover:text-white md:text-3xl sm:text-[2.2rem]">
                Register
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50 transition-colors group-hover:text-[color:var(--text-dim)]">
                New account
              </div>
            </button>
          </div>
        </div>

        <div className="hidden w-[2px] shrink-0 self-stretch bg-[color:var(--line-strong)] opacity-30 md:block" />
        <PortfolioPreviewChart />
      </div>
    );
  }

  function renderAuthModeLabel(targetView: Exclude<AuthView, "landing">) {
    const isTargetSignUp = targetView === "signUp";

    return (
      <div className="block select-none space-y-1 text-left">
        <h1 className="text-2xl font-bold tracking-[-0.06em] text-white md:text-3xl sm:text-[2.2rem]">
          {isTargetSignUp ? "Register" : "Log in"}
        </h1>
      </div>
    );
  }

  function renderAuthForm() {
    const isSignUp = view === "signUp";
    const primaryView: Exclude<AuthView, "landing"> = isSignUp ? "signUp" : "signIn";

    return (
      <div className="mx-auto flex h-full w-full max-w-[1164px] items-center justify-center text-left md:relative md:h-[526px] md:max-h-[526px]">
        <div className="hidden md:absolute md:left-1/4 md:top-1/2 md:block md:w-[320px] md:-translate-x-1/2 md:-translate-y-1/2">
          <div className={cn(isSignUp ? "space-y-7" : "space-y-2")}>
            {!isSignUp ? (
              <div className="ml-11 min-h-[3.25rem] max-w-[285px] select-none">
                <div
                  key={loginWelcomeKey}
                  dir="auto"
                  className="login-welcome-enter inline-block break-words py-2 text-[2.35rem] font-bold leading-[1.14] tracking-normal text-[color:var(--text-dim)] sm:text-[2.75rem]"
                >
                  {loginWelcome}
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                aria-label="Back"
                className="icon-plain -ml-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
                onClick={returnToLanding}
                type="button"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={2.3} />
              </button>

              {renderAuthModeLabel(primaryView)}
            </div>

            {isSignUp ? (
              <div className="ml-11 max-w-[250px] space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                  Account access
                </div>
                <p className="text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
                  Morgan protects your financial workspace and keeps your personal data private.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden h-full w-[2px] shrink-0 self-stretch bg-[color:var(--line-strong)] opacity-30 md:absolute md:left-1/2 md:top-0 md:block" />

        <form
          className={cn(
            "flex h-full w-full shrink-0 flex-col items-center justify-center py-1 md:absolute md:left-3/4 md:top-1/2 md:w-[398px] md:-translate-x-1/2 md:-translate-y-1/2 md:py-0",
            isSignUp ? "md:h-[228px]" : "md:h-[108px]"
          )}
          onSubmit={(event) => {
            event.preventDefault();
            void submitCredentials();
          }}
        >
          <button
            aria-label="Back"
            className="icon-plain mb-4 flex h-10 w-10 cursor-pointer items-center justify-center self-start text-[color:var(--text-dim)] transition-colors hover:text-white md:hidden"
            onClick={returnToLanding}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className={cn(
            "w-full max-w-[398px] space-y-4 md:relative md:space-y-0",
            isSignUp ? "md:h-[228px]" : "md:h-[108px]"
          )}>
            <div className="space-y-3">
              {isSignUp ? (
                <div className="relative">
                  <Input
                    autoComplete="off"
                    autoFocus
                    className="h-11 pr-12 text-lg sm:h-12 sm:text-xl"
                    disabled={isSubmitting}
                    maxLength={64}
                    name="inviteCode"
                    onChange={(event) => {
                      setInviteCode(event.target.value);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    placeholder="Invite code"
                    type="password"
                    value={inviteCode}
                  />
                  <KeyRound className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                </div>
              ) : null}

              <div className="relative">
                <Input
                  autoComplete="email"
                  autoFocus={!isSignUp}
                  className="h-11 pr-12 text-lg sm:h-12 sm:text-xl"
                  disabled={isSubmitting}
                  maxLength={254}
                  name="email"
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                    setSuccessMessage(null);
                    if (view === "signIn" && error) {
                      setPassword("");
                    }
                  }}
                  placeholder="Email"
                  type="email"
                  value={email}
                />
                <Mail className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2 sm:grid-cols-[minmax(0,1fr)_48px]">
                <Input
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="h-11 text-lg sm:h-12 sm:text-xl"
                  disabled={isSubmitting}
                  maxLength={128}
                  name="password"
                  onChange={(event) => {
                    const nextPassword = event.target.value;
                    setPassword(nextPassword);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  placeholder="Password"
                  type="password"
                  value={password}
                />
                <button
                  aria-label={isSignUp ? "Create account" : "Log in"}
                  className={getAuthSubmitButtonClass(canSubmit)}
                  disabled={!canSubmit}
                  title={isSignUp ? "Create account" : "Log in"}
                  type="submit"
                >
                  <Send className={cn("h-4 w-4", isSubmitting && "animate-pulse")} strokeWidth={2.3} />
                </button>
              </div>

              {isSignUp ? (
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-dim)]/50 md:absolute md:left-0 md:top-[calc(100%+0.45rem)] md:w-full">
                  {getLocalPasswordPolicyHint()}
                </p>
              ) : null}

            </div>

            <p
              className={cn(
                "min-h-4 text-xs font-semibold",
                "text-center md:absolute md:left-0 md:w-full",
                isSignUp ? "md:top-[calc(100%+2rem)]" : "md:top-[calc(100%+1.2rem)]",
                error ? "text-[color:var(--danger)]" : successMessage ? "text-emerald-300" : "text-transparent"
              )}
            >
              {error ?? successMessage ?? ""}
            </p>
          </div>
        </form>
      </div>
    );
  }

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-[color:var(--page-bg)] text-[color:var(--text-main)]"
      data-auth-shell-ready="false"
      ref={authShellRef}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-[1800px] flex-col overflow-y-auto hide-scrollbar px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <section
          className={cn(
            "grid min-h-0 flex-1 grid-cols-1 gap-4 content-start md:grid-cols-[64px_minmax(0,1fr)] lg:gap-5",
            view === "landing"
              ? "grid-rows-[auto_minmax(620px,auto)_auto] sm:grid-rows-[auto_minmax(680px,auto)_auto] md:grid-rows-[auto_520px_auto] lg:grid-rows-[auto_600px_auto]"
              : "grid-rows-[auto_320px_auto] sm:grid-rows-[auto_480px_auto] md:grid-rows-[auto_520px_auto] lg:grid-rows-[auto_600px_auto]"
          )}
        >
          <header className="grid min-h-16 grid-cols-[64px_minmax(0,1fr)] items-center gap-4 md:col-span-2 lg:gap-5">
            <div className="flex h-12 w-12 items-center justify-center justify-self-center rounded-2xl text-[2rem] font-black tracking-[-0.12em] text-white">
              M
            </div>
            <div className="min-w-0">
              <div className="h-16 w-full rounded-[22px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-shell)]" />
            </div>
          </header>

          <aside className="order-3 flex h-[88px] w-full flex-row items-center justify-between rounded-[22px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-shell)] p-3 md:order-none md:row-start-2 md:h-auto md:w-auto md:flex-col">
            <div className="hidden md:flex md:flex-col md:gap-2">
              <button
                aria-label="Morgan"
                className={cn(
                  "flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985] has-lucide",
                  view === "landing"
                    ? "border-white text-white"
                    : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                )}
                data-active={view === "landing" ? "true" : "false"}
                onClick={returnToLanding}
                type="button"
              >
                <House className="h-5 w-5" strokeWidth={2.3} />
              </button>
            </div>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--text-dim)] md:hidden">
              {view === "landing" ? "Morgan" : view === "signUp" ? "Register" : "Log in"}
            </div>
            <div className="h-12 w-12" />
          </aside>

          <section className="order-2 flex min-h-0 md:order-none md:row-start-2">
            <div className="relative flex min-h-0 w-full overflow-hidden rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent_22%)]" />
              <div className="relative flex w-full min-h-0 items-center justify-center p-3 sm:p-5">
                {view === "landing" ? renderLanding() : renderAuthForm()}
              </div>
            </div>
          </section>

          <div className="order-4 md:col-start-2 md:row-start-3">
            {view === "landing" ? (
              <LandingPromoCopy />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
