import {
  Bitcoin,
  ChartPie,
  Coins,
  House,
  Landmark,
  Settings,
  Wallet,
  type LucideIcon
} from "lucide-react";
import type { ReactNode } from "react";

import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";
import {
  getActionNavigationKeys,
  getPrimaryNavigationKeys,
  type ActionNavKey,
  type PrimaryNavKey
} from "./sidebar-navigation-items";
import UserIcon from "../ui/user-icon";

import { cn, getInitials } from "@/shared/utils";

type SidebarNavigationProps = {
  activeUser: UserRecord | null;
  binanceFading: boolean;
  hasUsers: boolean;
  onHomeClick: () => void;
  onNavigate: (stage: Stage) => void;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  showSettingsView: boolean;
  showUserSelectView: boolean;
  stage: Stage;
  title: string;
};

type NavigationButtonProps = {
  active: boolean;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  isFading?: boolean;
  onClick: () => void;
  title?: string;
};

const navigationButtonClass =
  "flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:bg-[color:var(--surface-elevated)] active:scale-[0.985] has-lucide";

function NavigationButton({
  active,
  ariaLabel,
  children,
  className,
  isFading = false,
  onClick,
  title
}: NavigationButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        navigationButtonClass,
        isFading
          ? "pointer-events-none scale-90 opacity-0 duration-300"
          : active
            ? "border-white text-white"
            : "border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-[color:var(--text-dim)]",
        className
      )}
      data-active={active}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function getNavigationIcon(key: Exclude<ActionNavKey, "profile">): LucideIcon {
  switch (key) {
    case "home":
      return House;
    case "dashboard":
      return ChartPie;
    case "checking":
      return Landmark;
    case "investment":
      return Wallet;
    case "crypto":
      return Coins;
    case "binance":
      return Bitcoin;
    case "settings":
      return Settings;
  }
}

function getNavigationLabel(key: ActionNavKey) {
  switch (key) {
    case "home":
      return "Home";
    case "dashboard":
      return "Dashboard";
    case "checking":
      return "Checking";
    case "investment":
      return "Investments";
    case "crypto":
      return "Crypto";
    case "binance":
      return "Binance";
    case "settings":
      return "Settings";
    case "profile":
      return "Select profile";
  }
}

function isKeyActive(
  key: ActionNavKey,
  { showSettingsView, showUserSelectView, stage }: Pick<SidebarNavigationProps, "showSettingsView" | "showUserSelectView" | "stage">
) {
  if (key === "settings") return showSettingsView;
  if (key === "profile") return showUserSelectView || stage === "select";
  return stage === key;
}

function renderNavigationIcon(key: ActionNavKey, activeUser: UserRecord | null) {
  if (key === "profile") {
    return activeUser
      ? <span className="initials text-xl font-extrabold">{getInitials(activeUser.name)}</span>
      : <UserIcon className="h-6 w-6" />;
  }

  const Icon = getNavigationIcon(key);
  return <Icon className="h-5 w-5" strokeWidth={2.3} />;
}

function getNavigationClickHandler(
  key: ActionNavKey,
  {
    onHomeClick,
    onNavigate,
    onProfileClick,
    onSettingsClick
  }: Pick<SidebarNavigationProps, "onHomeClick" | "onNavigate" | "onProfileClick" | "onSettingsClick">
) {
  switch (key) {
    case "home":
      return onHomeClick;
    case "settings":
      return onSettingsClick;
    case "profile":
      return onProfileClick;
    default:
      return () => onNavigate(key);
  }
}

function NavigationButtonList({
  activeUser,
  className,
  hidePrimaryKeysOnDesktop,
  keys,
  props
}: {
  activeUser: UserRecord | null;
  className?: string;
  hidePrimaryKeysOnDesktop?: boolean;
  keys: ActionNavKey[];
  props: SidebarNavigationProps;
}) {
  return (
    <div className={className}>
      {keys.map((key) => (
        <NavigationButton
          active={isKeyActive(key, props)}
          ariaLabel={getNavigationLabel(key)}
          className={hidePrimaryKeysOnDesktop && getPrimaryNavigationKeys(props.activeUser).includes(key as PrimaryNavKey) ? "md:hidden" : undefined}
          isFading={key === "binance" && props.binanceFading}
          key={key}
          onClick={getNavigationClickHandler(key, props)}
          title={key === "home" ? "Home" : undefined}
        >
          {renderNavigationIcon(key, activeUser)}
        </NavigationButton>
      ))}
    </div>
  );
}

export function SidebarNavigation(props: SidebarNavigationProps) {
  const { activeUser, title } = props;
  const primaryKeys = getPrimaryNavigationKeys(activeUser);
  const actionKeys = getActionNavigationKeys(props);

  return (
    <aside className="order-3 flex h-[88px] w-full flex-row items-center justify-between rounded-[22px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-shell)] p-3 transition-all duration-500 ease-out md:order-none md:row-start-2 md:h-auto md:w-auto md:flex-col md:justify-between md:translate-x-0 md:opacity-100">
      <NavigationButtonList
        activeUser={activeUser}
        className="hidden md:flex md:flex-col md:gap-2"
        keys={primaryKeys}
        props={props}
      />
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--text-dim)] md:hidden">
        {activeUser ? activeUser.name : title}
      </div>
      <NavigationButtonList
        activeUser={activeUser}
        className="flex gap-2 md:flex-col"
        hidePrimaryKeysOnDesktop
        keys={actionKeys}
        props={props}
      />
    </aside>
  );
}
