import { toUnit, type Unit } from "@/lib/units";
import type { WeighIn } from "@/lib/types";

export type TrendPoint = {
  /** Whole days since 1970-01-01, so spacing follows the calendar. */
  day: number;
  /** Raw weigh-in, in the unit being shown. */
  value: number;
  /** Average of the last week of weigh-ins, up to and including this one. */
  smooth: number;
};

const SMOOTH_DAYS = 7;

export function dayNumber(dayKey: string): number {
  return Math.round(Date.parse(`${dayKey}T00:00:00Z`) / 86_400_000);
}

/**
 * One person's mornings with a weekly average beside each. A single morning
 * moves by water and food as much as by fat, so the average is the line to read.
 */
export function trendFor(personId: string, entries: WeighIn[], unit: Unit): TrendPoint[] {
  const rows = entries
    .filter((entry) => entry.personId === personId)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
    .map((entry) => ({ day: dayNumber(entry.dayKey), value: toUnit(entry.weight, unit) }));

  return rows.map((row) => {
    const recent = rows.filter(
      (other) => other.day <= row.day && other.day > row.day - SMOOTH_DAYS,
    );
    const smooth = recent.reduce((sum, other) => sum + other.value, 0) / recent.length;
    return { ...row, smooth };
  });
}
