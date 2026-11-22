import { dayNumber, trendFor } from "@/lib/trend";
import type { WeighIn } from "@/lib/types";
import type { Unit } from "@/lib/units";

const W = 88;
const H = 32;
const PAD = 4;
const DAYS = 14;

/**
 * A fortnight at a glance beside a name. No numbers: the line below the card
 * carries those. Flat means holding steady, so the vertical scale never drops
 * under one kilogram (two pounds) and a quiet fortnight stays quiet.
 */
export function Trend({
  personId,
  entries,
  today,
  unit,
  color,
}: {
  personId: string;
  entries: WeighIn[];
  today: string;
  unit: Unit;
  color: string;
}) {
  const last = dayNumber(today);
  const first = last - (DAYS - 1);
  const points = trendFor(personId, entries, unit).filter((point) => point.day >= first);
  if (points.length < 2) return null;

  const values = points.flatMap((point) => [point.value, point.smooth]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = Math.max(high - low, unit === "kg" ? 1 : 2);
  const middle = (high + low) / 2;

  const x = (day: number) => PAD + ((day - first) / (DAYS - 1)) * (W - PAD * 2);
  const y = (value: number) => PAD + (0.5 - (value - middle) / range) * (H - PAD * 2);

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.day).toFixed(1)} ${y(point.smooth).toFixed(1)}`)
    .join(" ");
  const end = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-8 w-[88px] shrink-0"
      aria-hidden
    >
      {points.map((point) => (
        <circle
          key={point.day}
          cx={x(point.day)}
          cy={y(point.value)}
          r="1.8"
          fill={color}
          opacity="0.35"
        />
      ))}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(end.day)} cy={y(end.smooth)} r="3.2" fill={color} />
    </svg>
  );
}
