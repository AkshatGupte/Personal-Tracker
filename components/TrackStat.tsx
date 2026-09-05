/**
 * One measurement in the track header: small-caps label, large numeral.
 *
 * **The check-in beat is gone from here**, along with the check-in it reported.
 * This used to listen for a beat and misregister the one numeral a check-in had
 * moved — a composed moment rather than four unrelated updates. That machinery
 * published from the task row, and the restructure removed tasks; a provider
 * nothing can fire is worse than no provider, so it went with them.
 *
 * `tone="ember"` keeps its meaning: yellow marks real consistency, and a zero
 * streak stays muted rather than being congratulated for nothing.
 */
export default function TrackStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ember";
}) {
  const rest =
    tone === "ember"
      ? value > 0
        ? "text-streak"
        : "text-muted"
      : "text-fg";

  return (
    <div>
      <dt className="font-label text-[0.6rem] uppercase tracking-[0.17em] text-muted">
        {label}
      </dt>
      <dd className={`mt-1.5 font-mono text-3xl font-medium leading-none tracking-tight tabular-nums ${rest}`}>
        {value}
      </dd>
    </div>
  );
}
