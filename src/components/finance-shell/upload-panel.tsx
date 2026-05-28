"use client";

import { EmptyChartAction } from "./empty-chart-action";

type UploadPanelProps = {
  parsing: boolean;
  error: string | null;
  notice: string | null;
  onUpload: () => void;
};

export function UploadPanel({ parsing, error, notice, onUpload }: UploadPanelProps) {
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
