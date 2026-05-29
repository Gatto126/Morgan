import { createPortal } from "react-dom";

type DashboardChartReferenceLabelProps = {
  selectedValue?: number | null;
  value?: number;
  viewBox?: {
    x: number;
    y: number;
  };
};

export function DashboardChartReferenceLabel({
  selectedValue,
  value,
  viewBox
}: DashboardChartReferenceLabelProps) {
  if (!viewBox) return null;

  const referenceValue = typeof selectedValue === "number" ? selectedValue : (typeof value === "number" ? value : 0);
  const formattedValue = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(referenceValue / 100);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const rectWidth = isMobile ? 64 : 72;
  const rectHeight = 24;
  const top = viewBox.y - rectHeight / 2;
  const left = isMobile
    ? Math.max(2, viewBox.x - rectWidth / 2)
    : viewBox.x - rectWidth + 2;

  const overlayTarget = typeof document !== "undefined" ? document.getElementById("chart-reference-overlay") : null;
  if (!overlayTarget) return null;

  return createPortal(
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: rectWidth,
        height: rectHeight,
        backgroundColor: "#1a1a1a",
        border: "2px solid #444444",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 100,
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.4)"
      }}
    >
      <span
        style={{
          color: "#ffffff",
          fontSize: "10px",
          fontWeight: "bold",
          whiteSpace: "nowrap"
        }}
      >
        {isMobile ? formattedValue.replace(/\s/g, "").replace(",00", "") : formattedValue.replace(/\s/g, "")}
      </span>
    </div>,
    overlayTarget
  );
}
