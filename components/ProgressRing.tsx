/**
 * Circular completion ring, drawn as SVG so it can animate its own stroke on
 * load. Shows real task completion — never an invented XP or level number.
 */
export default function ProgressRing({
  completed,
  total,
  label = "Task progress",
}: {
  completed: number;
  total: number;
  /** Names what the ring covers, used in the text alternative. */
  label?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (percent / 100);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg
          width="168"
          height="168"
          viewBox="0 0 168 168"
          className="-rotate-90"
          role="img"
          aria-label={
            total === 0
              ? `${label}: no tasks yet.`
              : `${label}: ${completed} of ${total} tasks complete, ${percent} percent.`
          }
        >
          <circle
            cx="84"
            cy="84"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="12"
          />
          {/*
            At 0% the round line cap would still paint a dot, reading as a
            sliver of progress that does not exist — so draw nothing.
          */}
          {percent > 0 && (
            <circle
              cx="84"
              cy="84"
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              style={{
                ["--ring-circumference" as string]: circumference,
                filter: "drop-shadow(0 0 6px var(--card-edge))",
                animation: "ring-draw 1.1s cubic-bezier(0.22, 1, 0.36, 1) both",
              }}
            />
          )}
        </svg>
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-4xl font-extrabold leading-none">{percent}%</span>
          <span className="mt-1 text-xs text-muted">complete</span>
        </div>
      </div>

      <p aria-hidden="true" className="tabular text-sm text-muted">
        <span className="font-semibold text-fg">{completed}</span> of{" "}
        <span className="font-semibold text-fg">{total}</span> tasks done
      </p>
    </div>
  );
}
