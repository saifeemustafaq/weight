"use client";

import { useEffect, useState } from "react";
import { Mornings } from "@/components/mornings";
import { Trend } from "@/components/trend";
import { PaceBoard } from "@/components/pace-board";
import { WeightChart } from "@/components/weight-chart";
import { formatDayKey, zoneLabel } from "@/lib/dates";
import { formatSigned } from "@/lib/format";
import { DEFAULT_MEMBERS, isPlaceholderName } from "@/lib/members";
import type { Board, Member, WeighIn } from "@/lib/types";
import {
  formatWeight,
  fromUnit,
  parseEntered,
  parseTyped,
  rangeMessage,
  type Unit,
} from "@/lib/units";
import { useUnit } from "@/lib/use-unit";

export function Tracker() {
  const [unit, setUnit] = useUnit();
  const [board, setBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [cardError, setCardError] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/board", { cache: "no-store" });
      const data = (await response.json()) as Board & { error?: string };
      if (!response.ok) throw new Error(data.error || "The board did not load.");
      setBoard(data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The board did not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!board) return;
    setNames((current) => {
      const next = { ...current };
      for (const member of board.members) {
        if (next[member.id] === undefined) next[member.id] = member.name;
      }
      return next;
    });
    setWeights((current) => {
      const next = { ...current };
      for (const member of board.members) {
        if (next[member.id] === undefined) {
          const todayEntry = board.entries.find(
            (entry) => entry.personId === member.id && entry.dayKey === board.today,
          );
          next[member.id] = todayEntry ? formatWeight(todayEntry.weight, unit) : "";
        }
      }
      return next;
    });
  }, [board, unit]);

  /** Carry anything half-typed into the new unit so nobody retypes it. */
  function changeUnit(next: Unit) {
    if (next === unit) return;
    setWeights((current) => {
      const converted = { ...current };
      for (const member of board?.members ?? []) {
        const typed = parseTyped(current[member.id] ?? "");
        if (typed === null) continue;
        const saved = board?.entries.find(
          (entry) => entry.personId === member.id && entry.dayKey === board.today,
        );
        const lb =
          saved && formatWeight(saved.weight, unit) === typed.toFixed(1)
            ? saved.weight
            : fromUnit(typed, unit);
        converted[member.id] = formatWeight(lb, next);
      }
      return converted;
    });
    setCardError({});
    setUnit(next);
  }

  async function commitName(member: Member, draft = names[member.id] ?? "") {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name || name === member.name) {
      setNames((current) => ({ ...current, [member.id]: member.name }));
      return true;
    }
    setCardError((current) => ({ ...current, [member.id]: "" }));
    try {
      const response = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, name }),
      });
      const data = (await response.json()) as Member & { error?: string };
      if (!response.ok) throw new Error(data.error || "The name did not save.");
      setBoard((current) =>
        current
          ? {
              ...current,
              members: current.members.map((item) => (item.id === data.id ? data : item)),
            }
          : current,
      );
      setNames((current) => ({ ...current, [member.id]: data.name }));
      return true;
    } catch (error) {
      setNames((current) => ({ ...current, [member.id]: member.name }));
      setCardError((current) => ({
        ...current,
        [member.id]: error instanceof Error ? error.message : "The name did not save.",
      }));
      return false;
    }
  }

  async function commitWeight(member: Member) {
    if (!board) return;
    const named = await commitName(member, names[member.id] ?? "");
    if (!named) return;
    const weight = parseEntered(weights[member.id] ?? "", unit);
    if (weight === null) {
      setCardError((current) => ({
        ...current,
        [member.id]: rangeMessage(unit),
      }));
      return;
    }
    setSaving((current) => ({ ...current, [member.id]: true }));
    setCardError((current) => ({ ...current, [member.id]: "" }));
    try {
      const response = await fetch("/api/weigh-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: member.id, weight }),
      });
      const data = (await response.json()) as WeighIn & { error?: string };
      if (!response.ok) throw new Error(data.error || "The weigh-in did not save.");
      setBoard((current) => {
        if (!current) return current;
        const entries = current.entries.filter(
          (entry) => !(entry.personId === data.personId && entry.dayKey === data.dayKey),
        );
        entries.push(data);
        return { ...current, entries };
      });
      setWeights((current) => ({ ...current, [member.id]: formatWeight(data.weight, unit) }));
    } catch (error) {
      setCardError((current) => ({
        ...current,
        [member.id]: error instanceof Error ? error.message : "The weigh-in did not save.",
      }));
    } finally {
      setSaving((current) => ({ ...current, [member.id]: false }));
    }
  }

  async function clearWeight(member: Member) {
    if (!board) return;
    setSaving((current) => ({ ...current, [member.id]: true }));
    setCardError((current) => ({ ...current, [member.id]: "" }));
    try {
      const response = await fetch("/api/weigh-ins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: member.id }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Today's weigh-in is still there.");
      setBoard((current) =>
        current
          ? {
              ...current,
              entries: current.entries.filter(
                (entry) => !(entry.personId === member.id && entry.dayKey === current.today),
              ),
            }
          : current,
      );
      setWeights((current) => ({ ...current, [member.id]: "" }));
    } catch (error) {
      setCardError((current) => ({
        ...current,
        [member.id]: error instanceof Error ? error.message : "Today's weigh-in is still there.",
      }));
    } finally {
      setSaving((current) => ({ ...current, [member.id]: false }));
    }
  }

  const todayLabel = board
    ? formatDayKey(board.today, { weekday: "long", month: "short", day: "numeric" })
    : "";

  return (
    <div className="relative min-h-full bg-paper text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(196,85,42,0.16),transparent_68%)]" />
      <main className="relative mx-auto flex w-full max-w-lg flex-col gap-8 px-4 py-6 sm:max-w-xl sm:py-10">
        <header>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {board ? `${todayLabel} · ${zoneLabel(board.timezone)}` : "Household scale"}
            </p>
            <UnitSwitch unit={unit} onChange={changeUnit} />
          </div>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">Morning weight</h1>
        </header>

        {loadError && (
          <div className="rounded-3xl border border-line bg-card p-6">
            <p className="font-medium">The scale is not connected yet.</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-full bg-ink px-4 py-2 text-sm text-paper"
            >
              Try again
            </button>
          </div>
        )}

        {loading && !board && (
          <div className="flex flex-col gap-3">
            {DEFAULT_MEMBERS.map((member) => (
              <div
                key={member.id}
                className="h-24 animate-pulse rounded-3xl border border-line bg-card"
              />
            ))}
          </div>
        )}

        {board && (
          <>
            <section className="flex flex-col gap-3">
              {board.members.map((member) => (
                <WeighCard
                  key={member.id}
                  member={member}
                  board={board}
                  unit={unit}
                  name={names[member.id] ?? member.name}
                  weight={weights[member.id] ?? ""}
                  saving={Boolean(saving[member.id])}
                  error={cardError[member.id] ?? ""}
                  onName={(value) =>
                    setNames((current) => ({ ...current, [member.id]: value }))
                  }
                  onNameCommit={(draft) => void commitName(member, draft)}
                  onWeight={(value) => {
                    setWeights((current) => ({ ...current, [member.id]: value }));
                    setCardError((current) =>
                      current[member.id] ? { ...current, [member.id]: "" } : current,
                    );
                  }}
                  onSubmit={() => void commitWeight(member)}
                  onClear={() => void clearWeight(member)}
                />
              ))}
            </section>
            <PaceBoard members={board.members} entries={board.entries} unit={unit} />
            <WeightChart members={board.members} entries={board.entries} unit={unit} />
            <Mornings
              members={board.members}
              entries={board.entries}
              today={board.today}
              unit={unit}
            />
          </>
        )}
      </main>
    </div>
  );
}

