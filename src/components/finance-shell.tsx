"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ChartPie, FolderOpen, House, Landmark, Settings, Trash2, Wallet, Bitcoin, Coins, CircleCheckBig, Eye, EyeOff, RefreshCcwDot, LogOut, X as XIcon } from "lucide-react";
import { AuthShell } from "./auth-shell";
import { Dashboard } from "./dashboard";
import { CheckingDashboard } from "./checking-dashboard";
import { InvestmentDashboard } from "./investment-dashboard";
import { BinanceDashboard } from "./binance-dashboard";
import { CryptoDashboard } from "./crypto-dashboard";
import PlusIcon from "./ui/plus-icon";
import UserIcon from "./ui/user-icon";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn, getInitials } from "@/lib/utils";

type UserRecord = {
  id: string;
  name: string;
  transactionCount: number;
  checkingCount: number;
  investmentCount: number;
  cryptoCount: number;
  hasBinanceCredentials: boolean;
  binanceApiKeyPreview?: string | null;
};

type Stage = "welcome" | "select" | "create" | "dashboard" | "checking" | "investment" | "settings" | "binance" | "crypto";
type SourceInstitution = "trade_republic" | "bbva";

type PreviewTransaction = {
  fingerprint: string;
  sourceInstitution: SourceInstitution;
  pageNumber: number;
  bookingDate: string;
  rawDateLabel: string;
  typeLabel: string;
  description: string;
  direction: "IN" | "OUT";
  amountCents: number;
  balanceCents: number;
  currency: "EUR";
  accountType?: "checking" | "investment" | "crypto";
  productName?: string | null;
  isin?: string | null;
  quantityUnits?: number | null;
  tradeType?: "buy_trade" | "savings_plan" | null;
  status: "new" | "existing" | "saved";
};

type PreviewSummary = {
  fileName: string;
  sourceInstitution: SourceInstitution;
  totalTransactions: number;
  newTransactions: number;
  existingTransactions: number;
};

const PAGE_SIZE = 12;
const primaryActionButtonClass =
  "w-full min-w-0 max-w-[240px] text-xl min-[420px]:w-auto sm:min-w-62 sm:text-[2rem]";
const primaryStackClass = "space-y-6 text-center transition-all duration-300 ease-out";
const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR"
});

function formatEuro(cents: number) {
  return euroFormatter.format(cents / 100);
}

function formatSignedEuro(transaction: PreviewTransaction) {
  if (transaction.amountCents === 0) {
    return formatEuro(transaction.amountCents);
  }

  const sign = transaction.direction === "IN" ? "+" : "-";

  return `${sign}${formatEuro(transaction.amountCents)}`;
}

const restorableStages = new Set<Stage>(["welcome", "select", "create", "dashboard", "checking", "investment", "settings", "binance", "crypto"]);

function isRestorableStage(value: string | null): value is Stage {
  return value !== null && restorableStages.has(value as Stage);
}

