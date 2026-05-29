import type { Dispatch, SetStateAction } from "react";

import type { SettingsSection } from "./settings-panel-types";
import type { UserRecord } from "./types";
import { useFinanceProfileCreation } from "./use-finance-profile-creation";
import { useFinanceProfilePersistence } from "./use-finance-profile-persistence";
import { useFinanceProfileSelection } from "./use-finance-profile-selection";
import { useFinanceProfileTransactionCounts } from "./use-finance-profile-transaction-counts";
import type { Stage } from "./use-finance-navigation";

export {
  clearPersistedFinanceProfileSelection,
  resolveInitialFinanceState
} from "./use-finance-profile-persistence";

type UseFinanceProfilesParams = {
  accountName: string;
  activeUser: UserRecord | null;
  hasRestoredClientState: boolean;
  initialUsers: UserRecord[];
  name: string;
  saving: boolean;
  showUserSelectView: boolean;
  stage: Stage;
  users: UserRecord[];
  clearApiKeyDraft: () => void;
  clearPanelFeedback: () => void;
  handleCloseUserSelect: () => void;
  resetPreview: () => void;
  setActiveSettingsSection: Dispatch<SetStateAction<SettingsSection | null>>;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setHasRestoredClientState: Dispatch<SetStateAction<boolean>>;
  setIsClosingUserSelect: Dispatch<SetStateAction<boolean>>;
  setName: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setShowCreateUserSubmenu: Dispatch<SetStateAction<boolean>>;
  setShowSettingsView: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setShowUserSelectView: Dispatch<SetStateAction<boolean>>;
  setStage: Dispatch<SetStateAction<Stage>>;
  setUsers: Dispatch<SetStateAction<UserRecord[]>>;
};

export function useFinanceProfiles({
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
}: UseFinanceProfilesParams) {
  const hasUsers = users.length > 0;
  const isRestoringProfileSelection = useFinanceProfilePersistence({
    activeUser,
    hasRestoredClientState,
    initialUsers,
    stage,
    setActiveSettingsSection,
    setActiveUser,
    setHasRestoredClientState,
    setShowUploadView,
    setStage
  });
  const applyImportedTransactionCounts = useFinanceProfileTransactionCounts({
    activeUser,
    setActiveUser,
    setUsers
  });
  const {
    handleCreateUser,
    handleToggleCreateUser
  } = useFinanceProfileCreation({
    accountName,
    name,
    saving,
    users,
    resetPreview,
    setActiveUser,
    setError,
    setName,
    setNotice,
    setSaving,
    setShowCreateUserSubmenu,
    setShowUploadView,
    setShowUserSelectView,
    setStage,
    setUsers
  });
  const {
    goBackToSelection,
    handleUserSelect
  } = useFinanceProfileSelection({
    activeUser,
    hasUsers,
    showUserSelectView,
    clearApiKeyDraft,
    clearPanelFeedback,
    handleCloseUserSelect,
    resetPreview,
    setActiveSettingsSection,
    setActiveUser,
    setError,
    setIsClosingUserSelect,
    setNotice,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView,
    setStage
  });

  return {
    applyImportedTransactionCounts,
    goBackToSelection,
    handleCreateUser,
    handleToggleCreateUser,
    handleUserSelect,
    hasUsers,
    isRestoringProfileSelection
  };
}
