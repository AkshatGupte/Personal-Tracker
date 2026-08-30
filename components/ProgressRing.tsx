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
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
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
              /*
                Keyed by the value so finishing a task re-runs the draw: the
                ring visibly advances to its new length instead of snapping.
              */
              key={percent}
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
                animation: "ring-draw 1.1s cubic-bezier(0.22, 1, 0.36, 1) both",
              }}
            />
          )}
        </svg>
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-4xl font-medium leading-none tracking-tight tabular-nums">
            {percent}%
          </span>
          <span className="mt-1.5 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-muted">
            complete
          </span>
        </div>
      </div>

      <p aria-hidden="true" className="font-mono text-[0.65rem] uppercase leading-relaxed tracking-[0.14em] tabular-nums text-muted">
        <span className="text-fg">{completed}</span> of <span className="text-fg">{total}</span> tasks
      </p>
    </div>
  );
}
