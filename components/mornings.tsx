"use client";

import { formatDayKey } from "@/lib/dates";
import type { Member, WeighIn } from "@/lib/types";
import { formatWeight, type Unit } from "@/lib/units";

export function Mornings({
  members,
  entries,
  today,
  unit,
}: {
  members: Member[];
  entries: WeighIn[];
  today: string;
  unit: Unit;
}) {
  const days = [...new Set(entries.map((entry) => entry.dayKey))].sort((a, b) =>
    b.localeCompare(a),
  );

  if (days.length === 0) return null;

  const byDay = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    const row = byDay.get(entry.dayKey) ?? new Map<string, number>();
    row.set(entry.personId, entry.weight);
    byDay.set(entry.dayKey, row);
  }

  return (
    <section>
      <h2 className="font-serif text-3xl tracking-tight">Recent mornings</h2>
      <ol className="mt-3">
        {days.slice(0, 10).map((day) => (
          <li key={day} className="border-t border-line py-3">
            <p className="text-sm text-muted">
              {day === today ? "Today" : formatDayKey(day, { month: "short", day: "numeric" })}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {members.map((member) => {
                const weight = byDay.get(day)?.get(member.id);
                return (
                  <p key={member.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: member.color }}
                      />
                      <span className="truncate">{member.name}</span>
                    </span>
                    <span className="tabular-nums">
                      {weight === undefined ? "—" : formatWeight(weight, unit)}
                    </span>
                  </p>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
