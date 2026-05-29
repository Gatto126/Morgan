type ChartTimeRangeControlsProps<TRange extends string> = {
  className?: string;
  onTimeRangeChange: (range: TRange) => void;
  ranges: readonly TRange[];
  testId?: string;
  timeRange: TRange;
};

export function ChartTimeRangeControls<TRange extends string>({
  className = "absolute right-0 top-0 z-10 flex items-center justify-end gap-0.5",
  onTimeRangeChange,
  ranges,
  testId,
  timeRange
}: ChartTimeRangeControlsProps<TRange>) {
  return (
    <div className={className} data-testid={testId}>
      {ranges.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onTimeRangeChange(range)}
          className="cursor-pointer rounded-md px-1.5 py-0 text-[8.5px] font-bold uppercase tracking-wider transition-colors duration-150 sm:text-[10px]"
          style={{
            background: timeRange === range ? "rgba(255,255,255,0.08)" : "transparent",
            color: timeRange === range ? "#f5f5f5" : "#737373"
          }}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
