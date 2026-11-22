import { toUnit, type Unit } from "@/lib/units";

// Every function takes pounds, the stored unit, and reads out in `unit`.

function rounded(value: number, unit: Unit): number {
  return Math.round(Math.abs(toUnit(value, unit)) * 10) / 10;
}

export function formatAmount(value: number, unit: Unit): string {
  const amount = rounded(value, unit);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

export function formatSigned(value: number, unit: Unit): string {
  const amount = rounded(value, unit);
  if (amount === 0) return "0";
  return (value < 0 ? "−" : "+") + formatAmount(value, unit);
}

export function formatWeekly(weekly: number, unit: Unit): string {
  if (rounded(weekly, unit) === 0) return "holding steady";
  return `${formatSigned(weekly, unit)} ${unit}/week`;
}

export function formatSpan(total: number, spanDays: number, unit: Unit): string {
  const days = Math.max(1, Math.round(spanDays));
  const dayWord = days === 1 ? "day" : "days";
  const amount = rounded(total, unit);
  if (amount === 0) return `Unchanged over ${days} ${dayWord}`;
  const how = total < 0 ? "down" : "up";
  return `${formatAmount(total, unit)} ${unit} ${how} over ${days} ${dayWord}`;
}

export function ratePhrase(weekly: number, unit: Unit): string {
  if (rounded(weekly, unit) === 0) return "holding steady";
  const how = weekly < 0 ? "down" : "up";
  return `${how} ${formatAmount(weekly, unit)} ${unit} a week`;
}
