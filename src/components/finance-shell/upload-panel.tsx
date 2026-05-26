"use client";

import { Button } from "@/components/ui/button";

const primaryActionButtonClass =
  "w-full min-w-0 max-w-[240px] text-xl min-[420px]:w-auto sm:min-w-62 sm:text-[2rem]";
const primaryStackClass = "space-y-6 text-center transition-all duration-300 ease-out";

type UploadPanelProps = {
  parsing: boolean;
  error: string | null;
  notice: string | null;
  onUpload: () => void;
};

export function UploadPanel({ parsing, error, notice, onUpload }: UploadPanelProps) {
  return (
    <div className={primaryStackClass}>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-[-0.06em] text-white sm:text-[2.35rem]">Upload</h1>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 min-[420px]:flex-row">
        <Button className={primaryActionButtonClass} disabled={parsing} onClick={onUpload}>
          {parsing ? "Loading" : "Upload"}
        </Button>
      </div>

      {error ? <p className="text-sm text-[color:var(--danger)] mt-2">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-200 mt-2">{notice}</p> : null}
    </div>
  );
}
