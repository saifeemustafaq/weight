export const UNIT = "lb" as const;

/** Pounds. Wide enough for a child through a large adult. */
export const MIN_WEIGHT = 30;
export const MAX_WEIGHT = 700;

export type SeedMember = {
  id: string;
  name: string;
  color: string;
  order: number;
};

/** Most people the board holds. Enough for a family or a small house, few enough to keep the page short. */
export const MAX_MEMBERS = 12;

/**
 * Colours handed to people in order. The first four are the original household;
 * every colour stays dark enough for white text on a solid Log button. Past the
 * last one the list starts over.
 */
export const PALETTE = [
  "#c4552a",
  "#2c6e5a",
  "#24598a",
  "#8d5a12",
  "#7b4f9d",
  "#b8456b",
  "#5a6672",
  "#6b7a2a",
];

export const DEFAULT_MEMBERS: SeedMember[] = [
  { id: "p1", name: "Person 1", color: "#c4552a", order: 0 },
  { id: "p2", name: "Person 2", color: "#2c6e5a", order: 1 },
  { id: "p3", name: "Person 3", color: "#24598a", order: 2 },
  { id: "p4", name: "Person 4", color: "#8d5a12", order: 3 },
];

export function parseWeight(value: unknown): number | null {
  let numeric: number;
  if (typeof value === "number") {
    numeric = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim().replace(",", ".");
    if (!/^\d{2,3}(\.\d{1,2})?$/.test(trimmed)) return null;
    numeric = Number(trimmed);
  } else {
    return null;
  }

  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric * 10) / 10;
  if (rounded < MIN_WEIGHT || rounded > MAX_WEIGHT) return null;
  return rounded;
}

export function parseName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 20) return null;
  if (!/^[\p{L}\p{M}0-9 .'-]+$/u.test(name)) return null;
  return name;
}

export function isPlaceholderName(name: string): boolean {
  return /^Person \d+$/.test(name);
}
