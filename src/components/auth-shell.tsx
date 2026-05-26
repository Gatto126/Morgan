"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, House, Send, UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  isValidLocalPin,
  isValidLocalUsername,
  localUsernameToEmail,
  normalizeLocalUsername
} from "@/lib/local-auth";
import { cn } from "@/lib/utils";

type AuthView = "landing" | "signIn" | "signUp";

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

  if (normalized.includes("invalid") || normalized.includes("unauthorized")) {
    return "Invalid username or PIN.";
  }

  if (normalized.includes("already") || normalized.includes("taken") || normalized.includes("exists") || normalized.includes("esiste")) {
    return "This username already exists.";
  }

  return message || "Access failed.";
}

export function AuthShell() {
  const router = useRouter();
  const [view, setView] = useState<AuthView>("landing");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loginWelcome, setLoginWelcome] = useState(LOGIN_WELCOME_MESSAGES[1]);
  const [loginWelcomeKey, setLoginWelcomeKey] = useState(0);
  const lastSubmittedRef = useRef<string | null>(null);

  const normalizedUsername = useMemo(() => normalizeLocalUsername(username), [username]);
  const isAuthForm = view === "signIn" || view === "signUp";
  const hasValidAuthInput = isAuthForm && isValidLocalUsername(normalizedUsername) && isValidLocalPin(pin);
  const canSubmit = hasValidAuthInput && !isSubmitting;

  function openAuthView(nextView: Exclude<AuthView, "landing">) {
    if (nextView === view) return;

    setView(nextView);
    setUsername("");
    setPin("");
    setShowPin(false);
    setError(null);
    setSuccessMessage(null);
    lastSubmittedRef.current = null;

    if (nextView === "signIn") {
      setLoginWelcome(getRandomLoginWelcome());
      setLoginWelcomeKey((value) => value + 1);
    }
  }

  const submitCredentials = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result =
        view === "signIn"
          ? await authClient.signIn.username({
              username: normalizedUsername,
              password: pin,
              rememberMe: true
            })
          : await authClient.signUp.email({
              email: localUsernameToEmail(normalizedUsername),
              password: pin,
              name: username.trim() || normalizedUsername,
              username: normalizedUsername,
              displayUsername: username.trim() || normalizedUsername
            });

      if (result.error) {
        throw new Error(authErrorMessage(result.error.message || ""));
      }

      localStorage.removeItem("morgan_active_user");
      localStorage.removeItem("morgan_stage");

      if (view === "signIn") {
        setSuccessMessage("Login successful.");
        await new Promise((resolve) => window.setTimeout(resolve, 750));
      }

      router.refresh();
    } catch (submitError) {
      setSuccessMessage(null);
      setError(submitError instanceof Error ? submitError.message : "Access failed.");
      if (view === "signIn") {
        setPin("");
        setShowPin(false);
        lastSubmittedRef.current = null;
      }
      setIsSubmitting(false);
    }
  }, [canSubmit, normalizedUsername, pin, router, username, view]);

  useEffect(() => {
    if (view !== "signIn" || !canSubmit) return;

    const submissionKey = `${view}:${normalizedUsername}:${pin}`;
    if (lastSubmittedRef.current === submissionKey) return;

    const loginTimer = window.setTimeout(() => {
      lastSubmittedRef.current = submissionKey;
      void submitCredentials();
    }, 700);

    return () => window.clearTimeout(loginTimer);
  }, [canSubmit, normalizedUsername, pin, submitCredentials, view]);

  function renderLanding() {
    return (
      <div className="mx-auto flex h-full w-full max-w-[850px] items-stretch justify-start text-left md:h-[380px]">
        <div className="flex h-full w-full shrink-0 flex-col justify-between py-1 md:w-[380px] md:py-2">
          <div className="space-y-4 md:space-y-6">
            <div className="space-y-1 select-none">
              <h1 className="text-4xl font-bold tracking-[-0.06em] text-white sm:text-[3rem]">
                Morgan
              </h1>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50">
                Personal finance workspace
              </div>
            </div>
            <p className="max-w-[320px] text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
              Track accounts, investments and crypto in one private local dashboard.
            </p>
          </div>

          <div className="space-y-5 pt-6">
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
                New local account
              </div>
            </button>
          </div>
        </div>

        <div className="mx-8 hidden w-[2px] shrink-0 self-stretch bg-[color:var(--line-strong)] opacity-30 md:block" />

        <div className="hidden h-full w-[398px] shrink-0 flex-col justify-end py-2 md:flex">
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold uppercase tracking-[-0.06em] text-white">LOCAL FIRST</h2>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                Built around your profiles
              </div>
            </div>
            <p className="text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
              Your account opens Morgan. Profiles inside Morgan separate the financial workspaces.
            </p>
          </div>
        </div>
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
                onClick={() => setView("landing")}
                type="button"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={2.3} />
              </button>

              {renderAuthModeLabel(primaryView)}
            </div>

            {isSignUp ? (
              <div className="ml-11 max-w-[250px] space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                  Offline account
                </div>
                <p className="text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
                  Morgan keeps your account local to this device. We do not use, sell, or track your personal data.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden h-full w-[2px] shrink-0 self-stretch bg-[color:var(--line-strong)] opacity-30 md:absolute md:left-1/2 md:top-0 md:block" />

        <form
          className="flex h-full w-full shrink-0 flex-col items-center justify-center py-1 md:absolute md:left-3/4 md:top-1/2 md:h-[108px] md:w-[398px] md:-translate-x-1/2 md:-translate-y-1/2 md:py-0"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCredentials();
          }}
        >
          <button
            aria-label="Back"
            className="icon-plain mb-4 flex h-10 w-10 cursor-pointer items-center justify-center self-start text-[color:var(--text-dim)] transition-colors hover:text-white md:hidden"
            onClick={() => setView("landing")}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="w-full max-w-[398px] space-y-4 md:relative md:h-[108px] md:space-y-0">
            <div className="space-y-3">
              <div className="relative">
                <Input
                  autoComplete="username"
                  autoFocus
                  className="h-11 pr-12 text-lg sm:h-12 sm:text-xl"
                  disabled={isSubmitting}
                  maxLength={24}
                  name="username"
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setError(null);
                    setSuccessMessage(null);
                    lastSubmittedRef.current = null;
                    if (view === "signIn" && error) {
                      setPin("");
                    }
                  }}
                  placeholder="Username"
                  value={username}
                />
                <UserRound className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" />
              </div>

              <div className="relative">
                <Input
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="h-11 pr-12 text-lg sm:h-12 sm:text-xl"
                  disabled={isSubmitting}
                  maxLength={16}
                  name="password"
                  onChange={(event) => {
                    const nextPin = event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
                    setPin(nextPin);
                    setError(null);
                    setSuccessMessage(null);
                    if (!isValidLocalPin(nextPin)) {
                      lastSubmittedRef.current = null;
                    }
                  }}
                  pattern="[a-zA-Z0-9]{6,16}"
                  placeholder="PIN"
                  type={showPin ? "text" : "password"}
                  value={pin}
                />
                <button
                  aria-label={showPin ? "Hide PIN" : "Show PIN"}
                  className="icon-plain absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
                  onClick={() => setShowPin((value) => !value)}
                  type="button"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {isSignUp ? (
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-dim)]/50 md:absolute md:left-0 md:top-[calc(100%+0.45rem)] md:w-full">
                  6-16 letters or numbers
                </p>
              ) : null}

              {isSignUp ? (
                <div className="flex min-h-11 justify-center pt-1 md:absolute md:left-0 md:top-[calc(100%+1.65rem)] md:w-full md:pt-0">
                  {hasValidAuthInput ? (
                    <button
                      aria-label="Create account"
                      className="relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] p-0 text-[color:var(--text-dim)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:border-[color:var(--text-dim)] hover:bg-[color:var(--surface-elevated)] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 has-lucide"
                      disabled={isSubmitting}
                      title="Create account"
                      type="submit"
                    >
                      <Send className={cn("pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2", isSubmitting && "animate-pulse")} strokeWidth={2.3} />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <p
              className={cn(
                "min-h-4 text-xs font-semibold",
                "text-center md:absolute md:left-0 md:w-full",
                isSignUp ? "md:top-[calc(100%+5.1rem)]" : "md:top-[calc(100%+1.85rem)]",
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
    <main className="flex min-h-dvh items-center justify-center bg-[color:var(--page-bg)] text-[color:var(--text-main)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1800px] flex-col overflow-y-auto hide-scrollbar px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <section className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_320px_auto] sm:grid-rows-[auto_480px_auto] md:grid-cols-[64px_minmax(0,1fr)] md:grid-rows-[auto_520px_auto] lg:grid-rows-[auto_600px_auto] gap-4 content-start lg:gap-5">
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
                onClick={() => setView("landing")}
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

          <div className="order-4 md:col-start-2 md:row-start-3" />
        </section>
      </div>
    </main>
  );
}
