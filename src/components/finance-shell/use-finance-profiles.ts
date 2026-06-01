import type { Dispatch, SetStateAction } from "react";

import type { SettingsSection } from "./settings-panel-types";
import type { UserRecord } from "./types";
import { useFinanceProfileCreation } from "./use-finance-profile-creation";
import { useFinanceProfileDeletion } from "./use-finance-profile-deletion";
import { useFinanceProfilePersistence } from "./use-finance-profile-persistence";
import { useFinanceProfileSelection } from "./use-finance-profile-selection";
import { useFinanceProfileTransactionCounts } from "./use-finance-profile-transaction-counts";
import type { Stage } from "./use-finance-navigation";

export {
  clearPersistedFinanceProfileSelection,
  resolveInitialFinanceState
} from "./use-finance-profile-persistence";

type UseFinanceProfilesParams = {
  activeUser: UserRecord | null;
  hasRestoredClientState: boolean;
  initialUsers: UserRecord[];
  skipClientRestore: boolean;
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
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setShowCreateUserSubmenu: Dispatch<SetStateAction<boolean>>;
  setShowSettingsView: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setShowUserSelectView: Dispatch<SetStateAction<boolean>>;
  setStage: Dispatch<SetStateAction<Stage>>;
  setUsers: Dispatch<SetStateAction<UserRecord[]>>;
  onProfilePrefetch?: (user: UserRecord) => void;
};

export function useFinanceProfiles({
  activeUser,
  hasRestoredClientState,
  initialUsers,
  skipClientRestore,
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
  setUsers,
  onProfilePrefetch
}: UseFinanceProfilesParams) {
  const hasUsers = users.length > 0;
  const isRestoringProfileSelection = useFinanceProfilePersistence({
    activeUser,
    hasRestoredClientState,
    initialUsers,
    skipClientRestore,
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
    saving,
    users,
    resetPreview,
    setActiveUser,
    setError,
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
    setStage,
    onBeforeUserSelect: onProfilePrefetch
  });
  const {
    deletingProfileId,
    handleDeleteProfile
  } = useFinanceProfileDeletion({
    activeUser,
    users,
    clearApiKeyDraft,
    clearPanelFeedback,
    resetPreview,
    setActiveSettingsSection,
    setActiveUser,
    setError,
    setNotice,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView,
    setStage,
    setUsers
  });

  return {
    applyImportedTransactionCounts,
    deletingProfileId,
    goBackToSelection,
    handleCreateUser,
    handleDeleteProfile,
    handleToggleCreateUser,
    handleUserSelect,
    hasUsers,
    isRestoringProfileSelection
  };
}
