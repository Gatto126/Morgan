"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { AuthShell } from "./auth-shell";
import {
  fetchDashboardStageData,
  seedDashboardStageDataCache
} from "./finance-shell/dashboard-stage-data-cache";
import {
  getDashboardStageDataVersion,
  isDashboardStageKey,
  resolveVisibleDashboardStage,
  type DashboardStageKey
} from "./finance-shell/dashboard-stage-items";
import { FrameOverlayPanels } from "./finance-shell/frame-overlay-panels";
import { FinanceShellMainFrame } from "./finance-shell/main-frame";
import { DeleteAccountDialog } from "./finance-shell/delete-account-dialog";
import type { PersistedFinanceSelection } from "./finance-shell/persistence-state";
import type { SettingsSection } from "./finance-shell/settings-panel";
import { useFinanceShellContent } from "./finance-shell/use-finance-shell-content";
import type { UserRecord } from "./finance-shell/types";
import { useFinanceAccountActions } from "./finance-shell/use-finance-account-actions";
import { useCreateUserInputFocus, usePreviewUploadOverlay } from "./finance-shell/use-finance-shell-effects";
import {
  resolveInitialFinanceState,
  useFinanceProfiles
} from "./finance-shell/use-finance-profiles";
import { useFrameOverlayLifecycle } from "./finance-shell/use-frame-overlay-lifecycle";
import { useFinanceNavigation } from "./finance-shell/use-finance-navigation";
import { useTransactionImport, type ImportedTransactionCounts } from "./finance-shell/use-transaction-import";
import { dashboardStages, getStageTitle } from "./finance-shell/stage-title";
import { warmImportedProfileData } from "./finance-shell/import-data-warmup";

export type PrimedDashboardStageData = {
  data: unknown;
  stage: DashboardStageKey;
  userId: string;
  version: number;
};

function getSuggestedFirstProfileName(accountName: string) {
  const trimmedName = accountName.trim();
  const emailLocalPart = trimmedName.includes("@") ? trimmedName.split("@")[0] : trimmedName;
  return emailLocalPart.trim().slice(0, 24);
}

