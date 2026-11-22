"use client";

import { formatSpan, formatWeekly } from "@/lib/format";
import { describePace, type Pace } from "@/lib/stats";
import type { Member, WeighIn } from "@/lib/types";
import type { Unit } from "@/lib/units";

export function PaceBoard({
  members,
  entries,
  unit,
}: {
  members: Member[];
  entries: WeighIn[];
  unit: Unit;
}) {
  const names = new Map(members.map((member) => [member.id, member.name]));
  const report = describePace(entries, members.map((member) => member.id), (id) => names.get(id) ?? "Someone", unit);
  const paceById = new Map(report.paces.map((pace) => [pace.personId, pace]));
  const comparableIds = new Set(report.comparable.map((pace) => pace.personId));

  const ordered = [...members].sort((a, b) => {
    const left = report.comparable.findIndex((pace) => pace.personId === a.id);
    const right = report.comparable.findIndex((pace) => pace.personId === b.id);
    if (left === -1 && right === -1) return a.order - b.order;
    if (left === -1) return 1;
    if (right === -1) return -1;
    return left - right;
  });

  const peak = Math.max(
    0.2,
    ...report.comparable.map((pace) => Math.abs(pace.weekly)),
  );

  return (
    <section>
      <h2 className="font-serif text-3xl tracking-tight">Who&apos;s losing</h2>
      <p className="mt-2 text-lg leading-snug" aria-live="polite">
        {report.headline}
      </p>

      {(report.lead || report.lag) && (
        <div className="mt-4 overflow-hidden rounded-3xl bg-ink text-paper">
          {report.lead && (
            <CalloutRow
              label={report.lead.label}
              name={names.get(report.lead.personId) ?? ""}
              pace={report.lead.pace}
              unit={unit}
              featured
            />
          )}
          {report.lead && report.lag && <div className="mx-5 border-t border-white/15" />}
          {report.lag && (
            <CalloutRow
              label={report.lag.label}
              name={names.get(report.lag.personId) ?? ""}
              pace={report.lag.pace}
              unit={unit}
            />
          )}
        </div>
      )}

      <ol className="mt-5 space-y-3">
        {ordered.map((member) => {
          const pace = paceById.get(member.id) ?? null;
          const comparable = pace ? comparableIds.has(member.id) : false;
          return (
            <li key={member.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: member.color }}
                    aria-hidden
                  />
                  {member.name}
                </span>
                <span className="tabular-nums text-muted">
                  {pace && comparable
                    ? formatWeekly(pace.weekly, unit)
                    : pace
                      ? "One more morning"
                      : "No weigh-in yet"}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                {pace && comparable && (
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(8, (Math.abs(pace.weekly) / peak) * 100)}%`,
                      background: pace.weekly < -0.05 ? member.color : "#b7aa9c",
                    }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CalloutRow({
  label,
  name,
  pace,
  unit,
  featured = false,
}: {
  label: string;
  name: string;
  pace: Pace;
  unit: Unit;
  featured?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <p className={`text-[11px] font-medium tracking-[0.16em] uppercase ${featured ? "text-[#f0c2a8]" : "text-paper/60"}`}>
        {label}
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="font-serif text-3xl tracking-tight">{name}</p>
        <p className="text-sm tabular-nums text-paper/80">{formatWeekly(pace.weekly, unit)}</p>
      </div>
      <p className="mt-1 text-sm text-paper/65">{calloutDetail(pace, unit)}</p>
    </div>
  );
}

function calloutDetail(pace: Pace, unit: Unit): string {
  const trendDown = pace.weekly < -0.05;
  const trendUp = pace.weekly > 0.05;
  const totalDown = pace.total < -0.05;
  const totalUp = pace.total > 0.05;
  const jumped = (trendDown && totalUp) || (trendUp && totalDown);
  if (jumped) {
    return `${pace.count} mornings. The latest one sits off the trend line.`;
  }
  return formatSpan(pace.total, pace.spanDays, unit);
}