function resolveInitialFinanceState(initialUsers: UserRecord[]) {
  const onlyUser = initialUsers.length === 1 ? initialUsers[0] : null;

  if (onlyUser) {
    return {
      activeUser: onlyUser,
      showUploadView: onlyUser.transactionCount === 0,
      stage: "dashboard" as Stage
    };
  }

  return {
    activeUser: null,
    showUploadView: false,
    stage: initialUsers.length > 0 ? "select" as Stage : "create" as Stage
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
  const [stage, setStage] = useState<Stage>(initialFinanceState.stage);
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [name, setName] = useState(suggestedFirstProfileName);
  const [activeUser, setActiveUser] = useState<UserRecord | null>(initialFinanceState.activeUser);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [previewTransactions, setPreviewTransactions] = useState<PreviewTransaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showUploadView, setShowUploadView] = useState(initialFinanceState.showUploadView);
  const [isClosingUpload, setIsClosingUpload] = useState(false);
  const [showSettingsView, setShowSettingsView] = useState(false);
  const [isClosingSettings, setIsClosingSettings] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState<"general" | "apiKey" | "dangerZone" | null>(
    initialFinanceState.stage === "settings" ? "general" : null
  );
  const [showUserSelectView, setShowUserSelectView] = useState(false);
  const [isClosingUserSelect, setIsClosingUserSelect] = useState(false);
  const [showCreateUserSubmenu, setShowCreateUserSubmenu] = useState(false);
  const [binanceKeyInput, setBinanceKeyInput] = useState("");
  const [binanceSecretInput, setBinanceSecretInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [binanceRefreshKey, setBinanceRefreshKey] = useState(0);
  const [showDeleteApiConfirm, setShowDeleteApiConfirm] = useState(false);
  const [binanceFading, setBinanceFading] = useState(false);
  const [importOverlayVisible, setImportOverlayVisible] = useState(false);
  const [importOverlayFadingOut, setImportOverlayFadingOut] = useState(false);
  const importOverlayDismissedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createUserInputRef = useRef<HTMLInputElement | null>(null);
  const closeUploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeSettingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeUserSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showCreateUserSubmenu && createUserInputRef.current) {
      const timer = setTimeout(() => {
        createUserInputRef.current?.focus({ preventScroll: true });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showCreateUserSubmenu]);

  useEffect(() => {
    let cancelled = false;

    const restoreTimer = window.setTimeout(() => {
      try {
        const savedUserId = localStorage.getItem("morgan_active_user");
        const savedStage = localStorage.getItem("morgan_stage");
        const savedUser = savedUserId ? initialUsers.find((user) => user.id === savedUserId) ?? null : null;

        if (!cancelled && savedUser) {
          const restoredStage = isRestorableStage(savedStage) ? savedStage : "dashboard";

          setActiveUser(savedUser);
          setShowUploadView(savedUser.transactionCount === 0);
          setStage(restoredStage);
          setActiveSettingsSection(restoredStage === "settings" ? "general" : null);
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
  }, [initialUsers]);

  const triggerCloseUpload = () => {
    if (closeUploadTimerRef.current) clearTimeout(closeUploadTimerRef.current);
    setIsClosingUpload(true);
    closeUploadTimerRef.current = setTimeout(() => {
      closeUploadTimerRef.current = null;
      setShowUploadView(false);
      resetPreview();
      setIsClosingUpload(false);
    }, 250);
  };

  const triggerCloseSettings = () => {
    if (closeSettingsTimerRef.current) clearTimeout(closeSettingsTimerRef.current);
    setIsClosingSettings(true);
    closeSettingsTimerRef.current = setTimeout(() => {
      closeSettingsTimerRef.current = null;
      setShowSettingsView(false);
      setIsClosingSettings(false);
    }, 250);
  };

  const triggerCloseUserSelect = () => {
    if (closeUserSelectTimerRef.current) clearTimeout(closeUserSelectTimerRef.current);
    setIsClosingUserSelect(true);
    closeUserSelectTimerRef.current = setTimeout(() => {
      closeUserSelectTimerRef.current = null;
      setShowUserSelectView(false);
      setIsClosingUserSelect(false);
      setShowCreateUserSubmenu(false);
    }, 250);
  };

  const handlePlusClick = () => {
    if (showSettingsView) {
      if (closeSettingsTimerRef.current) {
        clearTimeout(closeSettingsTimerRef.current);
        closeSettingsTimerRef.current = null;
      }
      setIsClosingSettings(false);
      setShowSettingsView(false);
      setActiveSettingsSection(null);
    }
    if (showUserSelectView) {
      if (closeUserSelectTimerRef.current) {
        clearTimeout(closeUserSelectTimerRef.current);
        closeUserSelectTimerRef.current = null;
      }
      setIsClosingUserSelect(false);
      setShowUserSelectView(false);
      setShowCreateUserSubmenu(false);
    }
    if (activeUser?.transactionCount === 0) {
      setIsClosingUpload(false);
      setShowUploadView(true);
      return;
    }
    if (showUploadView) {
      triggerCloseUpload();
    } else {
      if (closeUploadTimerRef.current) {
        clearTimeout(closeUploadTimerRef.current);
        closeUploadTimerRef.current = null;
      }
      setIsClosingUpload(false);
      setShowUploadView(true);
    }
  };

  const handleCloseUpload = () => {
    if (activeUser?.transactionCount === 0) {
      setIsClosingUpload(false);
      setShowUploadView(true);
      return;
    }
    triggerCloseUpload();
  };

  const handleSettingsClick = () => {
    if (showUploadView) {
      if (closeUploadTimerRef.current) {
        clearTimeout(closeUploadTimerRef.current);
        closeUploadTimerRef.current = null;
      }
      setIsClosingUpload(false);
      setShowUploadView(false);
      resetPreview();
    }
    if (showUserSelectView) {
      if (closeUserSelectTimerRef.current) {
        clearTimeout(closeUserSelectTimerRef.current);
        closeUserSelectTimerRef.current = null;
      }
      setIsClosingUserSelect(false);
      setShowUserSelectView(false);
      setShowCreateUserSubmenu(false);
    }
    if (showSettingsView) {
      triggerCloseSettings();
      setActiveSettingsSection(null);
      clearPanelFeedback();
    } else {
      if (closeSettingsTimerRef.current) {
        clearTimeout(closeSettingsTimerRef.current);
        closeSettingsTimerRef.current = null;
      }
      setIsClosingSettings(false);
      setActiveSettingsSection("general");
      clearPanelFeedback();
      clearApiKeyDraft();
      setShowSettingsView(true);
    }
  };

  const handleCloseSettings = () => {
    triggerCloseSettings();
    setActiveSettingsSection(null);
    clearPanelFeedback();
  };

  const handleUserSelectClick = () => {
    if (!activeUser) {
      if (!hasUsers) return;
      navigateTo("select");
      return;
    }
    if (showUploadView) {
      if (closeUploadTimerRef.current) {
        clearTimeout(closeUploadTimerRef.current);
        closeUploadTimerRef.current = null;
      }
      setIsClosingUpload(false);
      setShowUploadView(false);
      resetPreview();
    }
    if (showSettingsView) {
      if (closeSettingsTimerRef.current) {
        clearTimeout(closeSettingsTimerRef.current);
        closeSettingsTimerRef.current = null;
      }
      setIsClosingSettings(false);
      setShowSettingsView(false);
      setActiveSettingsSection(null);
    }
    if (showUserSelectView) {
      triggerCloseUserSelect();
    } else {
      if (closeUserSelectTimerRef.current) {
        clearTimeout(closeUserSelectTimerRef.current);
        closeUserSelectTimerRef.current = null;
      }
      setIsClosingUserSelect(false);
      setShowCreateUserSubmenu(false);
      setShowUserSelectView(true);
    }
  };

  const handleCloseUserSelect = () => {
    triggerCloseUserSelect();
  };

  const handleImportRefreshComplete = () => {
    if (importOverlayDismissedRef.current) return;
    importOverlayDismissedRef.current = true;
    setImportOverlayFadingOut(true);
    setTimeout(() => {
      setImportOverlayVisible(false);
      setImportOverlayFadingOut(false);
      importOverlayDismissedRef.current = false;
    }, 550);
  };

  const navigateTo = (newStage: Stage) => {
    setStage(newStage);
    setShowUploadView(false);
    setShowSettingsView(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    setActiveSettingsSection(null);
    setShowDeleteApiConfirm(false);
    setError(null);
    setNotice(null);
  };

  const navigateHome = () => {
    setStage("welcome");
    setShowUploadView(false);
    setShowSettingsView(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    setActiveSettingsSection(null);
    setShowDeleteApiConfirm(false);
    clearApiKeyDraft();
    setError(null);
    setNotice(null);
  };

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

  function toggleSettingsSection(section: "general" | "apiKey" | "dangerZone") {
    clearPanelFeedback();
    if (section === "apiKey") {
      clearApiKeyDraft();
    }
    setActiveSettingsSection((prev) => (prev === section ? null : section));
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

  async function handleSaveApiKeys() {
    if (!activeUser) return;

    try {
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
      setBinanceRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving API keys.");
    } finally {
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
  const title = getStageTitle(stage, hasUsers);

  const totalPages = Math.max(1, Math.ceil(previewTransactions.length / PAGE_SIZE));
  const visiblePage = Math.min(currentPage, totalPages);
  const currentTransactions = useMemo(() => {
    const startIndex = (visiblePage - 1) * PAGE_SIZE;
    return previewTransactions.slice(startIndex, startIndex + PAGE_SIZE);
  }, [previewTransactions, visiblePage]);

  const newTransactionsCount = useMemo(
    () => previewTransactions.filter((transaction) => transaction.status === "new").length,
    [previewTransactions]
  );

  function resetPreview() {
    setPreviewSummary(null);
    setPreviewTransactions([]);
    setCurrentPage(1);
  }

  function handleUserSelect(user: UserRecord) {
    setActiveUser(user);
    resetPreview();
    if (showUserSelectView) {
      setIsClosingUserSelect(false);
      setShowUserSelectView(false);
      setShowCreateUserSubmenu(false);
    }
    setShowSettingsView(false);
    setActiveSettingsSection(null);
    clearPanelFeedback();
    clearApiKeyDraft();
    setShowUploadView(user.transactionCount === 0);
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
      setShowUploadView(payload.user.transactionCount === 0);
      setShowUserSelectView(false);
      setShowCreateUserSubmenu(false);
      setStage("dashboard");
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "User creation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("Delete this account and every profile connected to it? All local data, transactions, assets, Binance balances and cached prices tied to this account will be removed permanently.")) {
      return;
    }

    try {
      setError(null);
      const response = await fetch("/api/account", {
        method: "DELETE"
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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error during account deletion.");
    }
  }

  function goBackToSelection() {
    if (hasUsers) {
      setStage("select");
      return;
    }

    setStage("welcome");
  }

  function openFilePicker() {
    if (parsing || approving) {
      return;
    }

    fileInputRef.current?.click();
  }



  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    const selectedFile = files?.[0] ?? null;
    event.currentTarget.value = "";

    if (!selectedFile || !activeUser) {
      return;
    }

    if ((files?.length ?? 0) > 1) {
      setError("Carica un solo file alla volta.");
      return;
    }

    setParsing(true);
    setError(null);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.append("userId", activeUser.id);
      formData.append("file", selectedFile);

      const response = await fetch("/api/transactions/preview", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as {
        summary?: PreviewSummary;
        transactions?: PreviewTransaction[];
        error?: string;
      };

      if (!response.ok || !payload.summary || !payload.transactions) {
        throw new Error(payload.error ?? "Parsing del file non riuscito.");
      }

      setPreviewSummary(payload.summary);
      setPreviewTransactions(payload.transactions);
      setCurrentPage(1);
    } catch (parsingError) {
      setError(parsingError instanceof Error ? parsingError.message : "Parsing del file non riuscito.");
    } finally {
      setParsing(false);
    }
  }

  async function approveTransactions() {
    if (!activeUser || !previewSummary || previewTransactions.length === 0 || approving) {
      return;
    }

    importOverlayDismissedRef.current = false;
    setImportOverlayFadingOut(false);
    setImportOverlayVisible(true);
    setApproving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/transactions/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: activeUser.id,
          statementFileName: previewSummary.fileName,
          transactions: previewTransactions
        })
      });

      const payload = (await response.json()) as {
        insertedCount?: number;
        skippedCount?: number;
        insertedFingerprints?: string[];
        error?: string;
      };

      if (!response.ok || !payload.insertedFingerprints) {
        throw new Error(payload.error ?? "Salvataggio delle transazioni non riuscito.");
      }

      const insertedFingerprintSet = new Set(payload.insertedFingerprints);

      setPreviewTransactions((currentTransactionsState) =>
        currentTransactionsState.map((transaction) => {
          if (insertedFingerprintSet.has(transaction.fingerprint)) {
            return {
              ...transaction,
              status: "saved"
            };
          }

          return transaction;
        })
      );

      setPreviewSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              newTransactions: 0,
              existingTransactions: currentSummary.totalTransactions
            }
          : currentSummary
      );

      setNotice(
        `Import completato: ${payload.insertedCount ?? 0} transazioni salvate, ${payload.skippedCount ?? 0} già presenti.`
      );

      const insertedCount = payload.insertedCount ?? 0;
      if (insertedCount > 0 && activeUser) {
        const insertedFingerprintSet = new Set(payload.insertedFingerprints);
        let addedChecking = 0;
        let addedInvestment = 0;
        let addedCrypto = 0;

        previewTransactions.forEach((t) => {
          if (insertedFingerprintSet.has(t.fingerprint)) {
            if (t.accountType === "checking") addedChecking++;
            else if (t.accountType === "investment") addedInvestment++;
            else if (t.accountType === "crypto") addedCrypto++;
          }
        });

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
          currentUsers.map((u) => {
            if (u.id === activeUser.id) {
              return {
                ...u,
                transactionCount: u.transactionCount + insertedCount,
                checkingCount: u.checkingCount + addedChecking,
                investmentCount: u.investmentCount + addedInvestment,
                cryptoCount: u.cryptoCount + addedCrypto
              };
            }
            return u;
          })
        );
      }

      resetPreview();
      setShowUploadView(false);
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Salvataggio delle transazioni non riuscito.");
      if (!importOverlayDismissedRef.current) {
        importOverlayDismissedRef.current = true;
        setImportOverlayFadingOut(true);
        setTimeout(() => {
          setImportOverlayVisible(false);
          setImportOverlayFadingOut(false);
          importOverlayDismissedRef.current = false;
        }, 550);
      }
    } finally {
      setApproving(false);
    }
  }



  function renderUserSelectState() {
    const isOpen = showCreateUserSubmenu;
    return (
      <div className="mx-auto flex w-full max-w-[850px] items-stretch text-left justify-start md:h-[380px] h-full">
        {/* Left Panel: Select User */}
        <div className={cn("w-full md:w-[380px] shrink-0 flex flex-col justify-between py-1 md:py-2 h-full", isOpen && "hidden md:flex")}>
          <div className="space-y-4 md:space-y-8 flex flex-col justify-between h-full">
            <div className="space-y-4 md:space-y-6">
              <div className="space-y-1 select-none">
                <div className="text-2xl md:text-3xl font-bold tracking-[-0.06em] text-white sm:text-[2.2rem]">
                  Select profile
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50">
                  Manage profiles
                </div>
              </div>

              <div className="flex flex-col gap-2 md:gap-3 overflow-y-auto max-h-[120px] md:max-h-[220px] pr-2 hide-scrollbar">
                {users.map((user) => {
                  const isCurrentProfile = activeUser?.id === user.id;

                  return (
                    <button
                      key={user.id}
                      className={cn(
                        "w-full text-left px-4 py-2.5 md:py-3 rounded-[12px] border bg-[color:var(--surface-panel)] text-white hover:bg-[color:var(--surface-elevated)] transition-all font-semibold select-none cursor-pointer text-sm md:text-base flex items-center justify-between gap-3",
                        isCurrentProfile
                          ? "border-white bg-[color:var(--surface-elevated)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
                          : "border-[color:var(--line-strong)]"
                      )}
                      onClick={() => handleUserSelect(user)}
                    >
                      <span className="min-w-0 truncate">{user.name}</span>
                      {isCurrentProfile ? (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
                          Active
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-5 pt-2">
              <div
                onClick={() => {
                  setShowCreateUserSubmenu(prev => !prev);
                  setName(users.length === 0 ? accountName : "");
                  setError(null);
                  setNotice(null);
                }}
                className="group cursor-pointer select-none space-y-1"
              >
                <div
                  className={cn(
                    "text-2xl md:text-3xl font-bold tracking-[-0.06em] transition-colors duration-200 sm:text-[2.2rem]",
                    isOpen
                      ? "text-white"
                      : "text-[color:var(--text-dim)] group-hover:text-white"
                  )}
                >
                  New Profile
                </div>
                <div
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-200",
                    isOpen
                      ? "text-[color:var(--text-dim)]"
                      : "text-[color:var(--text-dim)]/50 group-hover:text-[color:var(--text-dim)]"
                  )}
                >
                  Create new profile
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="group block cursor-pointer select-none space-y-1 text-left"
              >
                <div className="text-xl md:text-2xl font-bold tracking-[-0.06em] text-[color:var(--text-dim)] transition-colors duration-200 group-hover:text-white">
                  Log out
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50 transition-colors duration-200 group-hover:text-[color:var(--text-dim)]">
                  Back to landing
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Separator and Right Panel Container with transition */}
        <div
          className={cn(
            "flex flex-row items-stretch transition-all duration-300 ease-in-out overflow-hidden h-full w-full md:w-auto",
            isOpen ? "w-full md:w-[470px] opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-4 pointer-events-none"
          )}
        >
          {isOpen && (
          <>
          {/* Vertical Separator Line */}
          <div className="hidden md:block w-[2px] bg-[color:var(--line-strong)] opacity-30 self-stretch shrink-0 mx-8" />

          {/* Right Panel Submenu Content */}
          <div className="w-full md:w-[398px] shrink-0 flex flex-col justify-between md:justify-end h-full py-1 md:py-2">
            <div key="open" className="flex-1 flex flex-col justify-between md:justify-end h-full pb-2 animate-submenu-in">
              {/* Back button on mobile */}
              <button
                type="button"
                onClick={() => setShowCreateUserSubmenu(false)}
                className="md:hidden flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[color:var(--text-dim)] hover:text-white mb-4 self-start cursor-pointer"
              >
                  &lt; Back to profiles
              </button>

              <div className="space-y-4 md:space-y-6">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-bold tracking-[-0.06em] text-white uppercase">New Profile</h2>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                    Profile name
                  </div>
                </div>
                <div className="space-y-3 pt-1 md:pt-2">
                  <Input
                    ref={createUserInputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 w-full border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-lg text-white focus:border-white focus:ring-0 sm:h-12 sm:text-xl"
                    placeholder="Profile"
                    maxLength={24}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void handleCreateUser();
                      }
                    }}
                  />
                  <div className="flex min-h-11 justify-center">
                    <button
                      type="button"
                      aria-label="Create profile"
                      className={cn(
                        "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] transition-[background-color,border-color,color,transform,opacity] hover:border-white hover:bg-[color:var(--surface-elevated)] hover:text-white active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 sm:h-12 sm:w-12"
                      )}
                      disabled={saving || !name.trim()}
                      onClick={() => void handleCreateUser()}
                    >
                      <PlusIcon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
                {error && (
                  <p className="text-xs text-[color:var(--danger)] mt-1 font-semibold">
                    {error}
                  </p>
                )}
                {notice && (
                  <p className="text-xs text-emerald-400 mt-1 font-semibold">
                    {notice}
                  </p>
                )}
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    );
  }

  function renderSettingsState() {
    const isApiKeySaved = !!activeUser?.hasBinanceCredentials;
    const isOpen = activeSettingsSection !== null;

    return (
      <div className="mx-auto flex w-full max-w-[850px] items-stretch text-left justify-start md:h-[380px] h-full">
        {/* Left Panel Menu (Fixed width and height to remain perfectly in place) */}
        <div className={cn("w-full md:w-[380px] shrink-0 flex flex-col justify-between py-1 md:py-2 h-full", isOpen && "hidden md:flex")}>
          <div className="space-y-4 md:space-y-8">
            {/* Menu Items */}
            <div className="space-y-4 md:space-y-6">
              {/* Item 1: SETTINGS / GENERAL SETTINGS (Unified Menu Item) */}
              <div
                onClick={() => toggleSettingsSection("general")}
                className="group cursor-pointer select-none space-y-1"
              >
                <div
                  className={cn(
                    "text-2xl md:text-3xl font-bold tracking-[-0.06em] transition-colors duration-200 sm:text-[2.2rem]",
                    activeSettingsSection === "general"
                      ? "text-white"
                      : "text-[color:var(--text-dim)] group-hover:text-white"
                  )}
                >
                  Settings
                </div>
                <div
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-200",
                    activeSettingsSection === "general"
                      ? "text-[color:var(--text-dim)]"
                      : "text-[color:var(--text-dim)]/50 group-hover:text-[color:var(--text-dim)]"
                  )}
                >
                  General Settings
                </div>
              </div>

              {/* Item 2: API Key / MANAGE API (Unified Menu Item) */}
              <div
                onClick={() => toggleSettingsSection("apiKey")}
                className="group cursor-pointer select-none space-y-1"
              >
                <div
                  className={cn(
                    "text-2xl md:text-3xl font-bold tracking-[-0.06em] transition-colors duration-200 sm:text-[2.2rem]",
                    activeSettingsSection === "apiKey"
                      ? "text-white"
                      : "text-[color:var(--text-dim)] group-hover:text-white"
                  )}
                >
                  API Key
                </div>
                <div
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-200",
                    activeSettingsSection === "apiKey"
                      ? "text-[color:var(--text-dim)]"
                      : "text-[color:var(--text-dim)]/50 group-hover:text-[color:var(--text-dim)]"
                  )}
                >
                  MANAGE API
                </div>
              </div>

              {/* Item 3: Danger Zone / DELETE ACCOUNT (Unified Menu Item) */}
              {activeUser && (
                <div
                  onClick={() => toggleSettingsSection("dangerZone")}
                  className="group cursor-pointer select-none space-y-1"
                >
                  <div
                    className={cn(
                      "text-2xl md:text-3xl font-bold tracking-[-0.06em] transition-colors duration-200 sm:text-[2.2rem]",
                      activeSettingsSection === "dangerZone"
                        ? "text-[color:var(--danger)]"
                        : "text-[color:var(--text-dim)] group-hover:text-[color:var(--danger)]"
                    )}
                  >
                    Danger zone
                  </div>
                  <div
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-200",
                      activeSettingsSection === "dangerZone"
                        ? "text-[color:var(--danger)]/80"
                        : "text-[color:var(--text-dim)]/50 group-hover:text-[color:var(--danger)]/80"
                    )}
                  >
                    DELETE ACCOUNT
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Separator and Right Panel Container with transition */}
        <div
          className={cn(
            "flex flex-row items-stretch transition-all duration-300 ease-in-out overflow-hidden h-full w-full md:w-auto",
            isOpen ? "w-full md:w-[470px] opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-4 pointer-events-none"
          )}
        >
          {isOpen && (
          <>
          {/* Vertical Separator Line */}
          <div className="hidden md:block w-[2px] bg-[color:var(--line-strong)] opacity-30 self-stretch shrink-0 mx-8" />

          {/* Right Panel Submenu Content */}
          <div className="w-full md:w-[398px] shrink-0 flex flex-col h-full overflow-y-auto pr-2 hide-scrollbar py-3 md:py-4">
            <div key={activeSettingsSection} className="flex-1 flex flex-col h-full animate-submenu-in">
              {/* Back button on mobile */}
              <button
                type="button"
                onClick={() => {
                  clearPanelFeedback();
                  setActiveSettingsSection(null);
                }}
                className="md:hidden flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[color:var(--text-dim)] hover:text-white mb-4 self-start cursor-pointer"
              >
                &lt; Back to settings
              </button>

              {activeSettingsSection === "general" && (
                /* General Settings Panel Content */
                <div className="flex-1 flex flex-col justify-start">
                  <div className="space-y-4 md:space-y-6">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold tracking-[-0.06em] text-white uppercase">General Settings</h2>
                    </div>
                    <div className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
                      Account
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] px-4 py-3">
                      <div className="min-w-0 text-left">
                        <div className="truncate text-sm font-bold text-white">{accountName}</div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-dim)]/70">
                          Local account
                        </div>
                      </div>
                      <button
                        aria-label="Log out"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] transition-colors hover:border-white hover:bg-[color:var(--surface-elevated)] hover:text-white cursor-pointer has-lucide"
                        onClick={() => void handleSignOut()}
                        type="button"
                      >
                        <LogOut className="h-4 w-4" strokeWidth={2.3} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsSection === "apiKey" && (
                /* API Key Panel Content */
                <div className="flex-1 flex flex-col justify-between h-full pb-1 md:pb-2">
                  <div className="space-y-4 md:space-y-6">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold tracking-[-0.06em] text-white uppercase">BINANCE</h2>
                    </div>

                    <div className="space-y-3 md:space-y-4">
                      {/* API Key Input */}
                      <div className="space-y-1 md:space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                          API KEY
                        </label>
                        <Input
                          className="w-full text-sm md:text-base bg-[color:var(--surface-panel)] border-[color:var(--line-strong)] text-white disabled:opacity-75 disabled:cursor-not-allowed"
                          placeholder="Enter API Key"
                          disabled={isApiKeySaved}
                          value={isApiKeySaved ? activeUser?.binanceApiKeyPreview ?? "Saved securely" : binanceKeyInput}
                          onChange={(e) => setBinanceKeyInput(e.target.value)}
                        />
                      </div>

                      {/* Secret Key Input */}
                      <div className="space-y-1 md:space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                          SECRET
                        </label>
                        <div className="relative">
                          <Input
                            type={showSecret ? "text" : "password"}
                            className="w-full text-sm md:text-base pr-10 bg-[color:var(--surface-panel)] border-[color:var(--line-strong)] text-white disabled:opacity-75 disabled:cursor-not-allowed"
                            placeholder="Enter Secret Key"
                            disabled={isApiKeySaved}
                            value={isApiKeySaved ? "Stored server-side" : binanceSecretInput}
                            onChange={(e) => setBinanceSecretInput(e.target.value)}
                          />
                          {!isApiKeySaved && (
                            <div
                              role="button"
                              onClick={() => setShowSecret(!showSecret)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-dim)] hover:text-white cursor-pointer animate-none"
                            >
                              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Icons Row — flex row: left slot grows, right slot (trash/save/spinner) is fixed */}
                  <div className="mt-auto pt-4 md:pt-6 shrink-0 flex items-center gap-2 h-10 md:h-12">

                    {/* Left slot — notice/error text OR the two choice buttons */}
                    <div className="flex-1 min-w-0 flex items-center justify-end overflow-hidden">
                      {showDeleteApiConfirm ? (
                        /* Choice buttons slide in from the right */
                        <div className="flex items-center gap-2 animate-delete-confirm-in">
                          <button
                            type="button"
                            onClick={() => void handleDeleteApiKeys(false)}
                            className="flex h-10 md:h-12 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--danger)] hover:text-red-400 hover:bg-[color:var(--surface-elevated)] hover:border-red-400 transition-colors cursor-pointer text-[10px] md:text-[11px] font-extrabold uppercase tracking-[0.14em] px-3 md:px-5 whitespace-nowrap"
                          >
                            API Only
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteApiKeys(true)}
                            className="flex h-10 md:h-12 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--danger)] hover:text-red-400 hover:bg-[color:var(--surface-elevated)] hover:border-red-400 transition-colors cursor-pointer text-[10px] md:text-[11px] font-extrabold uppercase tracking-[0.14em] px-3 md:px-5 whitespace-nowrap"
                          >
                            API + Data
                          </button>
                        </div>
                      ) : (
                        /* Notice / error text */
                        <div className="text-[10px] md:text-[11px] font-semibold tracking-wider truncate">
                          {error && <span className="text-[color:var(--danger)]">{error}</span>}
                          {notice && !error && (
                            <span className={cn(
                              isTesting
                                ? "text-yellow-400"
                                : notice.toLowerCase().includes("delete") || notice.toLowerCase().includes("cancel")
                                ? "text-[color:var(--danger)]"
                                : "text-emerald-500"
                            )}>
                              {notice}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right slot — never moves */}
                    {isTesting ? (
                      <button
                        type="button"
                        disabled
                        title="Testing Binance connection…"
                        className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-[16px] border-2 border-yellow-400/40 bg-[color:var(--surface-panel)] text-yellow-400 opacity-80 cursor-not-allowed"
                      >
                        <RefreshCcwDot className="h-4 w-4 md:h-5 md:w-5 animate-spin" strokeWidth={2.3} />
                      </button>
                    ) : isApiKeySaved ? (
                      <button
                        type="button"
                        onClick={() => setShowDeleteApiConfirm((v) => !v)}
                        title={showDeleteApiConfirm ? "Cancel" : "Delete Saved API Keys"}
                        className={cn("trash-danger flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] hover:bg-[color:var(--surface-elevated)] transition-colors cursor-pointer focus:outline-none", showDeleteApiConfirm && "is-open")}
                      >
                        <Trash2 className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.3} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSaveApiKeys}
                        title="Save API Keys"
                        className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] hover:text-white hover:bg-[color:var(--surface-elevated)] hover:border-white transition-colors cursor-pointer"
                      >
                        <CircleCheckBig className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.3} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeSettingsSection === "dangerZone" && activeUser && (
                /* Danger Zone Panel Content */
                <div className="flex-1 flex flex-col justify-between h-full animate-submenu-in">
                  <div className="space-y-4 md:space-y-6">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold tracking-[-0.06em] text-[color:var(--danger)] uppercase">Danger Zone</h2>
                    </div>
                    <div className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
                      Delete Account Data
                    </div>
                    <p className="text-xs md:text-sm text-[color:var(--text-dim)] mt-2 md:mt-4 leading-relaxed">
                      Deleting your account is permanent and cannot be undone. All of your personal data, including connected bank accounts, crypto wallets, and transaction histories, will be permanently removed from the system.
                    </p>
                  </div>

                  <div className="mt-auto pt-4 md:pt-6 flex items-center justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleDeleteAccount()}
                      className="flex h-10 md:h-12 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--danger)] hover:text-red-400 hover:bg-[color:var(--surface-elevated)] hover:border-red-400 transition-colors cursor-pointer text-[10px] md:text-[11px] font-extrabold uppercase tracking-[0.14em] px-4 md:px-6"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    );
  }

  function renderUploadState() {
    return (
      <div className={primaryStackClass}>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-[-0.06em] text-white sm:text-[2.35rem]">Upload</h1>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 min-[420px]:flex-row">
          <Button className={primaryActionButtonClass} disabled={parsing} onClick={openFilePicker}>
            {parsing ? "Loading" : "Upload"}
          </Button>
        </div>

        {error ? <p className="text-sm text-[color:var(--danger)] mt-2">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-200 mt-2">{notice}</p> : null}
      </div>
    );
  }

  function renderReviewState() {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 text-left" style={{ opacity: approving ? 0 : 1, pointerEvents: approving ? "none" : "auto" }}>
        <div className="hidden sm:flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Review import</h2>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border-2 border-[color:var(--line-strong)] bg-[#1C1C1C]">
          <div className="h-full overflow-auto rounded-[22px] hide-scrollbar">
            <table className="min-w-full border-separate border-spacing-0 text-[11px] sm:text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-[#D9D9D9] sm:text-[11px] sm:tracking-[0.18em]">
                  <th className="sticky top-0 z-20 rounded-tl-[20px] border-b border-[color:var(--line-strong)] bg-[#1C1C1C] px-1.5 py-2 font-medium sm:px-4 sm:py-3">Date</th>
                  <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1C1C1C] px-4 py-2 font-medium hidden md:table-cell sm:py-3">Sort</th>
                  <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1C1C1C] px-1.5 py-2 font-medium sm:px-4 sm:py-3 text-left w-full">Description</th>
                  <th className="sticky top-0 z-20 rounded-tr-[20px] border-b border-[color:var(--line-strong)] bg-[#1C1C1C] px-1.5 py-2 text-right font-medium sm:px-4 sm:py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {currentTransactions.map((transaction) => (
                  <tr key={transaction.fingerprint} className="border-b border-[color:rgba(255,255,255,0.08)] align-middle last:border-b-0 hover:bg-[color:rgba(255,255,255,0.03)] transition-colors duration-150">
                    <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4">
                      <div className="font-semibold whitespace-nowrap">{transaction.rawDateLabel}</div>
                    </td>
                    <td className="px-4 py-2 text-[color:var(--text-main)] hidden md:table-cell whitespace-nowrap">{transaction.typeLabel}</td>
                    <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4 w-full max-w-0">
                      <div className="leading-5 truncate">{transaction.description}</div>
                    </td>
                    <td className="px-1.5 py-2 text-right text-[color:var(--text-main)] font-semibold whitespace-nowrap sm:px-4">{formatSignedEuro(transaction)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {error ? <p className="text-sm text-[color:var(--danger)] text-center my-1">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-200 text-center my-1">{notice}</p> : null}

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex flex-1 items-center justify-start">
            <button
              className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-main)] transition-colors hover:bg-[color:var(--surface-elevated)] cursor-pointer"
              onClick={openFilePicker}
              type="button"
              aria-label="Carica un altro CSV"
            >
              <FolderOpen className="h-5 w-5" strokeWidth={2.3} />
            </button>
          </div>

          <div className="flex flex-none items-center justify-center gap-1 text-xs font-semibold text-[color:var(--text-dim)] sm:gap-2 sm:text-sm">
            <button
              aria-label="Previous page"
              disabled={visiblePage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className={cn(
                "flex h-8 w-8 items-center justify-center border-0 bg-transparent hover:text-white sm:h-10 sm:w-10",
                "disabled:opacity-40 disabled:pointer-events-none"
              )}
            >
              {"<<"}
            </button>

            <span className="whitespace-nowrap">
              {visiblePage} / {totalPages}
            </span>

            <button
              aria-label="Next page"
              disabled={visiblePage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              className={cn(
                "flex h-8 w-8 items-center justify-center border-0 bg-transparent hover:text-white sm:h-10 sm:w-10",
                "disabled:opacity-40 disabled:pointer-events-none"
              )}
            >
              {">>"}
            </button>
          </div>

          <div className="flex flex-1 items-center justify-end">
            {approving ? (
              <Button className="w-full sm:w-auto sm:min-w-48" disabled onClick={() => void approveTransactions()}>
                ...
              </Button>
            ) : newTransactionsCount === 0 ? (
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--text-dim)] hidden sm:block">Zero news</div>
            ) : (
                <button
                aria-label={`Approve and save ${newTransactionsCount} transactions`}
                className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-main)] transition-colors hover:bg-[color:var(--surface-elevated)] cursor-pointer"
                onClick={() => void approveTransactions()}
                type="button"
              >
                <BadgeCheck className="h-5 w-5" strokeWidth={2.3} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderStageContent() {
    if (stage === "welcome") {
      const homeOverlay = showUploadView ? (
        <div className={cn("relative h-full w-full flex flex-col justify-center", isClosingUpload ? "upload-panel-exit" : "upload-panel-enter")}>
          {activeUser?.transactionCount !== 0 ? (
            <div
              role="button"
              onClick={handleCloseUpload}
              className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
              title="Close upload panel"
            >
              <XIcon className="h-5 w-5" strokeWidth={2.3} />
            </div>
          ) : null}
          {previewTransactions.length > 0 ? renderReviewState() : renderUploadState()}
        </div>
      ) : showSettingsView ? (
        <div className={cn("relative h-full w-full flex flex-col justify-center", isClosingSettings ? "upload-panel-exit" : "upload-panel-enter")}>
          <div
            role="button"
            onClick={handleCloseSettings}
            className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
            title="Close settings"
          >
            <XIcon className="h-5 w-5" strokeWidth={2.3} />
          </div>
          {renderSettingsState()}
        </div>
      ) : showUserSelectView ? (
        <div className={cn("relative h-full w-full flex flex-col justify-center", isClosingUserSelect ? "upload-panel-exit" : "upload-panel-enter")}>
          <div
            role="button"
            onClick={handleCloseUserSelect}
            className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
            title="Close profile panel"
          >
            <XIcon className="h-5 w-5" strokeWidth={2.3} />
          </div>
          {renderUserSelectState()}
        </div>
      ) : null;

      return (
        <div className="relative h-full w-full">
          <div className="relative h-full w-full">
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
                homeOverlay ? "pointer-events-none opacity-0" : "opacity-100"
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
            {homeOverlay ? <div className="absolute inset-0">{homeOverlay}</div> : null}
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

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[color:var(--page-bg)] text-[color:var(--text-main)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1800px] flex-col overflow-y-auto hide-scrollbar px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <section className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_320px_auto] sm:grid-rows-[auto_480px_auto] md:grid-cols-[64px_minmax(0,1fr)] md:grid-rows-[auto_520px_auto] lg:grid-rows-[auto_600px_auto] gap-4 content-start lg:gap-5">
          <header className="grid min-h-16 grid-cols-[64px_minmax(0,1fr)] items-center gap-4 md:col-span-2 lg:gap-5">
            <div className="flex h-12 w-12 items-center justify-center justify-self-center rounded-2xl text-[2rem] font-black tracking-[-0.12em] text-white">
              M
            </div>

            <div className="min-w-0">
              <div className="flex h-16 w-full items-center justify-between rounded-[22px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-shell)] px-3">
                <div id="dashboard-tabs-portal" className="flex h-full min-w-0 flex-1 items-center overflow-x-auto hide-scrollbar mr-3" />
                {activeUser ? (
                  <button
                    aria-label="Add document"
                    className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] text-[color:var(--text-main)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985] has-lucide"
                    data-active={showUploadView || activeUser.transactionCount === 0 ? "true" : "false"}
                    onClick={handlePlusClick}
                    type="button"
                  >
                    <PlusIcon className="h-5 w-5" strokeWidth={2.3} />
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          <aside
            className="order-3 flex h-[88px] w-full flex-row items-center justify-between rounded-[22px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-shell)] p-3 transition-all duration-500 ease-out md:order-none md:row-start-2 md:h-auto md:w-auto md:flex-col md:justify-between md:translate-x-0 md:opacity-100"
          >
            <div className="hidden md:flex md:flex-col md:gap-2">
              <button
                aria-label="Home"
                className={cn(
                  "flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985] has-lucide",
                  stage === "welcome"
                    ? "border-white text-white"
                    : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                )}
                onClick={navigateHome}
                data-active={stage === "welcome"}
                title="Home"
                type="button"
              >
                <House className="h-5 w-5" strokeWidth={2.3} />
              </button>
              {activeUser && (
                <button
                  aria-label="Dashboard"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "dashboard"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("dashboard")}
                  data-active={stage === "dashboard"}
                  type="button"
                >
                  <ChartPie className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.checkingCount > 0 && (
                <button
                  aria-label="Checking"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "checking"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("checking")}
                  data-active={stage === "checking"}
                  type="button"
                >
                  <Landmark className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.investmentCount > 0 && (
                <button
                  aria-label="Investments"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "investment"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("investment")}
                  data-active={stage === "investment"}
                  type="button"
                >
                  <Wallet className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.cryptoCount > 0 && (
                <button
                  aria-label="Crypto"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "crypto"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("crypto")}
                  data-active={stage === "crypto"}
                  type="button"
                >
                  <Coins className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
            </div>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--text-dim)] md:hidden">
              {activeUser ? activeUser.name : title}
            </div>
            <div className="flex gap-2 md:flex-col">
              <button
                aria-label="Home"
                className={cn(
                  "flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985] md:hidden has-lucide",
                  stage === "welcome"
                    ? "border-white text-white"
                    : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                )}
                onClick={navigateHome}
                data-active={stage === "welcome"}
                title="Home"
                type="button"
              >
                <House className="h-5 w-5" strokeWidth={2.3} />
              </button>
              {activeUser && (
                <button
                  aria-label="Dashboard"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer md:hidden",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "dashboard"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("dashboard")}
                  data-active={stage === "dashboard"}
                  type="button"
                >
                  <ChartPie className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.checkingCount > 0 && (
                <button
                  aria-label="Checking"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer md:hidden",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "checking"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("checking")}
                  data-active={stage === "checking"}
                  type="button"
                >
                  <Landmark className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.investmentCount > 0 && (
                <button
                  aria-label="Investments"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer md:hidden",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "investment"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("investment")}
                  data-active={stage === "investment"}
                  type="button"
                >
                  <Wallet className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && activeUser.cryptoCount > 0 && (
                <button
                  aria-label="Crypto"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer md:hidden",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    stage === "crypto"
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("crypto")}
                  data-active={stage === "crypto"}
                  type="button"
                >
                  <Coins className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && (activeUser.hasBinanceCredentials || binanceFading) && (
                <button
                  aria-label="Binance"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-300 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    binanceFading
                      ? "opacity-0 pointer-events-none scale-90"
                      : stage === "binance"
                        ? "border-white text-white"
                        : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={() => navigateTo("binance")}
                  data-active={stage === "binance"}
                  type="button"
                >
                  <Bitcoin className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {activeUser && (
                <button
                  aria-label="Settings"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    showSettingsView
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={handleSettingsClick}
                  data-active={showSettingsView}
                  type="button"
                >
                  <Settings className="h-5 w-5" strokeWidth={2.3} />
                </button>
              )}
              {hasUsers && (
                <button
                  aria-label="Select profile"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] cursor-pointer",
                    "transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]",
                    "has-lucide",
                    (showUserSelectView || stage === "select")
                      ? "border-white text-white"
                      : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]"
                  )}
                  onClick={handleUserSelectClick}
                  data-active={showUserSelectView || stage === "select"}
                  type="button"
                >
                  {activeUser ? <span className="text-xl font-extrabold initials">{getInitials(activeUser.name)}</span> : <UserIcon className="h-6 w-6" />}
                </button>
              )}
            </div>
          </aside>

          <section 
            className="order-2 flex min-h-0 md:order-none md:row-start-2"
            onClick={() => {
              setNotice(null);
              setError(null);
            }}
          >
            <div className="relative flex min-h-0 w-full overflow-hidden rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)]">
              {importOverlayVisible && (
                <div
                  className="absolute inset-0 z-[60] flex flex-col items-center justify-center rounded-[20px]"
                  style={{
                    background: "var(--surface-canvas)",
                    opacity: importOverlayFadingOut ? 0 : 1,
                    transition: importOverlayFadingOut ? "opacity 550ms cubic-bezier(0.4,0,0.2,1)" : "opacity 180ms ease",
                    pointerEvents: importOverlayFadingOut ? "none" : "all"
                  }}
                >
                  <style dangerouslySetInnerHTML={{ __html: `@keyframes importSpinner { to { transform: rotate(360deg); } }` }} />
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: "2.5px solid rgba(255,255,255,0.07)",
                      borderTopColor: "rgba(255,255,255,0.5)",
                      animation: "importSpinner 0.85s linear infinite"
                    }}
                  />
                </div>
              )}
              <input
                ref={fileInputRef}
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-hidden="true"
                style={{ display: "none" }}
                onChange={(event) => void handleFileSelection(event)}
                type="file"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent_22%)]" />
              <div className="relative flex w-full min-h-0 items-center justify-center p-3 sm:p-5">
                <div className="h-full w-full max-w-none">
                  <div className="flex h-full min-h-0 flex-col justify-center">
                    {activeUser ? (
                      <>
                        <Dashboard
                          isActive={stage === "dashboard"}
                          key={`dashboard-${activeUser.id}`}
                          userId={activeUser.id}
                          binanceRefreshKey={binanceRefreshKey}
                          onImportRefreshComplete={stage === "dashboard" ? handleImportRefreshComplete : undefined}
                          showUploadView={showUploadView}
                          isClosingUpload={isClosingUpload}
                          onCloseUpload={handleCloseUpload}
                          uploadElement={renderUploadState()}
                          reviewElement={renderReviewState()}
                          previewTransactionsCount={previewTransactions.length}
                          checkingCount={activeUser.checkingCount}
                          investmentCount={activeUser.investmentCount}
                          cryptoCount={activeUser.cryptoCount}
                          transactionCount={activeUser.transactionCount}
                          showSettingsView={showSettingsView}
                          isClosingSettings={isClosingSettings}
                          onCloseSettings={handleCloseSettings}
                          settingsElement={renderSettingsState()}
                          showUserSelectView={showUserSelectView}
                          isClosingUserSelect={isClosingUserSelect}
                          onCloseUserSelect={handleCloseUserSelect}
                          userSelectElement={renderUserSelectState()}
                        />
                        {activeUser.checkingCount > 0 && (
                          <CheckingDashboard
                            isActive={stage === "checking"}
                            key={`checking-${activeUser.id}`}
                            userId={activeUser.id}
                            onImportRefreshComplete={stage === "checking" ? handleImportRefreshComplete : undefined}
                            showUploadView={showUploadView}
                            isClosingUpload={isClosingUpload}
                            onCloseUpload={handleCloseUpload}
                            uploadElement={renderUploadState()}
                            reviewElement={renderReviewState()}
                            previewTransactionsCount={previewTransactions.length}
                            transactionCount={activeUser.transactionCount}
                            showSettingsView={showSettingsView}
                            isClosingSettings={isClosingSettings}
                            onCloseSettings={handleCloseSettings}
                            settingsElement={renderSettingsState()}
                            showUserSelectView={showUserSelectView}
                            isClosingUserSelect={isClosingUserSelect}
                            onCloseUserSelect={handleCloseUserSelect}
                            userSelectElement={renderUserSelectState()}
                          />
                        )}
                        {activeUser.investmentCount > 0 && (
                          <InvestmentDashboard
                            isActive={stage === "investment"}
                            key={`investment-${activeUser.id}`}
                            userId={activeUser.id}
                            onImportRefreshComplete={stage === "investment" ? handleImportRefreshComplete : undefined}
                            showUploadView={showUploadView}
                            isClosingUpload={isClosingUpload}
                            onCloseUpload={handleCloseUpload}
                            uploadElement={renderUploadState()}
                            reviewElement={renderReviewState()}
                            previewTransactionsCount={previewTransactions.length}
                            transactionCount={activeUser.transactionCount}
                            showSettingsView={showSettingsView}
                            isClosingSettings={isClosingSettings}
                            onCloseSettings={handleCloseSettings}
                            settingsElement={renderSettingsState()}
                            showUserSelectView={showUserSelectView}
                            isClosingUserSelect={isClosingUserSelect}
                            onCloseUserSelect={handleCloseUserSelect}
                            userSelectElement={renderUserSelectState()}
                          />
                        )}
                        {activeUser.cryptoCount > 0 && (
                          <CryptoDashboard
                            isActive={stage === "crypto"}
                            key={`crypto-${activeUser.id}`}
                            userId={activeUser.id}
                            onImportRefreshComplete={stage === "crypto" ? handleImportRefreshComplete : undefined}
                            showUploadView={showUploadView}
                            isClosingUpload={isClosingUpload}
                            onCloseUpload={handleCloseUpload}
                            uploadElement={renderUploadState()}
                            reviewElement={renderReviewState()}
                            previewTransactionsCount={previewTransactions.length}
                            transactionCount={activeUser.transactionCount}
                            showSettingsView={showSettingsView}
                            isClosingSettings={isClosingSettings}
                            onCloseSettings={handleCloseSettings}
                            settingsElement={renderSettingsState()}
                            showUserSelectView={showUserSelectView}
                            isClosingUserSelect={isClosingUserSelect}
                            onCloseUserSelect={handleCloseUserSelect}
                            userSelectElement={renderUserSelectState()}
                          />
                        )}
                        {activeUser.hasBinanceCredentials && (
                          <BinanceDashboard
                            isActive={stage === "binance"}
                            key={`binance-${activeUser.id}`}
                            userId={activeUser.id}
                            showUploadView={showUploadView}
                            isClosingUpload={isClosingUpload}
                            onCloseUpload={handleCloseUpload}
                            uploadElement={renderUploadState()}
                            reviewElement={renderReviewState()}
                            previewTransactionsCount={previewTransactions.length}
                            transactionCount={activeUser.transactionCount}
                            showSettingsView={showSettingsView}
                            isClosingSettings={isClosingSettings}
                            onCloseSettings={handleCloseSettings}
                            settingsElement={renderSettingsState()}
                            showUserSelectView={showUserSelectView}
                            isClosingUserSelect={isClosingUserSelect}
                            onCloseUserSelect={handleCloseUserSelect}
                            userSelectElement={renderUserSelectState()}
                          />
                        )}
                      </>
                    ) : null}

                    {!["dashboard", "checking", "investment", "binance", "crypto"].includes(stage) ? (
                      <>
                        {renderStageContent()}
                        {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
                        {notice ? <p className="text-sm text-emerald-200">{notice}</p> : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>



              {stage === "create" && hasUsers ? (
                <button
                  className="absolute left-4 bottom-4 cursor-pointer border-0 bg-transparent px-2 py-1 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-dim)] shadow-none transition-colors hover:text-white"
                  onClick={goBackToSelection}
                  type="button"
                >
                  &lt;&lt; Back
                </button>
              ) : null}
            </div>
          </section>
          
          <div id="dashboard-cards-portal" className="order-4 md:col-start-2 md:row-start-3" />
        </section>
      </div>
    </main>
  );
}