export function FinanceShell({
  accountName,
  initialDashboardStageData,
  initialSelection,
  initialUsers
}: {
  accountName: string;
  initialDashboardStageData?: PrimedDashboardStageData | null;
  initialSelection?: PersistedFinanceSelection | null;
  initialUsers: UserRecord[];
}) {
  const [initialFinanceState] = useState(() => resolveInitialFinanceState(initialUsers, initialSelection ?? null));
  const [hasSeededInitialStageData] = useState(() => {
    if (initialDashboardStageData) {
      seedDashboardStageDataCache(
        initialDashboardStageData.stage,
        initialDashboardStageData.userId,
        initialDashboardStageData.version,
        initialDashboardStageData.data as never
      );
    }

    return true;
  });
  void hasSeededInitialStageData;
  const suggestedFirstProfileName = initialUsers.length === 0 ? getSuggestedFirstProfileName(accountName) : "";
  const [hasRestoredClientState, setHasRestoredClientState] = useState(initialFinanceState.restoredFromServer);
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [activeUser, setActiveUser] = useState<UserRecord | null>(initialFinanceState.activeUser);
  const [saving, setSaving] = useState(false);
  const {
    binanceFading,
    binanceRefreshKey,
    clearApiKeyDraft,
    clearForcedApiSettingsSection,
    clearPanelFeedback,
    closeDeleteAccountConfirm,
    deleteAccountError,
    deleteAccountPassword,
    error,
    getVisibleSettingsSection,
    handleDeleteAccount,
    handleDeleteApiKeys,
    handleSaveApiKeys,
    handleSignOut,
    isDeletingAccount,
    isSignedOut,
    isTesting,
    notice,
    openDeleteAccountConfirm,
    setDeleteAccountPassword,
    setError,
    setNotice,
    setShowDeleteApiConfirm,
    setShowSecret,
    showDeleteAccountConfirm,
    showDeleteApiConfirm,
    showSecret
  } = useFinanceAccountActions({
    activeUser,
    onBinanceCredentialsDeleted: handleBinanceCredentialsDeleted,
    showApiSettingsPanel,
    setActiveUser,
    setUsers
  });
  const appContentRef = useRef<HTMLDivElement | null>(null);
  const dashboardTabsPortalRef = useRef<HTMLDivElement | null>(null);
  const dashboardBackgroundRef = useRef<HTMLDivElement | null>(null);
  const dashboardCardsPortalRef = useRef<HTMLDivElement | null>(null);
  const activeOverlayPanelRef = useRef<HTMLDivElement | null>(null);
  const welcomeBackgroundRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createUserInputRef = useRef<HTMLInputElement | null>(null);
  const importedTransactionsHandlerRef = useRef<((counts: ImportedTransactionCounts) => Promise<void>) | null>(null);
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
    onImportedTransactions: (counts) => importedTransactionsHandlerRef.current?.(counts)
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
  const {
    applyImportedTransactionCounts,
    deletingProfileId,
    goBackToSelection,
    handleCreateUser,
    handleDeleteProfile,
    handleToggleCreateUser,
    handleUserSelect,
    hasUsers,
    isRestoringProfileSelection
  } = useFinanceProfiles({
    activeUser,
    hasRestoredClientState,
    initialUsers,
    skipClientRestore: initialFinanceState.restoredFromServer,
    saving,
    showUserSelectView,
    stage,
    users,
    clearApiKeyDraft,
    clearPanelFeedback,
    handleCloseUserSelect,
    resetPreview,
    setActiveSettingsSection,
    setActiveUser,
    setError,
    setHasRestoredClientState,
    setIsClosingUserSelect,
    setNotice,
    setSaving,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView,
    setStage,
    setUsers
  });
  useEffect(() => {
    importedTransactionsHandlerRef.current = async (counts) => {
      const userBeforeImport = activeUser;

      applyImportedTransactionCounts(counts);
      if (!userBeforeImport) {
        return;
      }

      await warmImportedProfileData(userBeforeImport, counts, { binanceRefreshKey });
    };

    return () => {
      importedTransactionsHandlerRef.current = null;
    };
  }, [activeUser, applyImportedTransactionCounts, binanceRefreshKey]);
  const isDashboardStage = dashboardStages.has(stage);
  const title = isRestoringProfileSelection ? "Morgan" : getStageTitle(stage, hasUsers);
  const warmupDelayMs = 0;
  const visibleSettingsSection = getVisibleSettingsSection(activeSettingsSection, showSettingsView);
  const shellContent = useFinanceShellContent({
    accountName,
    activeSection: visibleSettingsSection,
    activeUser,
    approving,
    createInputRef: createUserInputRef,
    deletingProfileId,
    currentTransactions,
    error,
    isDashboardStage,
    isRestoringProfileSelection,
    isTesting,
    initialProfileName: suggestedFirstProfileName,
    newTransactionsCount,
    notice,
    parsing,
    previewTransactionCount: previewTransactions.length,
    saving,
    showCreateUserSubmenu,
    showDeleteApiConfirm,
    showSecret,
    stage,
    title,
    totalPages,
    users,
    visiblePage,
    welcomeBackgroundRef,
    onApproveTransactions: () => void approveTransactions(() => setShowUploadView(false)),
    onBackToSettingsMenu: handleSettingsBackToMenu,
    onCloseCreate: () => setShowCreateUserSubmenu(false),
    onCreateUser: (profileName) => void handleCreateUser(profileName),
    onDeleteAccount: openDeleteAccountConfirm,
    onDeleteApiKeys: (deleteData) => void handleDeleteApiKeys(deleteData),
    onDeleteProfile: (profile) => void handleDeleteProfile(profile),
    onNextPage: goToNextPage,
    onOpenFilePicker: openFilePicker,
    onPreviousPage: goToPreviousPage,
    onSaveApiKeys: (apiKey, apiSecret) => void handleSaveApiKeys(apiKey, apiSecret),
    onSelectSettingsSection: handleSettingsSectionSelect,
    onSelectUser: handleUserSelect,
    onSignOut: () => void handleSignOut(),
    onToggleCreate: handleToggleCreateUser,
    onToggleDeleteApiConfirm: () => setShowDeleteApiConfirm((value) => !value),
    onToggleSecret: () => setShowSecret((value) => !value)
  });
  const {
    activeFramePanel,
    exitingFramePanel,
    isDashboardBackgroundVisible,
    isWelcomeBackgroundVisible,
    isWelcomePanelModalOpen
  } = useFrameOverlayLifecycle({
    activeOverlayPanelRef,
    activeUserPresent: !!activeUser,
    appContentRef,
    dashboardBackgroundRef,
    dashboardCardsPortalRef,
    dashboardTabsPortalRef,
    isClosingSettings,
    isClosingUpload,
    isClosingUserSelect,
    isDashboardStage,
    renderSettingsContent: shellContent.renderSettingsContent,
    renderUploadContent: shellContent.renderUploadContent,
    renderUserSelectContent: shellContent.renderUserSelectContent,
    showDeleteAccountConfirm,
    showSettingsView,
    showUploadView,
    showUserSelectView,
    stage,
    welcomeBackgroundRef,
    onCloseActiveOverlayPanel: closeActiveOverlayPanel,
    onCloseSettings: handleSettingsPanelClose,
    onCloseUpload: handleCloseUpload,
    onCloseUserSelect: handleCloseUserSelect
  });
  useCreateUserInputFocus(showCreateUserSubmenu, createUserInputRef);
  usePreviewUploadOverlay({
    previewTransactionCount: previewTransactions.length,
    setActiveSettingsSection,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView
  });

  function showApiSettingsPanel() {
    setShowSettingsView(true);
    setActiveSettingsSection("apiKey");
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
  }

  function handleBinanceCredentialsDeleted() {
    if (stage === "binance") {
      setStage("dashboard");
    }
  }

  function handleSettingsSectionSelect(section: SettingsSection) {
    if (section !== "apiKey") {
      clearForcedApiSettingsSection();
    }
    toggleSettingsSection(section);
  }

  function handleSettingsBackToMenu() {
    clearForcedApiSettingsSection();
    clearPanelFeedback();
    setActiveSettingsSection(null);
  }

  function handleSettingsPanelClose() {
    clearForcedApiSettingsSection();
    handleCloseSettings();
  }

  function handleSettingsNavClick() {
    clearForcedApiSettingsSection();
    handleSettingsClick();
  }

  const navigateToStableStage = useCallback((newStage: Parameters<typeof navigateTo>[0]) => {
    navigateTo(newStage);

    if (!activeUser || !isDashboardStageKey(newStage)) {
      return;
    }

    const stageKey = resolveVisibleDashboardStage(newStage, activeUser);
    const version = getDashboardStageDataVersion(stageKey, activeUser, binanceRefreshKey);

    void fetchDashboardStageData(stageKey, activeUser.id, { version }).catch(() => {
      // The destination dashboard owns the visible error state.
    });
  }, [activeUser, binanceRefreshKey, navigateTo]);

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

  if (isSignedOut) {
    return <AuthShell />;
  }

  const canUseHeaderUploadButton = (activeUser?.transactionCount ?? 0) > 0;
  const isUploadButtonActive = canUseHeaderUploadButton && showUploadView;
  const nonDashboardStageContent = shellContent.renderNonDashboardStageContent({
    isWelcomeBackgroundVisible,
    isWelcomePanelModalOpen
  });

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
        renderInlineUploadState={shellContent.renderInlineUploadState}
        renderMainFrameOverlay={() => (
          <FrameOverlayPanels
            activePanel={activeFramePanel}
            activePanelRef={activeOverlayPanelRef}
            exitingPanel={exitingFramePanel}
          />
        )}
        showSettingsView={showSettingsView}
        showUserSelectView={showUserSelectView}
        stage={stage}
        title={title}
        warmupDelayMs={warmupDelayMs}
        onBackToSelection={goBackToSelection}
        onFileSelection={(event) => void handleFileSelection(event)}
        onFrameClick={() => {
          setNotice(null);
          setError(null);
        }}
        onHeaderUploadClick={handlePlusClick}
        onHomeClick={navigateHome}
        onImportRefreshComplete={handleImportRefreshComplete}
        onNavigate={navigateToStableStage}
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
