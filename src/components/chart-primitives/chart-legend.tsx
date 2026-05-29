import { cn } from "@/shared/utils";

export type ChartLegendItem = {
  color: string;
  key: string;
  label: string;
  labelClassName?: string;
};

type ChartLegendProps = {
  className?: string;
  hiddenSeries: Record<string, boolean>;
  items: ChartLegendItem[];
  labelClassName?: string;
  onToggleSeries: (key: string) => void;
  testId?: string;
  transactionCount: number;
};

export function ChartLegend({
  className = "flex items-center justify-center gap-3 sm:gap-4 flex-wrap w-full pt-2 pb-0",
  hiddenSeries,
  items,
  labelClassName,
  onToggleSeries,
  testId,
  transactionCount
}: ChartLegendProps) {
  const visibleCount = items.filter((item) => !hiddenSeries[item.key]).length;

  return (
    <div
      className={className}
      data-testid={testId}
      style={{ visibility: transactionCount > 0 ? "visible" : "hidden" }}
    >
      {items.map((item) => {
        const isHidden = !!hiddenSeries[item.key];
        const isLastVisible = !isHidden && visibleCount <= 1;
        const color = isHidden ? "#4C4C4C" : item.color;

        return (
          <div key={item.key} style={{ color }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isLastVisible) return;
                onToggleSeries(item.key);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  if (isLastVisible) return;
                  onToggleSeries(item.key);
                }
              }}
              className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider select-none outline-none whitespace-nowrap ${
                isLastVisible ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              style={{ WebkitTapHighlightColor: "transparent", color: "inherit" }}
            >
              <div
                className="h-[6px] w-[14px] flex-shrink-0 rounded-full sm:h-[8px] sm:w-[16px]"
                style={{ backgroundColor: color }}
              />
              <span className={cn(labelClassName, item.labelClassName, isHidden && "line-through")}>{item.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
