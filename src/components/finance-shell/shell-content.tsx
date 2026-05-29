"use client";

import type { ReactNode, RefObject } from "react";

import { CreateProfileStage } from "./create-profile-stage";
import { EmptyChartAction } from "./empty-chart-action";
import { ReviewPanel } from "./review-panel";
import { SettingsPanel, type SettingsSection } from "./settings-panel";
import type { PreviewTransaction, UserRecord } from "./types";
import { UploadPanel } from "./upload-panel";
import type { Stage } from "./use-finance-navigation";
import { UserSelectPanel } from "./user-select-panel";
import { WelcomeStage } from "./welcome-stage";

type UserSelectContentProps = {
  activeUserId: string | null;
  createInputRef: RefObject<HTMLInputElement | null>;
  error: string | null;
  isCreateOpen: boolean;
  notice: string | null;
  profileName: string;
  saving: boolean;
  users: UserRecord[];
  onCloseCreate: () => void;
  onCreateUser: () => void;
  onProfileNameChange: (value: string) => void;
  onSelectUser: (user: UserRecord) => void;
  onSignOut: () => void;
  onToggleCreate: () => void;
};

type SettingsContentProps = {
  accountName: string;
  activeSection: SettingsSection | null;
  activeUser: UserRecord | null;
  binanceKeyInput: string;
  binanceSecretInput: string;
  error: string | null;
  isTesting: boolean;
  notice: string | null;
  showDeleteApiConfirm: boolean;
  showSecret: boolean;
  onBackToMenu: () => void;
  onBinanceKeyChange: (value: string) => void;
  onBinanceSecretChange: (value: string) => void;
  onDeleteAccount: () => void;
  onDeleteApiKeys: (deleteData: boolean) => void;
  onSaveApiKeys: () => void;
  onSelectSection: (section: SettingsSection) => void;
  onSignOut: () => void;
  onToggleDeleteApiConfirm: () => void;
  onToggleSecret: () => void;
};

type ReviewContentProps = {
  approving: boolean;
  currentTransactions: PreviewTransaction[];
  error: string | null;
  newTransactionsCount: number;
  notice: string | null;
  totalPages: number;
  visiblePage: number;
  onApprove: () => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onUpload: () => void;
};

type UploadContentProps = {
  error: string | null;
  notice: string | null;
  parsing: boolean;
  onUpload: () => void;
};

type InlineUploadContentProps = UploadContentProps;

type WelcomeContentProps = {
  backgroundRef: RefObject<HTMLDivElement | null>;
  isBackgroundVisible: boolean;
  isPanelModalOpen: boolean;
  onSignOut: () => void;
};

type CreateProfileContentProps = {
  profileName: string;
  saving: boolean;
  title: string;
  onCreateProfile: () => void;
  onProfileNameChange: (value: string) => void;
};

type NonDashboardStageContentProps = {
  createProfileContent: ReactNode;
  error: string | null;
  isDashboardStage: boolean;
  isRestoringProfileSelection: boolean;
  notice: string | null;
  settingsContent: ReactNode;
  stage: Stage;
  userSelectContent: ReactNode;
  welcomeContent: ReactNode;
};

