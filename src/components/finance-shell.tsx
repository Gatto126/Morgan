"use client";

import { useRef, useState, useEffect } from "react";
import { AuthShell } from "./auth-shell";
import { CreateProfileStage } from "./finance-shell/create-profile-stage";
import { FrameOverlayPanels } from "./finance-shell/frame-overlay-panels";
import { FinanceShellMainFrame } from "./finance-shell/main-frame";
import { ReviewPanel } from "./finance-shell/review-panel";
import { DeleteAccountDialog } from "./finance-shell/delete-account-dialog";
import { EmptyChartAction } from "./finance-shell/empty-chart-action";
import { SettingsPanel, type SettingsSection } from "./finance-shell/settings-panel";
import type { UserRecord } from "./finance-shell/types";
import { UploadPanel } from "./finance-shell/upload-panel";
import { useFinanceAccountActions } from "./finance-shell/use-finance-account-actions";
import {
  resolveInitialFinanceState,
  useFinanceProfiles
} from "./finance-shell/use-finance-profiles";
import { useFrameOverlayLifecycle } from "./finance-shell/use-frame-overlay-lifecycle";
import { useFinanceNavigation, type Stage } from "./finance-shell/use-finance-navigation";
import { useTransactionImport, type ImportedTransactionCounts } from "./finance-shell/use-transaction-import";
import { UserSelectPanel } from "./finance-shell/user-select-panel";
import { WelcomeStage } from "./finance-shell/welcome-stage";

const dashboardStages = new Set<Stage>(["dashboard", "checking", "investment", "binance", "crypto"]);

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
    renderSettingsContent: renderSettingsState,
    renderUploadContent: () => previewTransactions.length > 0 ? renderReviewState() : renderUploadState(),
    renderUserSelectContent: renderUserSelectState,
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

  const title = isRestoringProfileSelection ? "Morgan" : getStageTitle(stage, hasUsers);

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
        onToggleCreate={handleToggleCreateUser}
        onCloseCreate={() => setShowCreateUserSubmenu(false)}
        onProfileNameChange={setName}
        onCreateUser={() => void handleCreateUser()}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  function handleSettingsSectionSelect(section: SettingsSection) {
    if (section !== "apiKey") {
      clearForcedApiSettingsSection();
    }
    toggleSettingsSection(section);
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

  function renderSettingsState() {
    const isApiKeySaved = !!activeUser?.hasBinanceCredentials;
    const visibleSettingsSection = getVisibleSettingsSection(activeSettingsSection, showSettingsView);

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
          clearForcedApiSettingsSection();
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
        <WelcomeStage
          backgroundRef={welcomeBackgroundRef}
          isBackgroundVisible={isWelcomeBackgroundVisible}
          isPanelModalOpen={isWelcomePanelModalOpen}
          onSignOut={() => void handleSignOut()}
        />
      );
    }

    if (stage === "select") {
      return renderUserSelectState();
    }

    if (stage === "create") {
      return (
        <CreateProfileStage
          profileName={name}
          saving={saving}
          title={title}
          onCreateProfile={() => void handleCreateUser()}
          onProfileNameChange={setName}
        />
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
