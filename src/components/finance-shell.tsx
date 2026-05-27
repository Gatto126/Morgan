"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bitcoin, ChartPie, Coins, House, Landmark, Settings, Wallet, X as XIcon } from "lucide-react";
import { AuthShell } from "./auth-shell";
import { Dashboard } from "./dashboard";
import { CheckingDashboard } from "./checking-dashboard";
import { InvestmentDashboard } from "./investment-dashboard";
import { BinanceDashboard } from "./binance-dashboard";
import { CryptoDashboard } from "./crypto-dashboard";
import { ReviewPanel } from "./finance-shell/review-panel";
import { SettingsPanel, type SettingsSection } from "./finance-shell/settings-panel";
import type { UserRecord } from "./finance-shell/types";
import { UploadPanel } from "./finance-shell/upload-panel";
import { useFinanceNavigation, type Stage } from "./finance-shell/use-finance-navigation";
import { useTransactionImport, type ImportedTransactionCounts } from "./finance-shell/use-transaction-import";
import { UserSelectPanel } from "./finance-shell/user-select-panel";
import PlusIcon from "./ui/plus-icon";
import UserIcon from "./ui/user-icon";

import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { hasLocalPasswordInput } from "@/lib/local-auth";
import { cn, getInitials } from "@/lib/utils";

const dashboardStages = new Set<Stage>(["dashboard", "checking", "investment", "binance", "crypto"]);
const restorableStages = new Set<Stage>(["welcome", "select", "create", "dashboard", "checking", "investment", "settings", "binance", "crypto"]);

function isRestorableStage(value: string | null): value is Stage {
  return value !== null && restorableStages.has(value as Stage);
}

function resolveInitialFinanceState(initialUsers: UserRecord[]) {
  const onlyUser = initialUsers.length === 1 ? initialUsers[0] : null;

  if (onlyUser) {
    return {
      activeUser: onlyUser,
      showUploadView: onlyUser.transactionCount === 0,
      stage: "dashboard" as Stage
    };
  }

  return {
    activeUser: null,
    showUploadView: false,
    stage: initialUsers.length > 0 ? "select" as Stage : "create" as Stage
  };
}

function getStageTitle(stage: Stage, hasUsers: boolean) {
  switch (stage) {
    case "welcome":
      return "Welcome";
    case "select":
      return hasUsers ? "Select profile" : "Create first profile";
    case "create":
      return "New profile";
    case "dashboard":
      return "Dashboard";
    case "checking":
      return "Checking";
    case "investment":
      return "Investments";
    case "settings":
      return "Settings";
    case "binance":
      return "Binance";
    case "crypto":
      return "Crypto";
    default:
      return "Welcome";
  }
}