type CreateFinanceShellContentParams = {
  accountName: string;
  activeSection: SettingsSection | null;
  activeUser: UserRecord | null;
  approving: boolean;
  createInputRef: RefObject<HTMLInputElement | null>;
  currentTransactions: PreviewTransaction[];
  error: string | null;
  isDashboardStage: boolean;
  isRestoringProfileSelection: boolean;
  isTesting: boolean;
  name: string;
  newTransactionsCount: number;
  notice: string | null;
  parsing: boolean;
  previewTransactionCount: number;
  saving: boolean;
  showCreateUserSubmenu: boolean;
  showDeleteApiConfirm: boolean;
  showSecret: boolean;
  stage: Stage;
  title: string;
  totalPages: number;
  users: UserRecord[];
  visiblePage: number;
  welcomeBackgroundRef: RefObject<HTMLDivElement | null>;
  binanceKeyInput: string;
  binanceSecretInput: string;
  onApproveTransactions: () => void;
  onBackToSettingsMenu: () => void;
  onBinanceKeyChange: (value: string) => void;
  onBinanceSecretChange: (value: string) => void;
  onCloseCreate: () => void;
  onCreateUser: () => void;
  onDeleteAccount: () => void;
  onDeleteApiKeys: (deleteData: boolean) => void;
  onNextPage: () => void;
  onOpenFilePicker: () => void;
  onPreviousPage: () => void;
  onProfileNameChange: (value: string) => void;
  onSaveApiKeys: () => void;
  onSelectSettingsSection: (section: SettingsSection) => void;
  onSelectUser: (user: UserRecord) => void;
  onSignOut: () => void;
  onToggleCreate: () => void;
  onToggleDeleteApiConfirm: () => void;
  onToggleSecret: () => void;
};

type NonDashboardVisualState = {
  isWelcomeBackgroundVisible: boolean;
  isWelcomePanelModalOpen: boolean;
};

export function FinanceShellWelcomeContent({
  backgroundRef,
  isBackgroundVisible,
  isPanelModalOpen,
  onSignOut
}: WelcomeContentProps) {
  return (
    <WelcomeStage
      backgroundRef={backgroundRef}
      isBackgroundVisible={isBackgroundVisible}
      isPanelModalOpen={isPanelModalOpen}
      onSignOut={onSignOut}
    />
  );
}

export function FinanceShellCreateProfileContent({
  profileName,
  saving,
  title,
  onCreateProfile,
  onProfileNameChange
}: CreateProfileContentProps) {
  return (
    <CreateProfileStage
      profileName={profileName}
      saving={saving}
      title={title}
      onCreateProfile={onCreateProfile}
      onProfileNameChange={onProfileNameChange}
    />
  );
}

export function FinanceShellUserSelectContent({
  activeUserId,
  createInputRef,
  error,
  isCreateOpen,
  notice,
  profileName,
  saving,
  users,
  onCloseCreate,
  onCreateUser,
  onProfileNameChange,
  onSelectUser,
  onSignOut,
  onToggleCreate
}: UserSelectContentProps) {
  return (
    <UserSelectPanel
      activeUserId={activeUserId}
      createInputRef={createInputRef}
      error={error}
      isCreateOpen={isCreateOpen}
      notice={notice}
      profileName={profileName}
      saving={saving}
      users={users}
      onCloseCreate={onCloseCreate}
      onCreateUser={onCreateUser}
      onProfileNameChange={onProfileNameChange}
      onSelectUser={onSelectUser}
      onSignOut={onSignOut}
      onToggleCreate={onToggleCreate}
    />
  );
}

export function FinanceShellSettingsContent({
  accountName,
  activeSection,
  activeUser,
  binanceKeyInput,
  binanceSecretInput,
  error,
  isTesting,
  notice,
  showDeleteApiConfirm,
  showSecret,
  onBackToMenu,
  onBinanceKeyChange,
  onBinanceSecretChange,
  onDeleteAccount,
  onDeleteApiKeys,
  onSaveApiKeys,
  onSelectSection,
  onSignOut,
  onToggleDeleteApiConfirm,
  onToggleSecret
}: SettingsContentProps) {
  return (
    <SettingsPanel
      accountName={accountName}
      activeSection={activeSection}
      binanceApiKeyPreview={activeUser?.binanceApiKeyPreview ?? null}
      binanceKeyInput={binanceKeyInput}
      binanceSecretInput={binanceSecretInput}
      error={error}
      hasActiveUser={!!activeUser}
      isApiKeySaved={!!activeUser?.hasBinanceCredentials}
      isTesting={isTesting}
      notice={notice}
      showDeleteApiConfirm={showDeleteApiConfirm}
      showSecret={showSecret}
      onBackToMenu={onBackToMenu}
      onBinanceKeyChange={onBinanceKeyChange}
      onBinanceSecretChange={onBinanceSecretChange}
      onDeleteAccount={onDeleteAccount}
      onDeleteApiKeys={onDeleteApiKeys}
      onSaveApiKeys={onSaveApiKeys}
      onSelectSection={onSelectSection}
      onSignOut={onSignOut}
      onToggleDeleteApiConfirm={onToggleDeleteApiConfirm}
      onToggleSecret={onToggleSecret}
    />
  );
}

