import { createPortal } from "react-dom";

type ChartReferenceLabelProps = {
  overlayId?: string;
  selectedValue?: number | null;
  value?: number;
  viewBox?: { x: number; y: number };
};

export function ChartReferenceLabel({
  overlayId = "chart-reference-overlay",
  selectedValue,
  value,
  viewBox
}: ChartReferenceLabelProps) {
  if (!viewBox) return null;

  const rawValue = typeof selectedValue === "number" ? selectedValue : (typeof value === "number" ? value : 0);
  const formattedValue = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(rawValue / 100);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const rectWidth = isMobile ? 64 : 72;
  const rectHeight = 24;
  const top = viewBox.y - rectHeight / 2;
  const left = isMobile ? Math.max(2, viewBox.x - rectWidth / 2) : viewBox.x - rectWidth + 2;
  const overlayTarget = typeof document !== "undefined" ? document.getElementById(overlayId) : null;

  if (!overlayTarget) return null;

  return createPortal(
    <div
      className="pointer-events-none absolute z-[100] flex items-center justify-center rounded-[12px] border-2 border-[#444444] bg-[#1a1a1a] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4)]"
      style={{ top, left, width: rectWidth, height: rectHeight }}
    >
      <span className="whitespace-nowrap text-[10px] font-bold text-white">
        {isMobile ? formattedValue.replace(/\s/g, "").replace(",00", "") : formattedValue.replace(/\s/g, "")}
      </span>
    </div>,
    overlayTarget
  );
}
