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
  initialProfileName: string;
  saving: boolean;
  users: UserRecord[];
  onCloseCreate: () => void;
  onCreateUser: (profileName: string) => void;
  onSelectUser: (user: UserRecord) => void;
  onSignOut: () => void;
  onToggleCreate: () => void;
};

type SettingsContentProps = {
  accountName: string;
  activeSection: SettingsSection | null;
  activeUser: UserRecord | null;
  error: string | null;
  isTesting: boolean;
  notice: string | null;
  showDeleteApiConfirm: boolean;
  showSecret: boolean;
  onBackToMenu: () => void;
  onDeleteAccount: () => void;
  onDeleteApiKeys: (deleteData: boolean) => void;
  onSaveApiKeys: (apiKey: string, apiSecret: string) => void;
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
  initialProfileName: string;
  saving: boolean;
  title: string;
  onCreateProfile: (profileName: string) => void;
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
  initialProfileName,
  saving,
  title,
  onCreateProfile
}: CreateProfileContentProps) {
  return (
    <CreateProfileStage
      initialProfileName={initialProfileName}
      saving={saving}
      title={title}
      onCreateProfile={onCreateProfile}
    />
  );
}

export function FinanceShellUserSelectContent({
  activeUserId,
  createInputRef,
  error,
  isCreateOpen,
  notice,
  initialProfileName,
  saving,
  users,
  onCloseCreate,
  onCreateUser,
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
      initialProfileName={initialProfileName}
      saving={saving}
      users={users}
      onCloseCreate={onCloseCreate}
      onCreateUser={onCreateUser}
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
  error,
  isTesting,
  notice,
  showDeleteApiConfirm,
  showSecret,
  onBackToMenu,
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
      activeUserId={activeUser?.id ?? null}
      binanceApiKeyPreview={activeUser?.binanceApiKeyPreview ?? null}
      error={error}
      hasActiveUser={!!activeUser}
      isApiKeySaved={!!activeUser?.hasBinanceCredentials}
      isTesting={isTesting}
      notice={notice}
      showDeleteApiConfirm={showDeleteApiConfirm}
      showSecret={showSecret}
      onBackToMenu={onBackToMenu}
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