export function FinanceShellUploadContent({
  error,
  notice,
  parsing,
  onUpload
}: UploadContentProps) {
  return (
    <UploadPanel
      error={error}
      notice={notice}
      parsing={parsing}
      onUpload={onUpload}
    />
  );
}

export function FinanceShellInlineUploadContent({
  error,
  notice,
  parsing,
  onUpload
}: InlineUploadContentProps) {
  return (
    <EmptyChartAction
      actionLabel={parsing ? "Loading" : "Upload"}
      disabled={parsing}
      error={error}
      notice={notice}
      onAction={onUpload}
      title="Upload"
    />
  );
}

export function FinanceShellReviewContent({
  approving,
  currentTransactions,
  error,
  newTransactionsCount,
  notice,
  totalPages,
  visiblePage,
  onApprove,
  onNextPage,
  onPreviousPage,
  onUpload
}: ReviewContentProps) {
  return (
    <ReviewPanel
      approving={approving}
      error={error}
      newTransactionsCount={newTransactionsCount}
      notice={notice}
      totalPages={totalPages}
      transactions={currentTransactions}
      visiblePage={visiblePage}
      onApprove={onApprove}
      onNextPage={onNextPage}
      onPreviousPage={onPreviousPage}
      onUpload={onUpload}
    />
  );
}

