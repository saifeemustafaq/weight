"use client";

import { useMemo } from "react";
import { formatDayKey } from "@/lib/dates";
import { formatSigned } from "@/lib/format";
import { trendFor } from "@/lib/trend";
import type { Member, WeighIn } from "@/lib/types";
import { fromUnit, type Unit } from "@/lib/units";

const VIEW_W = 800;
const VIEW_H = 440;
const PAD = { l: 108, r: 28, t: 28, b: 64 };
const DAY_MS = 86_400_000;

type Point = {
  day: number;
  /** Change from this person's first morning, as weighed that morning. */
  raw: number;
  /** The same change after averaging the last week. */
  smooth: number;
};

type Series = {
  member: Member;
  points: Point[];
};

function buildSeries(members: Member[], entries: WeighIn[], unit: Unit): Series[] {
  return members
    .map((member) => {
      const rows = trendFor(member.id, entries, unit);
      const start = rows[0]?.value ?? 0;
      return {
        member,
        points: rows.map((row) => ({
          day: row.day,
          raw: row.value - start,
          smooth: row.smooth - start,
        })),
      };
    })
    .filter((item) => item.points.length > 0);
}

function dayLabel(day: number): string {
  return formatDayKey(new Date(day * DAY_MS).toISOString().slice(0, 10), {
    month: "short",
    day: "numeric",
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
  const drawn = series.filter((item) => item.points.length >= 2);

  const signed = (value: number) => formatSigned(fromUnit(value, unit), unit);

  if (drawn.length === 0) {
    return (
      <section className="rounded-3xl border border-line bg-card p-4">
        <h2 className="font-serif text-3xl tracking-tight">Since day one</h2>
        <p className="mt-3 text-muted">Two mornings draw the first line.</p>
      </section>
    );
  }

  const days = drawn.flatMap((item) => item.points.map((point) => point.day));
  const firstDay = Math.min(...days);
  const lastDay = Math.max(...days);
  const span = Math.max(1, lastDay - firstDay);

  const plotW = VIEW_W - PAD.l - PAD.r;
  const plotH = VIEW_H - PAD.t - PAD.b;

  const values = drawn.flatMap((item) => item.points.flatMap((p) => [p.raw, p.smooth]));
  // Zero stays on the chart, and one kilogram (two pounds) is the least a
  // quiet week is stretched to, so a flat line reads as flat.
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  const least = unit === "kg" ? 1 : 2;
  if (max - min < least) {
    const middle = (max + min) / 2;
    min = middle - least / 2;
    max = middle + least / 2;
  }
  const slack = (max - min) * 0.14;
  min -= slack;
  max += slack;

  const x = (day: number) => PAD.l + ((day - firstDay) / span) * plotW;
  const y = (value: number) => PAD.t + ((max - value) / (max - min)) * plotH;

  // Round-number gridlines (…, −1, 0, +1, …) so the zero line is always labelled.
  const step =
    [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].find((size) => (max - min) / size <= 5) ?? 100;
  const ticks: { value: number; y: number }[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max + 1e-9; value += step) {
    const clean = Math.round(value / step) * step;
    ticks.push({ value: clean, y: y(clean) });
  }

  const labelDays = [
    ...new Set(
      Array.from({ length: Math.min(5, span + 1) }, (_, index) =>
        Math.round(firstDay + (index * span) / (Math.min(5, span + 1) - 1)),
      ),
    ),
  ];

  const line = (item: Series, pick: (point: Point) => number) =>
    item.points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.day).toFixed(1)} ${y(pick(point)).toFixed(1)}`)
      .join(" ");

  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <h2 className="font-serif text-3xl tracking-tight">Since day one</h2>
      <p className="mt-1 text-sm text-muted">
        Change from each person&apos;s first morning. The bold line smooths out day-to-day swings.
      </p>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="mt-4 h-auto w-full font-sans"
        role="img"
        aria-label="Change in weight since each person's first morning"
      >
        {ticks.map((tick) => (
          <g key={tick.y}>
            <line x1={PAD.l} x2={VIEW_W - PAD.r} y1={tick.y} y2={tick.y} stroke="#e4d8c6" />
            <text x={PAD.l - 8} y={tick.y + 4} textAnchor="end" fontSize="26" fill="#6f6458">
              {signed(tick.value)}
            </text>
          </g>
        ))}

        <line
          x1={PAD.l}
          x2={VIEW_W - PAD.r}
          y1={y(0)}
          y2={y(0)}
          stroke="#241c15"
          strokeOpacity="0.35"
          strokeDasharray="3 4"
        />

        {drawn.map((item) => {
          const end = item.points[item.points.length - 1];
          return (
            <g key={item.member.id}>
              <path
                d={line(item, (point) => point.raw)}
                fill="none"
                stroke={item.member.color}
                strokeOpacity="0.28"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={line(item, (point) => point.smooth)}
                fill="none"
                stroke={item.member.color}
                strokeWidth="6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={x(end.day)} cy={y(end.smooth)} r="9" fill={item.member.color} />
            </g>
          );
        })}

        {labelDays.map((day, index) => (
          <text
            key={day}
            x={x(day)}
            y={VIEW_H - 16}
            textAnchor={index === 0 ? "start" : index === labelDays.length - 1 ? "end" : "middle"}
            fontSize="26"
            fill="#6f6458"
          >
            {dayLabel(day)}
          </text>
        ))}
      </svg>

      <ul className="mt-2 grid gap-1.5 border-t border-line pt-4">
        {series.map((item) => {
          const first = item.points[0];
          const last = item.points[item.points.length - 1];
          return (
            <li key={item.member.id} className="flex items-center gap-2.5 text-base">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: item.member.color }}
                aria-hidden
              />
              <span className="flex-1 truncate">{item.member.name}</span>
              <span className="tabular-nums">
                {item.points.length >= 2 ? `${signed(last.raw - first.raw)} ${unit}` : "Just started"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
