"use client";

import type { RefObject } from "react";

import {
  FinanceShellCreateProfileContent,
  FinanceShellInlineUploadContent,
  FinanceShellNonDashboardStageContent,
  FinanceShellReviewContent,
  FinanceShellSettingsContent,
  FinanceShellUploadContent,
  FinanceShellUserSelectContent,
  FinanceShellWelcomeContent
} from "./shell-content-sections";
import type { SettingsSection } from "./settings-panel";
import type { PreviewTransaction, UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

type UseFinanceShellContentParams = {
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
}: UseFinanceShellContentParams) {
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
