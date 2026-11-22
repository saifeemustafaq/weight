import { formatAmount, ratePhrase } from "@/lib/format";
import type { WeighIn } from "@/lib/types";
import type { Unit } from "@/lib/units";

export type Pace = {
  personId: string;
  /** Ordinary-least-squares slope, in pounds per week. Negative means losing. */
  weekly: number;
  total: number;
  spanDays: number;
  count: number;
  first: number;
  last: number;
  sincePrevious: number | null;
};

export type Callout = {
  personId: string;
  label: "Losing fastest" | "Closest to losing" | "Bare minimum";
  pace: Pace;
};

export type PaceReport = {
  paces: Pace[];
  comparable: Pace[];
  lead: Callout | null;
  lag: Callout | null;
  headline: string;
};

const LOSS = -0.05;

export function paceForPerson(personId: string, entries: WeighIn[]): Pace | null {
  const rows = entries
    .filter((entry) => entry.personId === personId)
    .sort(
      (a, b) =>
        a.dayKey.localeCompare(b.dayKey) ||
        a.recordedAt.localeCompare(b.recordedAt),
    );

  if (rows.length === 0) return null;

  const first = rows[0];
  const last = rows[rows.length - 1];
  const previous = rows.length >= 2 ? rows[rows.length - 2] : null;
  const origin = Date.parse(`${first.dayKey}T00:00:00Z`);
  const points = rows.map((row) => ({
    days: (Date.parse(`${row.dayKey}T00:00:00Z`) - origin) / 86_400_000,
    weight: row.weight,
  }));

  const count = points.length;
  const meanX = points.reduce((sum, point) => sum + point.days, 0) / count;
  const meanY = points.reduce((sum, point) => sum + point.weight, 0) / count;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const dx = point.days - meanX;
    numerator += dx * (point.weight - meanY);
    denominator += dx * dx;
  }

  const perDay = denominator === 0 ? 0 : numerator / denominator;

  return {
    personId,
    weekly: perDay * 7,
    total: last.weight - first.weight,
    spanDays: points[count - 1].days,
    count,
    first: first.weight,
    last: last.weight,
    sincePrevious: previous ? last.weight - previous.weight : null,
  };
}

function byLoss(a: Pace, b: Pace): number {
  if (a.weekly !== b.weekly) return a.weekly - b.weekly;
  if (a.total !== b.total) return a.total - b.total;
  return a.personId.localeCompare(b.personId);
}

function over(spanDays: number): string {
  const days = Math.max(1, Math.round(spanDays));
  return days === 1 ? "over 1 day" : `over ${days} days`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function describePace(
  entries: WeighIn[],
  personIds: string[],
  nameOf: (personId: string) => string,
  unit: Unit = "lb",
): PaceReport {
  const paces = personIds
    .map((personId) => paceForPerson(personId, entries))
    .filter((pace): pace is Pace => pace !== null);

  const comparable = paces
    .filter((pace) => pace.count >= 2 && pace.spanDays >= 1)
    .sort(byLoss);

  const waiting =
    "Two mornings on the scale will show who is losing weight the fastest, and who is doing the bare minimum.";

  if (comparable.length === 0) {
    return { paces, comparable, lead: null, lag: null, headline: waiting };
  }

  if (comparable.length === 1) {
    const only = comparable[0];
    const name = nameOf(only.personId);
    let headline: string;
    if (only.weekly < LOSS) {
      headline = `${name} is down ${formatAmount(only.total, unit)} ${unit} ${over(only.spanDays)}, about ${formatAmount(only.weekly, unit)} ${unit} a week.`;
    } else if (only.weekly > 0.05) {
      headline = `${name} is up ${formatAmount(only.total, unit)} ${unit} ${over(only.spanDays)}.`;
    } else {
      headline = `${name} is holding steady ${over(only.spanDays)}.`;
    }
    return {
      paces,
      comparable,
      lead:
        only.weekly < LOSS
          ? { personId: only.personId, label: "Losing fastest", pace: only }
          : null,
      lag: null,
      headline,
    };
  }

  const spread =
    comparable[comparable.length - 1].weekly - comparable[0].weekly;
  if (spread < 0.05) {
    const names = joinNames(comparable.map((pace) => nameOf(pace.personId)));
    return {
      paces,
      comparable,
      lead: null,
      lag: null,
      headline: `${names} are on the same pace, ${ratePhrase(comparable[0].weekly, unit)}.`,
    };
  }

  const top = comparable[0];
  const bottom = comparable[comparable.length - 1];
  const losing = top.weekly < LOSS;

  const lead: Callout = {
    personId: top.personId,
    label: losing ? "Losing fastest" : "Closest to losing",
    pace: top,
  };
  const lag: Callout = {
    personId: bottom.personId,
    label: "Bare minimum",
    pace: bottom,
  };

  const headline = losing
    ? `${nameOf(top.personId)} is losing weight the fastest, ${ratePhrase(top.weekly, unit)}. ${nameOf(bottom.personId)} is doing the bare minimum, ${ratePhrase(bottom.weekly, unit)}.`
    : `${nameOf(top.personId)} is the closest to losing weight, ${ratePhrase(top.weekly, unit)}. ${nameOf(bottom.personId)} is doing the bare minimum, ${ratePhrase(bottom.weekly, unit)}.`;

  return { paces, comparable, lead, lag, headline };
}
