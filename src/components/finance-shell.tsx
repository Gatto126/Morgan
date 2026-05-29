"use client";

import { useRef, useState, useEffect } from "react";
import { AuthShell } from "./auth-shell";
import { FrameOverlayPanels } from "./finance-shell/frame-overlay-panels";
import { FinanceShellMainFrame } from "./finance-shell/main-frame";
import { DeleteAccountDialog } from "./finance-shell/delete-account-dialog";
import type { SettingsSection } from "./finance-shell/settings-panel";
import { useFinanceShellContent } from "./finance-shell/shell-content";
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

export function FinanceShell({ accountName, initialUsers }: { accountName: string; initialUsers: UserRecord[] }) {
  const [initialFinanceState] = useState(() => resolveInitialFinanceState(initialUsers));
  const suggestedFirstProfileName = initialUsers.length === 0 ? accountName : "";
  const [hasRestoredClientState, setHasRestoredClientState] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [name, setName] = useState(suggestedFirstProfileName);
  const [activeUser, setActiveUser] = useState<UserRecord | null>(initialFinanceState.activeUser);
  const [saving, setSaving] = useState(false);
  const {
    binanceFading,
    binanceKeyInput,
    binanceRefreshKey,
    binanceSecretInput,
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
    setBinanceKeyInput,
    setBinanceSecretInput,
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
  const importedTransactionCountsRef = useRef<((counts: ImportedTransactionCounts) => void) | null>(null);
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
    onImportedTransactions: (counts) => importedTransactionCountsRef.current?.(counts)
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
    goBackToSelection,
    handleCreateUser,
    handleToggleCreateUser,
    handleUserSelect,
    hasUsers,
    isRestoringProfileSelection
  } = useFinanceProfiles({
    accountName,
    activeUser,
    hasRestoredClientState,
    initialUsers,
    name,
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
    setName,
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
    importedTransactionCountsRef.current = applyImportedTransactionCounts;
    return () => {
      importedTransactionCountsRef.current = null;
    };
  }, [applyImportedTransactionCounts]);
  const isDashboardStage = dashboardStages.has(stage);
  const title = isRestoringProfileSelection ? "Morgan" : getStageTitle(stage, hasUsers);
  const visibleSettingsSection = getVisibleSettingsSection(activeSettingsSection, showSettingsView);
  const shellContent = useFinanceShellContent({
    accountName,
    activeSection: visibleSettingsSection,
    activeUser,
    approving,
    binanceKeyInput,
    binanceSecretInput,
    createInputRef: createUserInputRef,
    currentTransactions,
    error,
    isDashboardStage,
    isRestoringProfileSelection,
    isTesting,
    name,
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
    onBinanceKeyChange: setBinanceKeyInput,
    onBinanceSecretChange: setBinanceSecretInput,
    onCloseCreate: () => setShowCreateUserSubmenu(false),
    onCreateUser: () => void handleCreateUser(),
    onDeleteAccount: openDeleteAccountConfirm,
    onDeleteApiKeys: (deleteData) => void handleDeleteApiKeys(deleteData),
    onNextPage: goToNextPage,
    onOpenFilePicker: openFilePicker,
    onPreviousPage: goToPreviousPage,
    onProfileNameChange: setName,
    onSaveApiKeys: () => void handleSaveApiKeys(),
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