function UnitSwitch({ unit, onChange }: { unit: Unit; onChange: (unit: Unit) => void }) {
  return (
    <div
      role="group"
      aria-label="Weight unit"
      className="flex shrink-0 rounded-full border border-line bg-card p-1 text-sm font-medium"
    >
      {(["lb", "kg"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={unit === option}
          onClick={() => onChange(option)}
          className={`h-9 min-w-12 rounded-full px-3 touch-manipulation ${
            unit === option ? "bg-ink text-paper" : "text-muted"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function WeighCard({
  member,
  board,
  unit,
  name,
  weight,
  saving,
  error,
  onName,
  onNameCommit,
  onWeight,
  onSubmit,
  onClear,
}: {
  member: Member;
  board: Board;
  unit: Unit;
  name: string;
  weight: string;
  saving: boolean;
  error: string;
  onName: (value: string) => void;
  onNameCommit: (draft: string) => void;
  onWeight: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  const [editingName, setEditingName] = useState(isPlaceholderName(member.name));
  const mine = board.entries
    .filter((entry) => entry.personId === member.id)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const todayEntry = mine.find((entry) => entry.dayKey === board.today) ?? null;
  const earlier = mine.filter((entry) => entry.dayKey !== board.today);
  const lastMorning = earlier[earlier.length - 1] ?? null;
  const preview = parseEntered(weight, unit);
  const delta = preview !== null && lastMorning ? preview - lastMorning.weight : null;
  const typed = parseTyped(weight);
  // Compared the way it reads on screen, so a number logged in lb still says
  // Logged after switching to kg.
  const unchanged =
    todayEntry !== null &&
    typed !== null &&
    formatWeight(todayEntry.weight, unit) === typed.toFixed(1);
  const since = lastMorning
    ? formatDayKey(lastMorning.dayKey, { month: "short", day: "numeric" })
    : "";
  const status =
    delta !== null && lastMorning
      ? formatSigned(delta, unit) === "0"
        ? `Same as ${since}`
        : `${formatSigned(delta, unit)} ${unit} since ${since}`
      : "";

  return (
    <article className="rounded-3xl border border-line bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: member.color }}
            aria-hidden
          />
          {editingName ? (
            <input
              value={name}
              maxLength={20}
          aria-label={`${member.name} name`}
              onChange={(event) => onName(event.target.value)}
              onBlur={(event) => {
                onNameCommit(event.currentTarget.value);
                if (!isPlaceholderName(event.currentTarget.value.trim())) setEditingName(false);
              }}
              onFocus={(event) => {
                if (isPlaceholderName(event.currentTarget.value)) event.currentTarget.select();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              className="w-full min-w-0 bg-transparent font-serif text-2xl tracking-tight outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="truncate text-left font-serif text-2xl tracking-tight"
            >
              {member.name}
            </button>
          )}
        </div>
        <Trend
          personId={member.id}
          entries={board.entries}
          today={board.today}
          unit={unit}
          color={member.color}
        />
      </div>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div
          className="flex min-w-0 flex-1 items-end gap-2 border-b-2 pb-1"
          style={{ borderColor: member.color }}
        >
          <input
            value={weight}
            onChange={(event) => onWeight(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            aria-label={`${name} weight in ${unit === "kg" ? "kilograms" : "pounds"}`}
            placeholder=""
            className="min-w-0 flex-1 bg-transparent font-serif text-[2rem] leading-none tabular-nums tracking-tight text-ink outline-none placeholder:text-line"
          />
          <span className="text-sm text-muted">{unit}</span>
        </div>
        <button
          type="submit"
          disabled={saving || unchanged}
          className={`h-12 min-w-24 shrink-0 rounded-full border-2 px-4 text-base font-medium touch-manipulation ${
            preview === null ? "bg-transparent" : "border-transparent text-white"
          }`}
          style={
            preview === null
              ? { color: member.color, borderColor: member.color }
              : { background: member.color, borderColor: member.color }
          }
        >
          {saving ? "Saving" : unchanged ? "Logged" : todayEntry ? "Update" : "Log"}
        </button>
      </form>
      {(status || todayEntry) && (
        <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted">
          <p>{status}</p>
          {todayEntry && (
            <button
              type="button"
              onClick={onClear}
              disabled={saving}
              className="-my-2 -mr-2 px-2 py-2 underline decoration-line underline-offset-2 touch-manipulation"
            >
              Undo
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-stamp">{error}</p>}
    </article>
  );
}
