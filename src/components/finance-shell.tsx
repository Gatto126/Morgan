"use client";

import { useRef, useState, useEffect, useLayoutEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "./auth-shell";
import {
  FrameOverlayPanels,
  frameOverlayPanelMotionDurationMs,
  resolveFrameOverlayPanel,
  type ExitingFrameOverlayPanelConfig,
  type FrameOverlayPanelConfig
} from "./finance-shell/frame-overlay-panels";
import { FinanceShellMainFrame } from "./finance-shell/main-frame";
import { ReviewPanel } from "./finance-shell/review-panel";
import { DeleteAccountDialog } from "./finance-shell/delete-account-dialog";
import { getDeleteAccountDialogResetState } from "./finance-shell/delete-account-dialog-helpers";
import { EmptyChartAction } from "./finance-shell/empty-chart-action";
import { SettingsPanel, type SettingsSection } from "./finance-shell/settings-panel";
import type { UserRecord } from "./finance-shell/types";
import { UploadPanel } from "./finance-shell/upload-panel";
import { useFinanceNavigation, type Stage } from "./finance-shell/use-finance-navigation";
import { useInertElements, useModalFocusTrap } from "./finance-shell/use-modal-accessibility";
import { useTransactionImport, type ImportedTransactionCounts } from "./finance-shell/use-transaction-import";
import { UserSelectPanel } from "./finance-shell/user-select-panel";
import PlusIcon from "./ui/plus-icon";

import { Input } from "@/components/ui/input";
import { authClient } from "@/client/auth-client";
import { cn } from "@/shared/utils";

const dashboardStages = new Set<Stage>(["dashboard", "checking", "investment", "binance", "crypto"]);
const restorableStages = new Set<Stage>(["welcome", "select", "create", "dashboard", "checking", "investment", "settings", "binance", "crypto"]);

function isRestorableStage(value: string | null): value is Stage {
  return value !== null && restorableStages.has(value as Stage);
}

function resolveRestoredStage(savedStage: string | null) {
  if (!isRestorableStage(savedStage) || savedStage === "select" || savedStage === "create") {
    return "dashboard" as Stage;
  }

  return savedStage;
}

function resolveInitialFinanceState(initialUsers: UserRecord[]) {
  const onlyUser = initialUsers.length === 1 ? initialUsers[0] : null;

  if (onlyUser) {
    return {
      activeUser: onlyUser,
      showUploadView: false,
      stage: "dashboard" as Stage
    };
  }

  return {
    activeUser: null,
    showUploadView: false,
    stage: initialUsers.length > 0 ? "welcome" as Stage : "create" as Stage
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
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [binanceFading, setBinanceFading] = useState(false);
  const [forceApiSettingsSection, setForceApiSettingsSection] = useState(false);
  const appContentRef = useRef<HTMLDivElement | null>(null);
  const dashboardTabsPortalRef = useRef<HTMLDivElement | null>(null);
  const dashboardBackgroundRef = useRef<HTMLDivElement | null>(null);
  const dashboardCardsPortalRef = useRef<HTMLDivElement | null>(null);
  const activeOverlayPanelRef = useRef<HTMLDivElement | null>(null);
  const welcomeBackgroundRef = useRef<HTMLDivElement | null>(null);
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
    hasUsers: users.length > 0,
    resetPreview,
    clearApiKeyDraft,
    clearPanelFeedback
  });
  const isDashboardStage = dashboardStages.has(stage);
  const isDashboardPanelModalOpen =
    isDashboardStage && !!activeUser && (showUploadView || showSettingsView || showUserSelectView);
  const isWelcomePanelModalOpen =
    stage === "welcome" && (showUploadView || showSettingsView || showUserSelectView);
  const isPanelModalOpen = isDashboardPanelModalOpen || isWelcomePanelModalOpen;
  const isOverlayPanelClosing =
    (showUploadView && isClosingUpload) ||
    (showSettingsView && isClosingSettings) ||
    (showUserSelectView && isClosingUserSelect);
  const isDashboardBackgroundVisible = !isDashboardPanelModalOpen || isOverlayPanelClosing;
  const isWelcomeBackgroundVisible = !isWelcomePanelModalOpen || isOverlayPanelClosing;
  const activePanelFocusKey = isDashboardPanelModalOpen
    ? `dashboard:${showUploadView ? "upload" : showSettingsView ? "settings" : "profile"}`
    : isWelcomePanelModalOpen
      ? `welcome:${showUploadView ? "upload" : showSettingsView ? "settings" : "profile"}`
      : "closed";
  const shellPanelBackgroundRefs = useMemo(
    () => [dashboardTabsPortalRef, dashboardCardsPortalRef],
    []
  );
  const dashboardPanelBackgroundRefs = useMemo(
    () => [dashboardBackgroundRef],
    []
  );
  const welcomePanelBackgroundRefs = useMemo(
    () => [welcomeBackgroundRef],
    []
  );
  const deleteDialogBackgroundRefs = useMemo(
    () => [appContentRef],
    []
  );
  const activeFramePanel = resolveFrameOverlayPanel({
    activeUserPresent: !!activeUser,
    isClosingSettings,
    isClosingUpload,
    isClosingUserSelect,
    isDashboardStage,
    renderSettingsContent: renderSettingsState,
    renderUploadContent: () => previewTransactions.length > 0 ? renderReviewState() : renderUploadState(),
    renderUserSelectContent: renderUserSelectState,
    showSettingsView,
    showUploadView,
    showUserSelectView,
    stage,
    onCloseSettings: handleSettingsPanelClose,
    onCloseUpload: handleCloseUpload,
    onCloseUserSelect: handleCloseUserSelect
  });
  const previousFramePanelRef = useRef<FrameOverlayPanelConfig | null>(null);
  const exitingFramePanelTimerRef = useRef<number | null>(null);
  const pendingUserSelectionTimerRef = useRef<number | null>(null);
  const exitingFramePanelIdRef = useRef(0);
  const [exitingFramePanel, setExitingFramePanel] = useState<ExitingFrameOverlayPanelConfig | null>(null);

  useModalFocusTrap({
    active: isPanelModalOpen && !showDeleteAccountConfirm,
    containerRef: activeOverlayPanelRef,
    focusKey: activePanelFocusKey,
    onEscape: closeActiveOverlayPanel
  });
  useInertElements(isPanelModalOpen, shellPanelBackgroundRefs);
  useInertElements(isDashboardPanelModalOpen, dashboardPanelBackgroundRefs);
  useInertElements(isWelcomePanelModalOpen, welcomePanelBackgroundRefs);
  useInertElements(showDeleteAccountConfirm, deleteDialogBackgroundRefs);

  useLayoutEffect(() => {
    const previousFramePanel = previousFramePanelRef.current;
    const previousKey = previousFramePanel?.key ?? null;
    const currentKey = activeFramePanel?.key ?? null;

    if (previousFramePanel && previousKey !== currentKey && currentKey === null && !previousFramePanel.isClosingPanel) {
      if (exitingFramePanelTimerRef.current) {
        window.clearTimeout(exitingFramePanelTimerRef.current);
      }

      const exitId = `${previousFramePanel.key}:exit:${exitingFramePanelIdRef.current}`;
      exitingFramePanelIdRef.current += 1;
      setExitingFramePanel({ ...previousFramePanel, exitId });
      exitingFramePanelTimerRef.current = window.setTimeout(() => {
        exitingFramePanelTimerRef.current = null;
        setExitingFramePanel(null);
      }, frameOverlayPanelMotionDurationMs);
    } else if (!activeFramePanel && previousFramePanel?.isClosingPanel && exitingFramePanel) {
      setExitingFramePanel(null);
    }

    previousFramePanelRef.current = activeFramePanel;
  }, [activeFramePanel, exitingFramePanel]);

  useEffect(() => {
    return () => {
      if (exitingFramePanelTimerRef.current) {
        window.clearTimeout(exitingFramePanelTimerRef.current);
      }
      if (pendingUserSelectionTimerRef.current) {
        window.clearTimeout(pendingUserSelectionTimerRef.current);
        pendingUserSelectionTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (showCreateUserSubmenu && createUserInputRef.current) {
      const timer = setTimeout(() => {
        createUserInputRef.current?.focus({ preventScroll: true });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showCreateUserSubmenu]);

  useEffect(() => {
    if (previewTransactions.length === 0) {
      return;
    }

    setShowUploadView(true);
    setShowSettingsView(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    setActiveSettingsSection(null);
  }, [
    previewTransactions.length,
    setActiveSettingsSection,
    setShowUploadView,
    setShowUserSelectView,
    setShowCreateUserSubmenu,
    setShowSettingsView
  ]);

  useEffect(() => {
    let cancelled = false;

    const restoreTimer = window.setTimeout(() => {
      try {
        const savedUserId = localStorage.getItem("morgan_active_user");
        const savedStage = localStorage.getItem("morgan_stage");
        const savedUser = savedUserId ? initialUsers.find((user) => user.id === savedUserId) ?? null : null;

        if (!cancelled && savedUser) {
          const restoredStage = resolveRestoredStage(savedStage);

          setActiveUser(savedUser);
          setShowUploadView(false);
          setStage(restoredStage);
          setActiveSettingsSection(restoredStage === "settings" ? "general" : null);
        } else if (!cancelled && initialUsers.length > 0 && initialUsers.length !== 1) {
          setShowUploadView(false);
          setStage("select");
          setActiveSettingsSection(null);
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
      setForceApiSettingsSection(true);
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
  const isRestoringProfileSelection = initialUsers.length > 1 && !hasRestoredClientState && !activeUser;
  const title = isRestoringProfileSelection ? "Morgan" : getStageTitle(stage, hasUsers);

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

  function commitUserSelection(user: UserRecord) {
    setActiveUser(user);
    resetPreview();
    setIsClosingUserSelect(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    setShowSettingsView(false);
    setActiveSettingsSection(null);
    clearPanelFeedback();
    clearApiKeyDraft();
    setShowUploadView(false);
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
      setShowUploadView(false);
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
    const resetState = getDeleteAccountDialogResetState();

    setDeleteAccountPassword(resetState.password);
    setDeleteAccountError(resetState.error);
    setShowDeleteAccountConfirm(true);
    setError(null);
    setNotice(null);
  }

  function handleUserSelect(user: UserRecord) {
    if (activeUser?.id === user.id) {
      return;
    }

    if (pendingUserSelectionTimerRef.current) {
      window.clearTimeout(pendingUserSelectionTimerRef.current);
      pendingUserSelectionTimerRef.current = null;
    }

    if (showUserSelectView) {
      handleCloseUserSelect();
      pendingUserSelectionTimerRef.current = window.setTimeout(() => {
        pendingUserSelectionTimerRef.current = null;
        commitUserSelection(user);
      }, frameOverlayPanelMotionDurationMs);
      return;
    }

    commitUserSelection(user);
  }

  function closeDeleteAccountConfirm() {
    if (isDeletingAccount) return;

    setShowDeleteAccountConfirm(false);
    const resetState = getDeleteAccountDialogResetState();
    setDeleteAccountPassword(resetState.password);
    setDeleteAccountError(resetState.error);
  }

  async function handleDeleteAccount() {
    if (isDeletingAccount) return;

    try {
      setIsDeletingAccount(true);
      setDeleteAccountError(null);
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
      const resetState = getDeleteAccountDialogResetState();
      setDeleteAccountPassword(resetState.password);
      setDeleteAccountError(resetState.error);
      router.refresh();
    } catch (err) {
      setDeleteAccountError(err instanceof Error ? err.message : "Error during account deletion.");
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
      setForceApiSettingsSection(false);
    }
    toggleSettingsSection(section);
  }

  function handleSettingsPanelClose() {
    setForceApiSettingsSection(false);
    handleCloseSettings();
  }

  function handleSettingsNavClick() {
    setForceApiSettingsSection(false);
    handleSettingsClick();
  }

  function closeActiveOverlayPanel() {
    if (showUploadView) {
      handleCloseUpload();
      return;
    }

    if (showSettingsView) {
      handleSettingsPanelClose();
      return;
    }

    if (showUserSelectView) {
      handleCloseUserSelect();
    }
  }

  function renderSettingsState() {
    const isApiKeySaved = !!activeUser?.hasBinanceCredentials;
    const visibleSettingsSection =
      forceApiSettingsSection && showSettingsView ? "apiKey" : activeSettingsSection;

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
          setForceApiSettingsSection(false);
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

  function renderInlineUploadState() {
    return (
      <EmptyChartAction
        actionLabel={parsing ? "Loading" : "Upload"}
        disabled={parsing}
        error={error}
        notice={notice}
        onAction={openFilePicker}
        title="Upload"
      />
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

  function renderMainFrameOverlay() {
    return (
      <FrameOverlayPanels
        activePanel={activeFramePanel}
        activePanelRef={activeOverlayPanelRef}
        exitingPanel={exitingFramePanel}
      />
    );
  }

  function renderStageContent() {
    if (isRestoringProfileSelection) {
      return null;
    }

    if (stage === "welcome") {
      return (
        <div className="relative h-full w-full">
          <div className="relative h-full w-full">
            <div
              ref={welcomeBackgroundRef}
              aria-hidden={isWelcomePanelModalOpen ? "true" : undefined}
              data-panel-background="welcome"
              data-visible={isWelcomeBackgroundVisible ? "true" : "false"}
              className={cn(
                "panel-content-reveal absolute inset-0 flex items-center justify-center",
                isWelcomePanelModalOpen && "pointer-events-none"
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

  if (isSignedOut) {
    return <AuthShell />;
  }

  const canUseHeaderUploadButton = (activeUser?.transactionCount ?? 0) > 0;
  const isUploadButtonActive = canUseHeaderUploadButton && showUploadView;
  const nonDashboardStageContent = !isDashboardStage ? (
    <>
      {renderStageContent()}
      {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-200">{notice}</p> : null}
    </>
  ) : null;

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-[color:var(--page-bg)] text-[color:var(--text-main)]"
      data-finance-shell-ready={hasRestoredClientState ? "true" : "false"}
      data-profile-restore-pending={isRestoringProfileSelection ? "true" : "false"}
    >
      <FinanceShellMainFrame
        activeUser={activeUser}
        appContentRef={appContentRef}
        binanceFading={binanceFading}
        binanceRefreshKey={binanceRefreshKey}
        canUseHeaderUploadButton={canUseHeaderUploadButton}
        dashboardBackgroundRef={dashboardBackgroundRef}
        dashboardCardsPortalRef={dashboardCardsPortalRef}
        dashboardTabsPortalRef={dashboardTabsPortalRef}
        fileInputRef={fileInputRef}
        hasUsers={hasUsers}
        importOverlayFadingOut={importOverlayFadingOut}
        importOverlayVisible={importOverlayVisible}
        isDashboardBackgroundVisible={isDashboardBackgroundVisible}
        isDashboardStage={isDashboardStage}
        isUploadButtonActive={isUploadButtonActive}
        nonDashboardStageContent={nonDashboardStageContent}
        renderInlineUploadState={renderInlineUploadState}
        renderMainFrameOverlay={renderMainFrameOverlay}
        showSettingsView={showSettingsView}
        showUserSelectView={showUserSelectView}
        stage={stage}
        title={title}
        onBackToSelection={goBackToSelection}
        onFileSelection={(event) => void handleFileSelection(event)}
        onFrameClick={() => {
          setNotice(null);
          setError(null);
        }}
        onHeaderUploadClick={handlePlusClick}
        onHomeClick={navigateHome}
        onImportRefreshComplete={handleImportRefreshComplete}
        onNavigate={navigateTo}
        onProfileClick={handleUserSelectClick}
        onSettingsClick={handleSettingsNavClick}
      />
      <DeleteAccountDialog
        error={deleteAccountError}
        isDeleting={isDeletingAccount}
        isOpen={showDeleteAccountConfirm}
        onClose={closeDeleteAccountConfirm}
        onPasswordChange={setDeleteAccountPassword}
        onSubmit={() => void handleDeleteAccount()}
        password={deleteAccountPassword}
      />
    </main>
  );
}
