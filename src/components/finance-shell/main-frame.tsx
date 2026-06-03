"use client";

import type { ChangeEvent, ReactNode, RefObject } from "react";
import dynamic from "next/dynamic";

import PlusIcon from "../ui/plus-icon";
import { DashboardStageStack } from "./dashboard-stage-stack";
import { SidebarNavigation } from "./sidebar-navigation";
import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

import { cn } from "@/shared/utils";

const DashboardTopbarShell = dynamic(
  () => import("./dashboard-topbar-shell").then((mod) => mod.DashboardTopbarShell),
  { ssr: false }
);

type FinanceShellMainFrameProps = {
  activeUser: UserRecord | null;
  appContentRef: RefObject<HTMLDivElement | null>;
  binanceFading: boolean;
  binanceRefreshKey: number;
  canUseHeaderUploadButton: boolean;
  dashboardBackgroundRef: RefObject<HTMLDivElement | null>;
  dashboardCardsPortalRef: RefObject<HTMLDivElement | null>;
  dashboardTabsPortalRef: RefObject<HTMLDivElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  hasUsers: boolean;
  importOverlayFadingOut: boolean;
  importOverlayVisible: boolean;
  isDashboardBackgroundVisible: boolean;
  isDashboardStage: boolean;
  isUploadButtonActive: boolean;
  nonDashboardStageContent: ReactNode;
  renderInlineUploadState: () => ReactNode;
  renderMainFrameOverlay: () => ReactNode;
  showSettingsView: boolean;
  showUserSelectView: boolean;
  stage: Stage;
  title: string;
  warmupDelayMs?: number;
  onBackToSelection: () => void;
  onFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  onFrameClick: () => void;
  onHeaderUploadClick: () => void;
  onHomeClick: () => void;
  onImportRefreshComplete: () => void;
  onNavigate: (stage: Stage) => void;
  onProfileClick: () => void;
  onSettingsClick: () => void;
};

export function FinanceShellMainFrame({
  activeUser,
  appContentRef,
  binanceFading,
  binanceRefreshKey,
  canUseHeaderUploadButton,
  dashboardBackgroundRef,
  dashboardCardsPortalRef,
  dashboardTabsPortalRef,
  fileInputRef,
  hasUsers,
  importOverlayFadingOut,
  importOverlayVisible,
  isDashboardBackgroundVisible,
  isDashboardStage,
  isUploadButtonActive,
  nonDashboardStageContent,
  renderInlineUploadState,
  renderMainFrameOverlay,
  showSettingsView,
  showUserSelectView,
  stage,
  title,
  warmupDelayMs,
  onBackToSelection,
  onFileSelection,
  onFrameClick,
  onHeaderUploadClick,
  onHomeClick,
  onImportRefreshComplete,
  onNavigate,
  onProfileClick,
  onSettingsClick
}: FinanceShellMainFrameProps) {
  return (
    <div ref={appContentRef} className="mx-auto flex min-h-dvh w-full max-w-[1800px] flex-col overflow-y-auto hide-scrollbar px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-5">
      <section className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_320px_auto] sm:grid-rows-[auto_480px_auto] md:grid-cols-[64px_minmax(0,1fr)] md:grid-rows-[auto_520px_auto] lg:grid-rows-[auto_600px_auto] gap-4 content-start lg:gap-5">
        <header className="grid min-h-16 grid-cols-[64px_minmax(0,1fr)] items-center gap-4 md:col-span-2 lg:gap-5">
          <div className="flex h-12 w-12 items-center justify-center justify-self-center rounded-2xl text-[2rem] font-black tracking-[-0.12em] text-white">
            M
          </div>

          <div className="min-w-0">
            <div className="flex h-16 w-full items-center justify-between rounded-[22px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-shell)] px-3">
              <div ref={dashboardTabsPortalRef} id="dashboard-tabs-portal" className="flex h-full min-w-0 flex-1 items-center overflow-x-auto hide-scrollbar mr-2">
                <DashboardTopbarShell
                  activeUser={activeUser}
                  binanceRefreshKey={binanceRefreshKey}
                  isDashboardStage={isDashboardStage}
                  stage={stage}
                />
              </div>
              {activeUser ? (
                <button
                  aria-label="Add document"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] text-[color:var(--text-main)] transition-[background-color,border-color,color,transform,opacity] duration-200 has-lucide",
                    canUseHeaderUploadButton
                      ? "cursor-pointer hover:bg-[color:var(--surface-elevated)] active:scale-[0.985]"
                      : "cursor-default opacity-40"
                  )}
                  data-active={isUploadButtonActive ? "true" : "false"}
                  disabled={!canUseHeaderUploadButton}
                  onClick={onHeaderUploadClick}
                  type="button"
                >
                  <PlusIcon className="h-5 w-5" strokeWidth={2.3} />
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <SidebarNavigation
          activeUser={activeUser}
          binanceFading={binanceFading}
          hasUsers={hasUsers}
          onHomeClick={onHomeClick}
          onNavigate={onNavigate}
          onProfileClick={onProfileClick}
          onSettingsClick={onSettingsClick}
          showSettingsView={showSettingsView}
          showUserSelectView={showUserSelectView}
          stage={stage}
          title={title}
        />

        <section
          className="order-2 flex min-h-0 md:order-none md:row-start-2"
          onClick={onFrameClick}
        >
          <div className="relative flex min-h-0 w-full overflow-hidden rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)]">
            {importOverlayVisible ? (
              <div
                className="absolute inset-0 z-[60] flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)]"
                style={{
                  opacity: importOverlayFadingOut ? 0 : 1,
                  transition: importOverlayFadingOut ? "opacity 550ms cubic-bezier(0.4,0,0.2,1)" : "opacity 180ms ease",
                  pointerEvents: importOverlayFadingOut ? "none" : "all"
                }}
              >
                <div className="import-spinner" />
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-hidden="true"
              style={{ display: "none" }}
              onChange={onFileSelection}
              type="file"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent_22%)]" />
            {renderMainFrameOverlay()}
            <div
              ref={dashboardBackgroundRef}
              data-panel-background="dashboard"
              data-visible={isDashboardBackgroundVisible ? "true" : "false"}
              className="visibility-gate relative flex w-full min-h-0 items-center justify-center p-3 sm:p-5"
            >
              <div className="h-full w-full max-w-none">
                <div className="relative flex h-full min-h-0 flex-col justify-center">
                  <DashboardStageStack
                    activeUser={activeUser}
                    binanceRefreshKey={binanceRefreshKey}
                    isDashboardStage={isDashboardStage}
                    onImportRefreshComplete={onImportRefreshComplete}
                    renderInlineUploadState={renderInlineUploadState}
                    stage={stage}
                    warmupDelayMs={warmupDelayMs}
                  />

                  {nonDashboardStageContent}
                </div>
              </div>
            </div>

            {stage === "create" && hasUsers ? (
              <button
                className="absolute left-4 bottom-4 cursor-pointer border-0 bg-transparent px-2 py-1 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-dim)] shadow-none transition-colors hover:text-white"
                onClick={onBackToSelection}
                type="button"
              >
                &lt;&lt; Back
              </button>
            ) : null}
          </div>
        </section>

        <div ref={dashboardCardsPortalRef} id="dashboard-cards-portal" className="order-4 md:col-start-2 md:row-start-3" />
      </section>
    </div>
  );
}