export function useFinanceShellContent({
  accountName,
  activeSection,
  activeUser,
  approving,
  binanceKeyInput,
  binanceSecretInput,
  createInputRef,
  currentTransactions,
  error,
  isDashboardStage,
  isRestoringProfileSelection,
  isTesting,
  name,
  newTransactionsCount,
  notice,
  parsing,
  previewTransactionCount,
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
  onApproveTransactions,
  onBackToSettingsMenu,
  onBinanceKeyChange,
  onBinanceSecretChange,
  onCloseCreate,
  onCreateUser,
  onDeleteAccount,
  onDeleteApiKeys,
  onNextPage,
  onOpenFilePicker,
  onPreviousPage,
  onProfileNameChange,
  onSaveApiKeys,
  onSelectSettingsSection,
  onSelectUser,
  onSignOut,
  onToggleCreate,
  onToggleDeleteApiConfirm,
  onToggleSecret
}: CreateFinanceShellContentParams) {
  const settingsContent = (
    <FinanceShellSettingsContent
      accountName={accountName}
      activeSection={activeSection}
      activeUser={activeUser}
      binanceKeyInput={binanceKeyInput}
      binanceSecretInput={binanceSecretInput}
      error={error}
      isTesting={isTesting}
      notice={notice}
      showDeleteApiConfirm={showDeleteApiConfirm}
      showSecret={showSecret}
      onBackToMenu={onBackToSettingsMenu}
      onBinanceKeyChange={onBinanceKeyChange}
      onBinanceSecretChange={onBinanceSecretChange}
      onDeleteAccount={onDeleteAccount}
      onDeleteApiKeys={onDeleteApiKeys}
      onSaveApiKeys={onSaveApiKeys}
      onSelectSection={onSelectSettingsSection}
      onSignOut={onSignOut}
      onToggleDeleteApiConfirm={onToggleDeleteApiConfirm}
      onToggleSecret={onToggleSecret}
    />
  );
  const uploadContent = (
    <FinanceShellUploadContent
      error={error}
      notice={notice}
      parsing={parsing}
      onUpload={onOpenFilePicker}
    />
  );
  const reviewContent = (
    <FinanceShellReviewContent
      approving={approving}
      currentTransactions={currentTransactions}
      error={error}
      newTransactionsCount={newTransactionsCount}
      notice={notice}
      totalPages={totalPages}
      visiblePage={visiblePage}
      onApprove={onApproveTransactions}
      onNextPage={onNextPage}
      onPreviousPage={onPreviousPage}
      onUpload={onOpenFilePicker}
    />
  );
  const userSelectContent = (
    <FinanceShellUserSelectContent
      activeUserId={activeUser?.id ?? null}
      createInputRef={createInputRef}
      error={error}
      isCreateOpen={showCreateUserSubmenu}
      notice={notice}
      profileName={name}
      saving={saving}
      users={users}
      onCloseCreate={onCloseCreate}
      onCreateUser={onCreateUser}
      onProfileNameChange={onProfileNameChange}
      onSelectUser={onSelectUser}
      onSignOut={onSignOut}
      onToggleCreate={onToggleCreate}
    />
  );
  const createProfileContent = (
    <FinanceShellCreateProfileContent
      profileName={name}
      saving={saving}
      title={title}
      onCreateProfile={onCreateUser}
      onProfileNameChange={onProfileNameChange}
    />
  );

  return {
    renderInlineUploadState: () => (
      <FinanceShellInlineUploadContent
        error={error}
        notice={notice}
        parsing={parsing}
        onUpload={onOpenFilePicker}
      />
    ),
    renderNonDashboardStageContent: ({
      isWelcomeBackgroundVisible,
      isWelcomePanelModalOpen
    }: NonDashboardVisualState) => (
      <FinanceShellNonDashboardStageContent
        createProfileContent={createProfileContent}
        error={error}
        isDashboardStage={isDashboardStage}
        isRestoringProfileSelection={isRestoringProfileSelection}
        notice={notice}
        settingsContent={settingsContent}
        stage={stage}
        userSelectContent={userSelectContent}
        welcomeContent={(
          <FinanceShellWelcomeContent
            backgroundRef={welcomeBackgroundRef}
            isBackgroundVisible={isWelcomeBackgroundVisible}
            isPanelModalOpen={isWelcomePanelModalOpen}
            onSignOut={onSignOut}
          />
        )}
      />
    ),
    renderSettingsContent: () => settingsContent,
    renderUploadContent: () => previewTransactionCount > 0 ? reviewContent : uploadContent,
    renderUserSelectContent: () => userSelectContent
  };
}

export function FinanceShellNonDashboardStageContent({
  createProfileContent,
  error,
  isDashboardStage,
  isRestoringProfileSelection,
  notice,
  settingsContent,
  stage,
  userSelectContent,
  welcomeContent
}: NonDashboardStageContentProps) {
  if (isDashboardStage) {
    return null;
  }

  return (
    <>
      <FinanceShellStageContent
        createProfileContent={createProfileContent}
        isRestoringProfileSelection={isRestoringProfileSelection}
        settingsContent={settingsContent}
        stage={stage}
        userSelectContent={userSelectContent}
        welcomeContent={welcomeContent}
      />
      {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-200">{notice}</p> : null}
    </>
  );
}

function FinanceShellStageContent({
  createProfileContent,
  isRestoringProfileSelection,
  settingsContent,
  stage,
  userSelectContent,
  welcomeContent
}: Omit<NonDashboardStageContentProps, "error" | "isDashboardStage" | "notice">) {
  if (isRestoringProfileSelection) {
    return null;
  }

  if (stage === "welcome") {
    return welcomeContent;
  }

  if (stage === "select") {
    return userSelectContent;
  }

  if (stage === "create") {
    return createProfileContent;
  }

  if (stage === "settings") {
    return settingsContent;
  }

  return null;
}