export function FinanceShell({ accountName, initialUsers }: { accountName: string; initialUsers: UserRecord[] }) {
  const router = useRouter();
  const [initialFinanceState] = useState(() => resolveInitialFinanceState(initialUsers));
  const suggestedFirstProfileName = initialUsers.length === 0 ? accountName : "";
  const [isSignedOut, setIsSignedOut] = useState(false);
  const [hasRestoredClientState, setHasRestoredClientState] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [name, setName] = useState(suggestedFirstProfileName);
  const [activeUser, setActiveUser] = useState<UserRecord | null>(initialFinanceState.activeUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [binanceKeyInput, setBinanceKeyInput] = useState("");
  const [binanceSecretInput, setBinanceSecretInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [binanceRefreshKey, setBinanceRefreshKey] = useState(0);
  const [showDeleteApiConfirm, setShowDeleteApiConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [binanceFading, setBinanceFading] = useState(false);
  const [pinApiSettingsSection, setPinApiSettingsSection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createUserInputRef = useRef<HTMLInputElement | null>(null);
  const {
    parsing,
    approving,
    previewTransactions,
    totalPages,
    visiblePage,
    currentTransactions,
    newTransactionsCount,
    importOverlayVisible,
    importOverlayFadingOut,
    resetPreview,
    openFilePicker,
    handleFileSelection,
    approveTransactions,
    handleImportRefreshComplete,
    goToPreviousPage,
    goToNextPage
  } = useTransactionImport({
    activeUserId: activeUser?.id ?? null,
    fileInputRef,
    setError,
    setNotice,
    onImportedTransactions: applyImportedTransactionCounts
  });
  const {
    stage,
    setStage,
    showUploadView,
    setShowUploadView,
    isClosingUpload,
    showSettingsView,
    setShowSettingsView,
    isClosingSettings,
    activeSettingsSection,
    setActiveSettingsSection,
    showUserSelectView,
    setShowUserSelectView,
    isClosingUserSelect,
    setIsClosingUserSelect,
    showCreateUserSubmenu,
    setShowCreateUserSubmenu,
    handlePlusClick,
    handleCloseUpload,
    handleSettingsClick,
    handleCloseSettings,
    handleUserSelectClick,
    handleCloseUserSelect,
    navigateTo,
    navigateHome,
    toggleSettingsSection
  } = useFinanceNavigation({
    initialStage: initialFinanceState.stage,
    initialShowUploadView: initialFinanceState.showUploadView,
    hasActiveUser: !!activeUser,
    activeUserTransactionCount: activeUser?.transactionCount ?? null,
    hasUsers: users.length > 0,
    resetPreview,
    clearApiKeyDraft,
    clearPanelFeedback
  });
  const isDashboardStage = dashboardStages.has(stage);

  useEffect(() => {
    if (showCreateUserSubmenu && createUserInputRef.current) {
      const timer = setTimeout(() => {
        createUserInputRef.current?.focus({ preventScroll: true });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showCreateUserSubmenu]);

  useEffect(() => {
    let cancelled = false;

    const restoreTimer = window.setTimeout(() => {
      try {
        const savedUserId = localStorage.getItem("morgan_active_user");
        const savedStage = localStorage.getItem("morgan_stage");
        const savedUser = savedUserId ? initialUsers.find((user) => user.id === savedUserId) ?? null : null;

        if (!cancelled && savedUser) {
          const restoredStage = isRestorableStage(savedStage) ? savedStage : "dashboard";

          setActiveUser(savedUser);
          setShowUploadView(savedUser.transactionCount === 0);
          setStage(restoredStage);
          setActiveSettingsSection(restoredStage === "settings" ? "general" : null);
        }
      } catch (err) {
        console.warn("Could not read localStorage for persistence", err);
      } finally {
        if (!cancelled) {
          setHasRestoredClientState(true);
        }
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(restoreTimer);
    };
  }, [initialUsers, setActiveSettingsSection, setShowUploadView, setStage]);

  function clearApiKeyDraft() {
    setBinanceKeyInput("");
    setBinanceSecretInput("");
    setShowSecret(false);
  }

  function clearPanelFeedback() {
    setError(null);
    setNotice(null);
    setShowDeleteApiConfirm(false);
  }

  // Automatically dismiss success notices/errors after 3.5 seconds (not while testing)
  useEffect(() => {
    if ((notice || error) && !isTesting) {
      const timer = setTimeout(() => {
        setNotice(null);
        setError(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [notice, error, isTesting]);

  useEffect(() => {
    if (!isTesting) {
      return;
    }

    setShowSettingsView(true);
    setActiveSettingsSection("apiKey");
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
  }, [
    isTesting,
    setActiveSettingsSection,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUserSelectView
  ]);

  async function handleSaveApiKeys() {
    if (!activeUser) return;

    const keepApiSettingsOpen = () => {
      setPinApiSettingsSection(true);
      setShowSettingsView(true);
      setActiveSettingsSection("apiKey");
      setShowUserSelectView(false);
      setShowCreateUserSubmenu(false);
    };

    try {
      keepApiSettingsOpen();
      setError(null);
      setNotice(null);

      // Phase 1: persist keys
      const response = await fetch(`/api/users/${activeUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: binanceKeyInput.trim() || null,
          apiSecret: binanceSecretInput.trim() || null,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save API keys.");
      }

      const updatedUser = {
        ...activeUser,
        hasBinanceCredentials: payload.user.hasBinanceCredentials,
        binanceApiKeyPreview: payload.user.binanceApiKeyPreview,
      };
      setActiveUser(updatedUser);
      setBinanceKeyInput("");
      setBinanceSecretInput("");
      setShowSecret(false);
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === activeUser.id ? updatedUser : u))
      );

      // Phase 2: sync all wallets against Binance (Spot + Funding + Earn)
      keepApiSettingsOpen();
      setIsTesting(true);
      setNotice("Testing endpoint...");

      const testResponse = await fetch("/api/binance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUser.id }),
      });

      const testPayload = await testResponse.json();

      if (!testResponse.ok) {
        throw new Error(testPayload.error ?? "Binance connection failed.");
      }

      const tokenCount: number = testPayload.balances?.length ?? 0;
      setNotice(
        tokenCount > 0
          ? `Connected! ${tokenCount} token${tokenCount !== 1 ? "s" : ""} found.`
          : "Connected! Empty wallet."
      );
      keepApiSettingsOpen();
      setBinanceRefreshKey((k) => k + 1);
    } catch (err) {
      keepApiSettingsOpen();
      setError(err instanceof Error ? err.message : "Error saving API keys.");
    } finally {
      keepApiSettingsOpen();
      setIsTesting(false);
    }
  }

  async function handleDeleteApiKeys(deleteData: boolean) {
    if (!activeUser) return;

    setShowDeleteApiConfirm(false);
    setError(null);
    setNotice(null);
    setBinanceFading(true);

    try {
      const response = await fetch(`/api/users/${activeUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: null,
          apiSecret: null,
          deleteBalances: deleteData,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete API keys.");
      }

      // Let the CSS fade-out transition complete before removing the element from the DOM
      await new Promise<void>((resolve) => setTimeout(resolve, 300));

      const updatedUser = { ...activeUser, hasBinanceCredentials: false, binanceApiKeyPreview: null };
      setActiveUser(updatedUser);
      setBinanceKeyInput("");
      setBinanceSecretInput("");
      setUsers((prev) => prev.map((u) => (u.id === activeUser.id ? updatedUser : u)));

      if (deleteData) setBinanceRefreshKey((k) => k + 1);
      if (stage === "binance") setStage("dashboard");

      setNotice(deleteData ? "API keys and data deleted." : "API keys deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting API keys.");
    } finally {
      setBinanceFading(false);
    }
  }

  async function handleSignOut() {
    try {
      await authClient.signOut();
    } finally {
      localStorage.removeItem("morgan_active_user");
      localStorage.removeItem("morgan_stage");
      setIsSignedOut(true);
      router.refresh();
    }
  }

  useEffect(() => {
    if (!hasRestoredClientState) return;

    try {
      if (activeUser) {
        localStorage.setItem("morgan_active_user", activeUser.id);
      } else {
        localStorage.removeItem("morgan_active_user");
      }
      localStorage.setItem("morgan_stage", stage);
    } catch (err) {
      console.warn("Could not write localStorage for persistence", err);
    }
  }, [stage, activeUser, hasRestoredClientState]);

  const hasUsers = users.length > 0;
  const title = getStageTitle(stage, hasUsers);

  function applyImportedTransactionCounts({
    insertedCount,
    addedChecking,
    addedInvestment,
    addedCrypto
  }: ImportedTransactionCounts) {
    if (!activeUser) return;

    setActiveUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        transactionCount: prev.transactionCount + insertedCount,
        checkingCount: prev.checkingCount + addedChecking,
        investmentCount: prev.investmentCount + addedInvestment,
        cryptoCount: prev.cryptoCount + addedCrypto
      };
    });

    setUsers((currentUsers) =>
      currentUsers.map((user) => {
        if (user.id === activeUser.id) {
          return {
            ...user,
            transactionCount: user.transactionCount + insertedCount,
            checkingCount: user.checkingCount + addedChecking,
            investmentCount: user.investmentCount + addedInvestment,
            cryptoCount: user.cryptoCount + addedCrypto
          };
        }

        return user;
      })
    );
  }

  function handleUserSelect(user: UserRecord) {
    setActiveUser(user);
    resetPreview();
    if (showUserSelectView) {
      setIsClosingUserSelect(false);
      setShowUserSelectView(false);
      setShowCreateUserSubmenu(false);
    }
    setShowSettingsView(false);
    setActiveSettingsSection(null);
    clearPanelFeedback();
    clearApiKeyDraft();
    setShowUploadView(user.transactionCount === 0);
    setStage("dashboard");
    setError(null);
    setNotice(null);
  }

  async function handleCreateUser() {
    const trimmed = name.trim();
    if (!trimmed || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: trimmed })
      });

      const payload = (await response.json()) as { user?: UserRecord; error?: string; users?: UserRecord[] };

      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? "User creation failed.");
      }

      const updatedUsers = payload.users ?? [...users, payload.user];
      setUsers(updatedUsers);
      setActiveUser(payload.user);
      setName("");
      resetPreview();
      setNotice(null);
      setShowUploadView(payload.user.transactionCount === 0);
      setShowUserSelectView(false);
      setShowCreateUserSubmenu(false);
      setStage("dashboard");
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "User creation failed.");
    } finally {
      setSaving(false);
    }
  }

  function openDeleteAccountConfirm() {
    setDeleteAccountPassword("");
    setShowDeleteAccountConfirm(true);
    setError(null);
    setNotice(null);
  }

  function closeDeleteAccountConfirm() {
    if (isDeletingAccount) return;

    setShowDeleteAccountConfirm(false);
    setDeleteAccountPassword("");
  }

  async function handleDeleteAccount() {
    if (isDeletingAccount) return;

    try {
      setIsDeletingAccount(true);
      setError(null);
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deleteAccountPassword })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Error during account deletion.");
      }

      try {
        await authClient.signOut();
      } catch {
        // The account and session may already be gone after the server-side delete.
      }

      localStorage.removeItem("morgan_active_user");
      localStorage.removeItem("morgan_stage");
      setUsers([]);
      setActiveUser(null);
      setIsSignedOut(true);
      setShowDeleteAccountConfirm(false);
      setDeleteAccountPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error during account deletion.");
    } finally {
      setIsDeletingAccount(false);
    }
  }

  function goBackToSelection() {
    if (hasUsers) {
      setStage("select");
      return;
    }

    setStage("welcome");
  }

  function renderUserSelectState() {
    return (
      <UserSelectPanel
        users={users}
        activeUserId={activeUser?.id ?? null}
        isCreateOpen={showCreateUserSubmenu}
        profileName={name}
        saving={saving}
        error={error}
        notice={notice}
        createInputRef={createUserInputRef}
        onSelectUser={handleUserSelect}
        onToggleCreate={() => {
          setShowCreateUserSubmenu((prev) => !prev);
          setName(users.length === 0 ? accountName : "");
          setError(null);
          setNotice(null);
        }}
        onCloseCreate={() => setShowCreateUserSubmenu(false)}
        onProfileNameChange={setName}
        onCreateUser={() => void handleCreateUser()}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  function handleSettingsSectionSelect(section: SettingsSection) {
    if (section !== "apiKey") {
      setPinApiSettingsSection(false);
    }
    toggleSettingsSection(section);
  }

  function handleSettingsPanelClose() {
    setPinApiSettingsSection(false);
    handleCloseSettings();
  }

  function handleSettingsNavClick() {
    setPinApiSettingsSection(false);
    handleSettingsClick();
  }

  function renderSettingsState() {
    const isApiKeySaved = !!activeUser?.hasBinanceCredentials;
    const visibleSettingsSection =
      pinApiSettingsSection && showSettingsView ? "apiKey" : activeSettingsSection;

    return (
      <SettingsPanel
        accountName={accountName}
        activeSection={visibleSettingsSection}
        hasActiveUser={!!activeUser}
        isApiKeySaved={isApiKeySaved}
        binanceApiKeyPreview={activeUser?.binanceApiKeyPreview ?? null}
        binanceKeyInput={binanceKeyInput}
        binanceSecretInput={binanceSecretInput}
        showSecret={showSecret}
        isTesting={isTesting}
        showDeleteApiConfirm={showDeleteApiConfirm}
        error={error}
        notice={notice}
        onSelectSection={handleSettingsSectionSelect}
        onBackToMenu={() => {
          setPinApiSettingsSection(false);
          clearPanelFeedback();
          setActiveSettingsSection(null);
        }}
        onSignOut={() => void handleSignOut()}
        onBinanceKeyChange={setBinanceKeyInput}
        onBinanceSecretChange={setBinanceSecretInput}
        onToggleSecret={() => setShowSecret((value) => !value)}
        onToggleDeleteApiConfirm={() => setShowDeleteApiConfirm((value) => !value)}
        onDeleteApiKeys={(deleteData) => void handleDeleteApiKeys(deleteData)}
        onSaveApiKeys={() => void handleSaveApiKeys()}
        onDeleteAccount={openDeleteAccountConfirm}
      />
    );
  }

  function renderUploadState() {
    return (
      <UploadPanel parsing={parsing} error={error} notice={notice} onUpload={openFilePicker} />
    );
  }

  function renderReviewState() {
    return (
      <ReviewPanel
        approving={approving}
        transactions={currentTransactions}
        error={error}
        notice={notice}
        visiblePage={visiblePage}
        totalPages={totalPages}
        newTransactionsCount={newTransactionsCount}
        onUpload={openFilePicker}
        onApprove={() => void approveTransactions(() => setShowUploadView(false))}
        onPreviousPage={goToPreviousPage}
        onNextPage={goToNextPage}
      />
    );
  }

  function renderDashboardFrameOverlay() {
    if (!isDashboardStage || !activeUser) {
      return null;
    }

    const showUploadPanel = showUploadView;
    const showSettingsPanel = !showUploadPanel && showSettingsView;
    const showUserSelectPanel = !showUploadPanel && !showSettingsPanel && showUserSelectView;

    if (!showUploadPanel && !showSettingsPanel && !showUserSelectPanel) {
      return null;
    }

    const isClosingPanel = showUploadPanel
      ? isClosingUpload
      : showSettingsPanel
        ? isClosingSettings
        : isClosingUserSelect;

    const closeTitle = showUploadPanel
      ? "Esci dall'importazione"
      : showSettingsPanel
        ? "Esci dalle impostazioni"
        : "Esci dalla selezione utente";

    const handleClosePanel = showUploadPanel
      ? handleCloseUpload
      : showSettingsPanel
        ? handleSettingsPanelClose
        : handleCloseUserSelect;

    const shouldShowClose = !showUploadPanel || activeUser.transactionCount !== 0;
    const panelContent = showUploadPanel
      ? (previewTransactions.length > 0 ? renderReviewState() : renderUploadState())
      : showSettingsPanel
        ? renderSettingsState()
        : renderUserSelectState();

    return (
      <div
        className={cn(
          "absolute inset-0 z-[55] flex h-full w-full flex-col justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)]",
          isClosingPanel ? "upload-panel-exit pointer-events-none" : "upload-panel-enter"
        )}
      >
        {shouldShowClose ? (
          <div
            role="button"
            onClick={handleClosePanel}
            className="absolute right-4 top-4 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
            title={closeTitle}
          >
            <XIcon className="h-5 w-5" strokeWidth={2.3} />
          </div>
        ) : null}
        <div className="relative flex h-full w-full flex-col justify-center px-3 py-3 sm:px-5 sm:py-5">
          {panelContent}
        </div>
      </div>
    );
  }

  function renderStageContent() {
    if (stage === "welcome") {
      const homeOverlay = showUploadView ? (
        <div className={cn("relative h-full w-full flex flex-col justify-center", isClosingUpload ? "upload-panel-exit" : "upload-panel-enter")}>
          {activeUser?.transactionCount !== 0 ? (
            <div
              role="button"
              onClick={handleCloseUpload}
              className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
              title="Close upload panel"
            >
              <XIcon className="h-5 w-5" strokeWidth={2.3} />
            </div>
          ) : null}
          {previewTransactions.length > 0 ? renderReviewState() : renderUploadState()}
        </div>
      ) : showSettingsView ? (
        <div className={cn("relative h-full w-full flex flex-col justify-center", isClosingSettings ? "upload-panel-exit" : "upload-panel-enter")}>
          <div
            role="button"
            onClick={handleSettingsPanelClose}
            className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
            title="Close settings"
          >
            <XIcon className="h-5 w-5" strokeWidth={2.3} />
          </div>
          {renderSettingsState()}
        </div>
      ) : showUserSelectView ? (
        <div className={cn("relative h-full w-full flex flex-col justify-center", isClosingUserSelect ? "upload-panel-exit" : "upload-panel-enter")}>
          <div
            role="button"
            onClick={handleCloseUserSelect}
            className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
            title="Close profile panel"
          >
            <XIcon className="h-5 w-5" strokeWidth={2.3} />
          </div>
          {renderUserSelectState()}
        </div>
      ) : null;

      return (
        <div className="relative h-full w-full">
          <div className="relative h-full w-full">
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
                homeOverlay ? "pointer-events-none opacity-0" : "opacity-100"
              )}
            >
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
                    <button
                      className="group block cursor-pointer select-none space-y-1 text-left"
                      onClick={() => void handleSignOut()}
                      type="button"
                    >
                      <div className="text-2xl font-bold tracking-[-0.06em] text-[color:var(--text-dim)] transition-colors group-hover:text-white md:text-3xl sm:text-[2.2rem]">
                        Log out
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50 transition-colors group-hover:text-[color:var(--text-dim)]">
                        End local session
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
            </div>
            {homeOverlay ? <div className="absolute inset-0">{homeOverlay}</div> : null}
          </div>
        </div>
      );
    }

    if (stage === "select") {
      return renderUserSelectState();
    }

    if (stage === "create") {
      return (
        <div className="mx-auto flex h-full w-full max-w-[1164px] items-center justify-center text-left md:relative md:h-[526px] md:max-h-[526px]">
          <div className="hidden md:absolute md:left-1/4 md:top-1/2 md:block md:w-[320px] md:-translate-x-1/2 md:-translate-y-1/2">
            <div className="space-y-7">
              <h1 className="text-3xl font-bold tracking-[-0.06em] text-white sm:text-[2.35rem]">
                {title}
              </h1>

              <div className="max-w-[250px] space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                  Profile workspace
                </div>
                <p className="text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
                  Use profiles to keep financial workspaces separate. You can add more later to track family finances too.
                </p>
              </div>
            </div>
          </div>

          <div className="hidden h-full w-[2px] shrink-0 self-stretch bg-[color:var(--line-strong)] opacity-30 md:absolute md:left-1/2 md:top-0 md:block" />

          <div className="flex h-full w-full shrink-0 flex-col items-center justify-center space-y-4 py-1 text-center md:absolute md:left-3/4 md:top-1/2 md:h-[108px] md:w-[398px] md:-translate-x-1/2 md:-translate-y-1/2 md:space-y-0 md:py-0">
            <h1 className="text-3xl font-bold tracking-[-0.06em] text-white sm:text-[2.35rem] md:hidden">
              {title}
            </h1>
            <p className="max-w-[300px] text-sm font-medium leading-relaxed text-[color:var(--text-dim)] md:hidden">
              Use profiles to keep financial workspaces separate. Add more later for family finances too.
            </p>

            <div className="w-full max-w-[398px] space-y-3 md:relative md:h-[108px] md:space-y-0">
              <Input
                autoFocus
                className="w-full border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-xl text-white focus:border-white focus:ring-0 sm:h-12"
                maxLength={24}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleCreateUser();
                  }
                }}
                placeholder="Profile"
                value={name}
              />
              <div className="flex min-h-12 w-full justify-center md:absolute md:left-0 md:top-[60px]">
                <button
                  type="button"
                  aria-label="Create profile"
                  className={cn(
                    "flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:border-[color:var(--text-dim)] hover:bg-[color:var(--surface-elevated)] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 has-lucide"
                  )}
                  disabled={saving || !name.trim()}
                  onClick={() => void handleCreateUser()}
                >
                  <PlusIcon className="h-5 w-5" strokeWidth={2.3} />
                </button>
              </div>
              <div className="min-h-4 text-center text-xs font-semibold text-[color:var(--text-dim)] md:absolute md:left-0 md:top-[calc(100%+0.75rem)] md:w-full">
                {saving ? <span>Saving...</span> : null}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (stage === "settings") {
      return renderSettingsState();
    }

    return null;
  }

  function renderDeleteAccountDialog() {
    if (!showDeleteAccountConfirm) {
      return null;
    }

    const canSubmitDeleteAccount = hasLocalPasswordInput(deleteAccountPassword);

    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          className="relative flex w-full max-w-[460px] flex-col gap-5 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-shell)] p-5 shadow-2xl sm:p-6"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={closeDeleteAccountConfirm}
            disabled={isDeletingAccount}
            className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-40"
          >
            <XIcon className="h-5 w-5" strokeWidth={2.3} />
          </button>

          <div className="space-y-2 pr-8">
            <h2 id="delete-account-title" className="text-xl font-bold uppercase tracking-[-0.04em] text-[color:var(--danger)]">
              Delete account
            </h2>
            <p className="text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
              This permanently removes every profile, transaction, Binance balance and cached price tied to this account.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
              Password
            </label>
            <Input
              autoFocus
              value={deleteAccountPassword}
              onChange={(event) => setDeleteAccountPassword(event.target.value)}
              disabled={isDeletingAccount}
              className="w-full border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-white focus:border-white focus:ring-0"
              autoComplete="current-password"
              placeholder="Enter your password"
              type="password"
            />
          </div>

          {error ? (
            <div className="text-xs font-semibold text-[color:var(--danger)]">{error}</div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDeleteAccountConfirm}
              disabled={isDeletingAccount}
              className="flex h-11 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] px-5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-dim)] transition-colors hover:border-white hover:bg-[color:var(--surface-elevated)] hover:text-white disabled:pointer-events-none disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              disabled={!canSubmitDeleteAccount || isDeletingAccount}
              className="flex h-11 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] px-5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--danger)] transition-colors hover:border-red-400 hover:bg-[color:var(--surface-elevated)] hover:text-red-400 disabled:pointer-events-none disabled:opacity-40"
            >
              {isDeletingAccount ? "Deleting..." : "Delete account"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSignedOut) {
    return <AuthShell />;
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
              <div className="flex h-16 w-full items-center justify-between rounded-[22px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-shell)] px-3">
                <div id="dashboard-tabs-portal" className="flex h-full min-w-0 flex-1 items-center overflow-x-auto hide-scrollbar mr-3" />
                {activeUser ? (
                  <button
                    aria-label="Add document"
                    className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] text-[color:var(--text-main)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985] has-lucide"
                    data-active={showUploadView || activeUser.transactionCount === 0 ? "true" : "false"}
                    onClick={handlePlusClick}
                    type="button"
                  >
                    <PlusIcon className="h-5 w-5" strokeWidth={2.3} />
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          <aside
            className="order-3 flex h-[88px] w-full flex-row items-center justify-between rounded-[22px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-shell)] p-3 transition-all duration-500 ease-out md:order-none md:row-start-2 md:h-auto md:w-auto md:flex-col md:justify-between md:translate-x-0 md:opacity-100"
          >
            <div className="hidden md:flex md:flex-col md:gap-2">
              <button
                aria-label="Home"
                className={cn(
                  "flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985] has-lucide",
                  stage === "welcome"
                    ? "border-white text-white"
                    : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                )}
                onClick={navigateHome}
                data-active={stage === "welcome"}
                title="Home"
                type="button"
              >
                <House className="h-5 w-5" strokeWidth={2.3} />
              </button>
              {activeUser && (
                <button
                  aria-label="Dashboard"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "dashboard"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("dashboard")}
                  data-active={stage === "dashboard"}
                  type="button"
                >
                  <ChartPie className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.checkingCount > 0 && (
                <button
                  aria-label="Checking"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "checking"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("checking")}
                  data-active={stage === "checking"}
                  type="button"
                >
                  <Landmark className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.investmentCount > 0 && (
                <button
                  aria-label="Investments"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "investment"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("investment")}
                  data-active={stage === "investment"}
                  type="button"
                >
                  <Wallet className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.cryptoCount > 0 && (
                <button
                  aria-label="Crypto"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "crypto"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("crypto")}
                  data-active={stage === "crypto"}
                  type="button"
                >
                  <Coins className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
            </div>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--text-dim)] md:hidden">
              {activeUser ? activeUser.name : title}
            </div>
            <div className="flex gap-2 md:flex-col">
              <button
                aria-label="Home"
                className={cn(
                  "flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985] md:hidden has-lucide",
                  stage === "welcome"
                    ? "border-white text-white"
                    : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                )}
                onClick={navigateHome}
                data-active={stage === "welcome"}
                title="Home"
                type="button"
              >
                <House className="h-5 w-5" strokeWidth={2.3} />
              </button>
              {activeUser && (
                <button
                  aria-label="Dashboard"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer md:hidden",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "dashboard"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("dashboard")}
                  data-active={stage === "dashboard"}
                  type="button"
                >
                  <ChartPie className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.checkingCount > 0 && (
                <button
                  aria-label="Checking"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer md:hidden",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "checking"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("checking")}
                  data-active={stage === "checking"}
                  type="button"
                >
                  <Landmark className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.investmentCount > 0 && (
                <button
                  aria-label="Investments"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer md:hidden",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "investment"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("investment")}
                  data-active={stage === "investment"}
                  type="button"
                >
                  <Wallet className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.cryptoCount > 0 && (
                <button
                  aria-label="Crypto"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer md:hidden",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "crypto"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("crypto")}
                  data-active={stage === "crypto"}
                  type="button"
                >
                  <Coins className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && (activeUser.hasBinanceCredentials || binanceFading) && (
                <button
                  aria-label="Binance"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-300 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    binanceFading
                      ? "opacity-0 pointer-events-none scale-90"
                      : stage === "binance"
                        ? "border-white text-white"
                        : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("binance")}
                  data-active={stage === "binance"}
                  type="button"
                >
                  <Bitcoin className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && (
                <button
                  aria-label="Settings"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    showSettingsView
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={handleSettingsNavClick}
                  data-active={showSettingsView}
                  type="button"
                >
                  <Settings className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {hasUsers && (
                <button
                  aria-label="Select profile"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    (showUserSelectView || stage === "select")
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={handleUserSelectClick}
                  data-active={showUserSelectView || stage === "select"}
                  type="button"
                >
                  {activeUser ? <span className="text-xl font-extrabold initials">{getInitials(activeUser.name)}</span> : <UserIcon className="h-6 w-6" />}
                </button>
              )}
            </div>
          </aside>

          <section 
            className="order-2 flex min-h-0 md:order-none md:row-start-2"
            onClick={() => {
              setNotice(null);
              setError(null);
            }}
          >
            <div className="relative flex min-h-0 w-full overflow-hidden rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)]">
              {importOverlayVisible && (
                <div
                  className="absolute inset-0 z-[60] flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)]"
                  style={{
                    opacity: importOverlayFadingOut ? 0 : 1,
                    transition: importOverlayFadingOut ? "opacity 550ms cubic-bezier(0.4,0,0.2,1)" : "opacity 180ms ease",
                    pointerEvents: importOverlayFadingOut ? "none" : "all"
                  }}
                >
                  <style dangerouslySetInnerHTML={{ __html: `@keyframes importSpinner { to { transform: rotate(360deg); } }` }} />
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: "2.5px solid rgba(255,255,255,0.07)",
                      borderTopColor: "rgba(255,255,255,0.5)",
                      animation: "importSpinner 0.85s linear infinite"
                    }}
                  />
                </div>
              )}
              <input
                ref={fileInputRef}
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-hidden="true"
                style={{ display: "none" }}
                onChange={(event) => void handleFileSelection(event)}
                type="file"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent_22%)]" />
              {renderDashboardFrameOverlay()}
              <div className="relative flex w-full min-h-0 items-center justify-center p-3 sm:p-5">
                <div className="h-full w-full max-w-none">
                  <div className="relative flex h-full min-h-0 flex-col justify-center">
                    {activeUser ? (
                      <div className={cn("absolute inset-0", isDashboardStage ? "z-10" : "z-0 pointer-events-none opacity-0 invisible")}>
                        <Dashboard
                          isActive={stage === "dashboard"}
                          shouldLoad={activeUser.transactionCount > 0 || stage === "dashboard"}
                          key={`dashboard-${activeUser.id}`}
                          userId={activeUser.id}
                          binanceRefreshKey={binanceRefreshKey}
                          onImportRefreshComplete={stage === "dashboard" ? handleImportRefreshComplete : undefined}
                          checkingCount={activeUser.checkingCount}
                          investmentCount={activeUser.investmentCount}
                          cryptoCount={activeUser.cryptoCount}
                          transactionCount={activeUser.transactionCount}
                        />
                        {activeUser.checkingCount > 0 && (
                          <CheckingDashboard
                            isActive={stage === "checking"}
                            shouldLoad
                            key={`checking-${activeUser.id}`}
                            userId={activeUser.id}
                            onImportRefreshComplete={stage === "checking" ? handleImportRefreshComplete : undefined}
                            transactionCount={activeUser.transactionCount}
                          />
                        )}
                        {activeUser.investmentCount > 0 && (
                          <InvestmentDashboard
                            isActive={stage === "investment"}
                            shouldLoad
                            key={`investment-${activeUser.id}`}
                            userId={activeUser.id}
                            onImportRefreshComplete={stage === "investment" ? handleImportRefreshComplete : undefined}
                            transactionCount={activeUser.transactionCount}
                          />
                        )}
                        {activeUser.cryptoCount > 0 && (
                          <CryptoDashboard
                            isActive={stage === "crypto"}
                            shouldLoad
                            key={`crypto-${activeUser.id}`}
                            userId={activeUser.id}
                            onImportRefreshComplete={stage === "crypto" ? handleImportRefreshComplete : undefined}
                            transactionCount={activeUser.transactionCount}
                          />
                        )}
                        {activeUser.hasBinanceCredentials && (
                          <BinanceDashboard
                            isActive={stage === "binance"}
                            shouldLoad
                            key={`binance-${activeUser.id}`}
                            userId={activeUser.id}
                            transactionCount={activeUser.transactionCount}
                          />
                        )}
                      </div>
                    ) : null}

                    {!isDashboardStage ? (
                      <>
                        {renderStageContent()}
                        {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
                        {notice ? <p className="text-sm text-emerald-200">{notice}</p> : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>



              {stage === "create" && hasUsers ? (
                <button
                  className="absolute left-4 bottom-4 cursor-pointer border-0 bg-transparent px-2 py-1 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-dim)] shadow-none transition-colors hover:text-white"
                  onClick={goBackToSelection}
                  type="button"
                >
                  &lt;&lt; Back
                </button>
              ) : null}
            </div>
          </section>
          
          <div id="dashboard-cards-portal" className="order-4 md:col-start-2 md:row-start-3" />
        </section>
      </div>
      {renderDeleteAccountDialog()}
    </main>
  );
}
