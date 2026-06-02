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
  binanceRefreshKey: number;
  createInputRef: RefObject<HTMLInputElement | null>;
  deletingProfileId: string | null;
  currentTransactions: PreviewTransaction[];
  error: string | null;
  isDashboardStage: boolean;
  isRestoringProfileSelection: boolean;
  isTesting: boolean;
  initialProfileName: string;
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
  onApproveTransactions: () => void;
  onBackToSettingsMenu: () => void;
  onCloseCreate: () => void;
  onCreateUser: (profileName: string) => void;
  onDeleteAccount: () => void;
  onDeleteApiKeys: (deleteData: boolean) => void;
  onDeleteProfile: (profile: UserRecord) => void;
  onNextPage: () => void;
  onOpenFilePicker: () => void;
  onPreviousPage: () => void;
  onSaveApiKeys: (apiKey: string, apiSecret: string) => void;
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
  binanceRefreshKey,
  createInputRef,
  deletingProfileId,
  currentTransactions,
  error,
  isDashboardStage,
  isRestoringProfileSelection,
  isTesting,
  initialProfileName,
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
  onCloseCreate,
  onCreateUser,
  onDeleteAccount,
  onDeleteApiKeys,
  onDeleteProfile,
  onNextPage,
  onOpenFilePicker,
  onPreviousPage,
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
      error={error}
      isTesting={isTesting}
      notice={notice}
      showDeleteApiConfirm={showDeleteApiConfirm}
      showSecret={showSecret}
      onBackToMenu={onBackToSettingsMenu}
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
      deletingProfileId={deletingProfileId}
      error={error}
      isCreateOpen={showCreateUserSubmenu}
      notice={notice}
      initialProfileName={users.length === 0 ? initialProfileName : ""}
      saving={saving}
      users={users}
      onCloseCreate={onCloseCreate}
      onCreateUser={onCreateUser}
      onDeleteProfile={onDeleteProfile}
      onSelectUser={onSelectUser}
      onSignOut={onSignOut}
      onToggleCreate={onToggleCreate}
    />
  );
  const createProfileContent = (
    <FinanceShellCreateProfileContent
      initialProfileName={initialProfileName}
      saving={saving}
      title={title}
      onCreateProfile={onCreateUser}
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
            activeUserId={activeUser?.id ?? null}
            backgroundRef={welcomeBackgroundRef}
            binanceRefreshKey={binanceRefreshKey}
            isBackgroundVisible={isWelcomeBackgroundVisible}
            isPanelModalOpen={isWelcomePanelModalOpen}
            users={users}
          />
        )}
      />
    ),
    renderSettingsContent: () => settingsContent,
    renderUploadContent: () => previewTransactionCount > 0 ? reviewContent : uploadContent,
    renderUserSelectContent: () => userSelectContent
  };
}
