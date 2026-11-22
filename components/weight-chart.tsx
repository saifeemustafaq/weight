"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { formatDayKey } from "@/lib/dates";
import { formatAmount, formatSigned } from "@/lib/format";
import type { Member, WeighIn } from "@/lib/types";
import { fromUnit, toUnit, type Unit } from "@/lib/units";

const VIEW_W = 800;
const VIEW_H = 460;
const PAD = { l: 108, r: 24, t: 28, b: 64 };

const DASH = ["", "7 5", "2 3", "9 4 2 4"];

type Mode = "change" | "weight";

type Point = {
  dayKey: string;
  weight: number;
  delta: number;
};

type Series = {
  member: Member;
  points: Point[];
};

function buildSeries(members: Member[], entries: WeighIn[], unit: Unit): Series[] {
  return members.map((member) => {
    const rows = entries
      .filter((entry) => entry.personId === member.id)
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    const first = toUnit(rows[0]?.weight ?? 0, unit);
    return {
      member,
      points: rows.map((row) => ({
        dayKey: row.dayKey,
        weight: Math.round(toUnit(row.weight, unit) * 10) / 10,
        delta: Math.round((toUnit(row.weight, unit) - first) * 10) / 10,
      })),
    };
  });
}

export function WeightChart({
  members,
  entries,
  unit,
}: {
  members: Member[];
  entries: WeighIn[];
  unit: Unit;
}) {
  const series = useMemo(() => buildSeries(members, entries, unit), [members, entries, unit]);
  const populated = series.filter((item) => item.points.length > 0);
  const canCompare = populated.some((item) => item.points.length >= 2);
  const [mode, setMode] = useState<Mode>(canCompare ? "change" : "weight");
  const [hidden, setHidden] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);

  const visible = populated.filter((item) => !hidden.includes(item.member.id));
  const days = [
    ...new Set(visible.flatMap((item) => item.points.map((point) => point.dayKey))),
  ].sort();

  const shown = active && days.includes(active) ? active : (days[days.length - 1] ?? null);

  const plotW = VIEW_W - PAD.l - PAD.r;
  const plotH = VIEW_H - PAD.t - PAD.b;

  const values = visible.flatMap((item) =>
    item.points.map((point) => (mode === "weight" ? point.weight : point.delta)),
  );
  let min = values.length ? Math.min(...values) : 0;
  let max = values.length ? Math.max(...values) : 1;
  if (mode === "change") {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const slack = (max - min) * 0.14;
  min -= slack;
  max += slack;

  function xAt(index: number): number {
    if (days.length <= 1) return PAD.l + plotW / 2;
    return PAD.l + (index / (days.length - 1)) * plotW;
  }

  function yAt(value: number): number {
    return PAD.t + ((max - value) / (max - min)) * plotH;
  }

  const ticks = Array.from({ length: 4 }, (_, index) => {
    const value = max - ((max - min) * index) / 3;
    return { value, y: yAt(value) };
  });

  const labelIndexes = (() => {
    if (days.length <= 6) return days.map((_, index) => index);
    const picks = new Set<number>();
    for (let index = 0; index < 5; index += 1) {
      picks.add(Math.round((index * (days.length - 1)) / 4));
    }
    return [...picks].sort((a, b) => a - b);
  })();

  function locate(event: PointerEvent<SVGSVGElement>) {
    if (days.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * VIEW_W;
    let nearest = 0;
    let best = Infinity;
    days.forEach((_, index) => {
      const distance = Math.abs(xAt(index) - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setActive(days[nearest]);
  }

  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <h2 className="font-serif text-3xl tracking-tight">The mornings</h2>
      <div className="mt-3 grid grid-cols-2 rounded-full bg-paper p-1 text-base">
        <button
          type="button"
          onClick={() => setMode("change")}
          className={`h-11 rounded-full touch-manipulation ${mode === "change" ? "bg-ink text-paper" : "text-muted"}`}
        >
          Since day one
        </button>
        <button
          type="button"
          onClick={() => setMode("weight")}
          className={`h-11 rounded-full touch-manipulation ${mode === "weight" ? "bg-ink text-paper" : "text-muted"}`}
        >
          {unit === "kg" ? "Kilograms" : "Pounds"}
        </button>
      </div>

      {populated.length === 0 ? (
        <p className="mt-8 text-muted">The graph starts with this morning.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {populated.map((item, index) => {
              const off = hidden.includes(item.member.id);
              return (
                <button
                  key={item.member.id}
                  type="button"
                  onClick={() =>
                    setHidden((current) =>
                      current.includes(item.member.id)
                        ? current.filter((id) => id !== item.member.id)
                        : [...current, item.member.id],
                    )
                  }
                  className={`flex h-11 items-center gap-2 rounded-full border px-3 text-sm touch-manipulation ${off ? "border-line text-muted opacity-45" : "border-line bg-paper text-ink"}`}
                  aria-pressed={!off}
                >
                  <svg width="28" height="8" aria-hidden>
                    <line
                      x1="0"
                      y1="4"
                      x2="28"
                      y2="4"
                      stroke={item.member.color}
                      strokeWidth="2.5"
                      strokeDasharray={DASH[index % DASH.length]}
                    />
                  </svg>
                  {item.member.name}
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="mt-8 text-muted">Turn someone back on to see the graph.</p>
          ) : (
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="mt-4 h-auto w-full touch-pan-y font-sans"
              role="img"
              aria-label="Weight over time"
              onPointerMove={locate}
              onPointerDown={locate}
              onPointerLeave={() => setActive(null)}
            >
              {ticks.map((tick) => (
                <g key={tick.y}>
                  <line
                    x1={PAD.l}
                    x2={VIEW_W - PAD.r}
                    y1={tick.y}
                    y2={tick.y}
                    stroke="#e4d8c6"
                  />
                  <text
                    x={PAD.l - 8}
                    y={tick.y + 4}
                    textAnchor="end"
                    fontSize="26"
                    fill="#6f6458"
                  >
                    {mode === "change"
                      ? formatSigned(fromUnit(tick.value, unit), unit)
                      : formatAmount(fromUnit(tick.value, unit), unit)}
                  </text>
                </g>
              ))}

              {mode === "change" && (
                <line
                  x1={PAD.l}
                  x2={VIEW_W - PAD.r}
                  y1={yAt(0)}
                  y2={yAt(0)}
                  stroke="#241c15"
                  strokeOpacity="0.35"
                  strokeDasharray="3 4"
                />
              )}

              {shown && (
                <line
                  x1={xAt(days.indexOf(shown))}
                  x2={xAt(days.indexOf(shown))}
                  y1={PAD.t}
                  y2={PAD.t + plotH}
                  stroke="#241c15"
                  strokeOpacity="0.18"
                />
              )}

              {visible.map((item) => {
                const index = populated.findIndex(
                  (candidate) => candidate.member.id === item.member.id,
                );
                const path = item.points
                  .map((point, pointIndex) => {
                    const command = pointIndex === 0 ? "M" : "L";
                    const x = xAt(days.indexOf(point.dayKey));
                    const y = yAt(mode === "weight" ? point.weight : point.delta);
                    return `${command}${x.toFixed(1)} ${y.toFixed(1)}`;
                  })
                  .join(" ");
                const last = item.points[item.points.length - 1];
                return (
                  <g key={item.member.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke={item.member.color}
                      strokeWidth="5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={DASH[index % DASH.length]}
                    />
                    {item.points.map((point) => (
                      <circle
                        key={point.dayKey}
                        cx={xAt(days.indexOf(point.dayKey))}
                        cy={yAt(mode === "weight" ? point.weight : point.delta)}
                        r={point === last ? 8 : item.points.length > 16 ? 0 : 5}
                        fill={item.member.color}
                      />
                    ))}
                  </g>
                );
              })}

              {labelIndexes.map((index) => (
                <text
                  key={days[index]}
                  x={xAt(index)}
                  y={VIEW_H - 16}
                  textAnchor={index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"}
                  fontSize="26"
                  fill="#6f6458"
                >
                  {formatDayKey(days[index], { month: "short", day: "numeric" })}
                </text>
              ))}
            </svg>
          )}

          {shown && visible.length > 0 && (
            <div className="mt-2 border-t border-line pt-4">
              <p className="text-sm text-muted">
                {formatDayKey(shown, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {visible.map((item) => {
                  const point = item.points.find((candidate) => candidate.dayKey === shown);
                  const value = point
                    ? mode === "weight"
                      ? `${point.weight.toFixed(1)} ${unit}`
                      : `${formatSigned(fromUnit(point.delta, unit), unit)} ${unit}`
                    : "—";
                  return (
                    <li key={item.member.id} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: item.member.color }}
                      />
                      <span className="flex-1">{item.member.name}</span>
                      <span className="tabular-nums">{value}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
