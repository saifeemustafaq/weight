import { MAX_WEIGHT, MIN_WEIGHT, parseWeight } from "@/lib/members";

/**
 * The database always holds pounds. A unit is only how a person reads and
 * types a number, so switching it never rewrites a stored weigh-in.
 */
export type Unit = "lb" | "kg";

export const LB_PER_KG = 2.20462262185;

export function toUnit(lb: number, unit: Unit): number {
  return unit === "kg" ? lb / LB_PER_KG : lb;
}

export function fromUnit(value: number, unit: Unit): number {
  return unit === "kg" ? value * LB_PER_KG : value;
}

/** A stored weight as the one-decimal text shown in a field. */
export function formatWeight(lb: number, unit: Unit): string {
  return toUnit(lb, unit).toFixed(1);
}

const NUMBER = /^\d{2,3}(\.\d{1,2})?$/;

/** The number typed in a field, in the unit it was typed in. */
export function parseTyped(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  return NUMBER.test(trimmed) ? Number(trimmed) : null;
}

/** A typed weight as pounds rounded to 0.1, or null when it is out of range. */
export function parseEntered(value: string, unit: Unit): number | null {
  if (unit === "lb") return parseWeight(value);
  const typed = parseTyped(value);
  return typed === null ? null : parseWeight(fromUnit(typed, "kg"));
}

export function rangeMessage(unit: Unit): string {
  return unit === "kg"
    ? `Enter a weight between ${Math.ceil(MIN_WEIGHT / LB_PER_KG)} and ${Math.floor(MAX_WEIGHT / LB_PER_KG)} kg.`
    : `Enter a weight between ${MIN_WEIGHT} and ${MAX_WEIGHT} lb.`;
}
