"use client";

import Link from "next/link";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { UnitSwitch } from "@/components/unit-switch";
import { formatDayKey } from "@/lib/dates";
import { MAX_MEMBERS } from "@/lib/members";
import type { Board, Member, WeighIn } from "@/lib/types";
import { formatWeight, parseEntered, rangeMessage, type Unit } from "@/lib/units";
import { useUnit } from "@/lib/use-unit";

type SetBoard = Dispatch<SetStateAction<Board | null>>;

async function send<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
  fallback: string,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** Names, people and every weigh-in live here. No password: anyone who knows this address can edit. */
export function Admin() {
  const [unit, setUnit] = useUnit();
  const [board, setBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addNote, setAddNote] = useState<{ text: string; ok: boolean; color?: string; id?: string } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");

  async function load() {
    setLoadError(null);
    try {
      const response = await fetch("/api/board", { cache: "no-store" });
      const data = (await response.json()) as Board & { error?: string };
      if (!response.ok) throw new Error(data.error || "The board did not load.");
      setBoard(data);
    } catch (error) {
      setLoadError(messageOf(error, "The board did not load."));
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const total = board?.entries.length ?? 0;

  async function addPerson() {
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) {
      setAddNote({ text: "Type a name first.", ok: false });
      return;
    }
    setAdding(true);
    setAddNote(null);
    try {
      const data = await send<Member>("/api/members", "POST", { name }, "The person was not added.");
      setBoard((current) =>
        current
          ? { ...current, members: [...current.members, data].sort((a, b) => a.order - b.order) }
          : current,
      );
      setNewName("");
      setAddNote({ text: `${data.name} is on the board.`, ok: true, color: data.color, id: data.id });
    } catch (error) {
      setAddNote({ text: messageOf(error, "The person was not added."), ok: false });
    } finally {
      setAdding(false);
    }
  }

  async function removeEverything() {
    setBulkBusy(true);
    setBulkError("");
    try {
      await send("/api/admin/weigh-ins", "DELETE", { all: true }, "The weigh-ins are still there.");
      setBoard((current) => (current ? { ...current, entries: [] } : current));
      setBulkOpen(false);
    } catch (error) {
      setBulkError(messageOf(error, "The weigh-ins are still there."));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="relative min-h-full bg-paper text-ink">
      <main className="relative mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6 sm:max-w-xl sm:py-10">
        <header>
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="-ml-2 flex h-11 items-center px-2 text-sm text-muted underline decoration-line underline-offset-4"
            >
              ← Back to today
            </Link>
            <UnitSwitch unit={unit} onChange={setUnit} />
          </div>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">Manage the board</h1>
          {board && (
            <p className="mt-1 text-sm text-muted">
              Names, people and every weigh-in.
            </p>
          )}
        </header>

        {loadError && (
          <div className="rounded-3xl border border-line bg-card p-6">
            <p className="font-medium">The board did not load.</p>
            <p className="mt-2 text-sm leading-6 text-muted">{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 h-11 rounded-full bg-ink px-5 text-sm text-paper touch-manipulation"
            >
              Try again
            </button>
          </div>
        )}

        {!board && !loadError && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-40 animate-pulse rounded-3xl border border-line bg-card" />
            ))}
          </div>
        )}

        {board && (
          <>
            <div className="flex flex-col gap-3">
              {board.members.map((member) => (
                <PersonCard
                  key={`${member.id}-${unit}`}
                  member={member}
                  entries={board.entries
                    .filter((entry) => entry.personId === member.id)
                    .sort((a, b) => b.dayKey.localeCompare(a.dayKey))}
                  today={board.today}
                  unit={unit}
                  canRemove={board.members.length > 1}
                  setBoard={setBoard}
                />
              ))}
            </div>

            <form
              className="rounded-3xl border border-line bg-card px-4 py-3.5"
              onSubmit={(event) => {
                event.preventDefault();
                void addPerson();
              }}
            >
              <label htmlFor="new-person" className="font-serif text-xl tracking-tight">
                Add a person
              </label>
              <div className="mt-2 flex items-end gap-2">
                <input
                  id="new-person"
                  value={newName}
                  maxLength={20}
                  autoComplete="off"
                  enterKeyHint="done"
                  onChange={(event) => {
                    setNewName(event.target.value);
                    if (addNote) setAddNote(null);
                  }}
                  className="min-w-0 flex-1 border-b-2 border-[#b7aa9c] bg-transparent pb-1 font-serif text-2xl tracking-tight text-ink outline-none focus:border-ink"
                />
                <button
                  type="submit"
                  disabled={adding}
                  className={`h-12 min-w-24 shrink-0 rounded-full border-2 px-4 text-base font-medium touch-manipulation ${
                    newName.trim()
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-transparent text-muted"
                  }`}
                >
                  {adding ? "Adding" : "Add"}
                </button>
              </div>
              {addNote && (!addNote.id || board.members.some((m) => m.id === addNote.id)) && (
                <p
                  className={`mt-2 flex items-center gap-2 text-sm ${addNote.ok ? "text-ink" : "text-stamp"}`}
                  aria-live="polite"
                >
                  {addNote.ok && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: addNote.color }}
                      aria-hidden
                    />
                  )}
                  {addNote.text}
                </p>
              )}
              <p className="mt-2 text-xs text-muted">
                They appear on the main page as soon as they are added, up to {MAX_MEMBERS} people.
              </p>
            </form>

            {total > 0 &&
              (bulkOpen ? (
                <div className="rounded-3xl border border-stamp/40 bg-card p-4">
                  <p className="text-base">Delete all {total} weigh-ins for everyone?</p>
                  <p className="mt-1 text-sm text-muted">This cannot be undone. Names stay.</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkOpen(false)}
                      disabled={bulkBusy}
                      className="h-11 flex-1 rounded-full border border-line px-4 text-sm touch-manipulation"
                    >
                      Keep them
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeEverything()}
                      disabled={bulkBusy}
                      className="h-11 flex-1 rounded-full bg-stamp px-4 text-sm font-medium text-white touch-manipulation"
                    >
                      {bulkBusy ? "Deleting" : "Delete all"}
                    </button>
                  </div>
                  {bulkError && <p className="mt-2 text-sm text-stamp">{bulkError}</p>}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setBulkOpen(true)}
                  className="h-11 w-full rounded-full border border-line px-4 text-sm text-stamp touch-manipulation"
                >
                  Delete every weigh-in for everyone ({total})
                </button>
              ))}
          </>
        )}
      </main>
    </div>
  );
}

const VISIBLE_ROWS = 7;

function PersonCard({
  member,
  entries,
  today,
  unit,
  canRemove,
  setBoard,
}: {
  member: Member;
  entries: WeighIn[];
  today: string;
  unit: Unit;
  canRemove: boolean;
  setBoard: SetBoard;
}) {
  const [nameDraft, setNameDraft] = useState<string | undefined>(undefined);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const [addDay, setAddDay] = useState(today);
  const [addWeight, setAddWeight] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"remove" | "clear" | null>(null);
  const [panelBusy, setPanelBusy] = useState(false);

  const name = nameDraft ?? member.name;
  const nameChanged = nameDraft !== undefined && nameDraft.trim().replace(/\s+/g, " ") !== member.name;
  const shown = showAll ? entries : entries.slice(0, VISIBLE_ROWS);
  const unitWord = unit === "kg" ? "kilograms" : "pounds";

  function setRowError(id: string, message: string) {
    setRowErrors((current) => ({ ...current, [id]: message }));
  }

  async function saveName() {
    const next = (nameDraft ?? "").trim().replace(/\s+/g, " ");
    if (!next) {
      setError("Type a name first.");
      return;
    }
    setNameBusy(true);
    setError("");
    try {
      const data = await send<Member>(
        "/api/members",
        "PATCH",
        { id: member.id, name: next },
        "The name did not save.",
      );
      setBoard((current) =>
        current
          ? { ...current, members: current.members.map((item) => (item.id === data.id ? data : item)) }
          : current,
      );
      setNameDraft(undefined);
      setNameSaved(true);
      window.setTimeout(() => setNameSaved(false), 2000);
    } catch (e) {
      setError(messageOf(e, "The name did not save."));
    } finally {
      setNameBusy(false);
    }
  }

  async function saveRow(entry: WeighIn) {
    const weight = parseEntered(drafts[entry.id] ?? "", unit);
    if (weight === null) {
      setRowError(entry.id, rangeMessage(unit));
      return;
    }
    setBusy(entry.id);
    setRowError(entry.id, "");
    try {
      const data = await send<WeighIn>(
        "/api/admin/weigh-ins",
        "PATCH",
        { id: entry.id, weight },
        "The change did not save.",
      );
      setBoard((current) =>
        current
          ? { ...current, entries: current.entries.map((item) => (item.id === data.id ? data : item)) }
          : current,
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
    } catch (e) {
      setRowError(entry.id, messageOf(e, "The change did not save."));
    } finally {
      setBusy(null);
    }
  }

  async function deleteRow(entry: WeighIn) {
    setBusy(entry.id);
    setRowError(entry.id, "");
    try {
      await send("/api/admin/weigh-ins", "DELETE", { id: entry.id }, "The weigh-in is still there.");
      setBoard((current) =>
        current
          ? { ...current, entries: current.entries.filter((item) => item.id !== entry.id) }
          : current,
      );
      setConfirming(null);
    } catch (e) {
      setRowError(entry.id, messageOf(e, "The weigh-in is still there."));
    } finally {
      setBusy(null);
    }
  }

  async function addEntry() {
    const weight = parseEntered(addWeight, unit);
    if (weight === null) {
      setError(rangeMessage(unit));
      return;
    }
    if (!addDay) {
      setError("Choose a date.");
      return;
    }
    setAddBusy(true);
    setError("");
    try {
      const data = await send<WeighIn>(
        "/api/admin/weigh-ins",
        "POST",
        { personId: member.id, dayKey: addDay, weight },
        "The weigh-in did not save.",
      );
      setBoard((current) => {
        if (!current) return current;
        const rest = current.entries.filter(
          (item) => !(item.personId === data.personId && item.dayKey === data.dayKey),
        );
        return { ...current, entries: [...rest, data] };
      });
      setAddWeight("");
      setAddDay(today);
    } catch (e) {
      setError(messageOf(e, "The weigh-in did not save."));
    } finally {
      setAddBusy(false);
    }
  }

  async function clearAll() {
    setPanelBusy(true);
    setError("");
    try {
      await send(
        "/api/admin/weigh-ins",
        "DELETE",
        { personId: member.id },
        "The weigh-ins are still there.",
      );
      setBoard((current) =>
        current
          ? { ...current, entries: current.entries.filter((item) => item.personId !== member.id) }
          : current,
      );
      setPanel(null);
    } catch (e) {
      setError(messageOf(e, "The weigh-ins are still there."));
    } finally {
      setPanelBusy(false);
    }
  }

  async function removePerson() {
    setPanelBusy(true);
    setError("");
    try {
      await send("/api/members", "DELETE", { id: member.id }, "The person is still on the board.");
      setBoard((current) =>
        current
          ? {
              ...current,
              members: current.members.filter((item) => item.id !== member.id),
              entries: current.entries.filter((item) => item.personId !== member.id),
            }
          : current,
      );
    } catch (e) {
      setError(messageOf(e, "The person is still on the board."));
      setPanelBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-card px-4 py-3.5">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (nameChanged) void saveName();
        }}
      >
        <span
          className="mb-3 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: member.color }}
          aria-hidden
        />
        <input
          value={name}
          maxLength={20}
          autoComplete="off"
          enterKeyHint="done"
          aria-label={`Name for ${member.name}`}
          onChange={(event) => {
            setNameDraft(event.target.value);
            if (error) setError("");
          }}
          className="min-w-0 flex-1 border-b-2 bg-transparent pb-1 font-serif text-2xl tracking-tight text-ink outline-none"
          style={{ borderColor: member.color }}
        />
        {nameChanged ? (
          <button
            type="submit"
            disabled={nameBusy}
            className="h-11 shrink-0 rounded-full px-4 text-sm font-medium text-white touch-manipulation"
            style={{ background: member.color }}
          >
            {nameBusy ? "Saving" : "Save name"}
          </button>
        ) : (
          <span className="mb-2 shrink-0 text-xs text-muted">{nameSaved ? "Saved" : ""}</span>
        )}
      </form>

      <p className="mt-2 text-xs text-muted">
        {entries.length === 0
          ? "No weigh-ins yet."
          : `${entries.length} weigh-in${entries.length === 1 ? "" : "s"}. Change a number, then Save.`}
      </p>

      {shown.length > 0 && (
        <ul className="mt-2 flex flex-col">
          {shown.map((entry) => {
            const label =
              entry.dayKey === today
                ? "Today"
                : formatDayKey(entry.dayKey, { weekday: "short", month: "short", day: "numeric" });
            const display = formatWeight(entry.weight, unit);
            const value = drafts[entry.id] ?? display;
            const changed = drafts[entry.id] !== undefined && drafts[entry.id] !== display;
            const rowError = rowErrors[entry.id] ?? "";
            return (
              <li key={entry.id} className="border-t border-line py-2.5">
                {confirming === entry.id ? (
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 text-sm">
                      Delete {display} {unit} from {label}?
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      disabled={busy === entry.id}
                      className="h-11 shrink-0 rounded-full border border-line px-4 text-sm touch-manipulation"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRow(entry)}
                      disabled={busy === entry.id}
                      className="h-11 shrink-0 rounded-full bg-stamp px-4 text-sm font-medium text-white touch-manipulation"
                    >
                      {busy === entry.id ? "Deleting" : "Delete"}
                    </button>
                  </div>
                ) : (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (changed) void saveRow(entry);
                    }}
                  >
                    <span className="w-[5.5rem] shrink-0 text-sm text-muted">{label}</span>
                    <div
                      className="flex min-w-0 flex-1 items-end gap-1.5 border-b-2 pb-0.5"
                      style={{ borderColor: member.color }}
                    >
                      <input
                        value={value}
                        onChange={(event) => {
                          setDrafts((current) => ({ ...current, [entry.id]: event.target.value }));
                          if (rowError) setRowError(entry.id, "");
                        }}
                        inputMode="decimal"
                        autoComplete="off"
                        enterKeyHint="done"
                        aria-label={`${member.name} weight on ${label} in ${unitWord}`}
                        className="min-w-0 flex-1 bg-transparent font-serif text-2xl leading-none tabular-nums tracking-tight text-ink outline-none"
                      />
                      <span className="text-xs text-muted">{unit}</span>
                    </div>
                    {changed ? (
                      <button
                        type="submit"
                        disabled={busy === entry.id}
                        className="h-11 w-[4.75rem] shrink-0 rounded-full text-sm font-medium text-white touch-manipulation"
                        style={{ background: member.color }}
                      >
                        {busy === entry.id ? "Saving" : "Save"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming(entry.id)}
                        className="h-11 w-[4.75rem] shrink-0 rounded-full border border-line text-sm text-muted touch-manipulation"
                      >
                        Delete
                      </button>
                    )}
                  </form>
                )}
                {rowError && <p className="mt-1.5 text-sm text-stamp">{rowError}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {entries.length > VISIBLE_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="h-11 w-full border-t border-line text-sm text-muted touch-manipulation"
        >
          {showAll ? "Show fewer" : `Show all ${entries.length}`}
        </button>
      )}

      <form
        className="mt-1 border-t border-line pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          void addEntry();
        }}
      >
        <p className="text-sm text-muted">Add a weigh-in</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            value={addDay}
            max={today}
            required
            aria-label={`Date for ${member.name}`}
            onChange={(event) => {
              setAddDay(event.target.value);
              if (error) setError("");
            }}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-2 text-[15px] text-ink"
          />
          <input
            value={addWeight}
            onChange={(event) => {
              setAddWeight(event.target.value);
              if (error) setError("");
            }}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder={unit}
            aria-label={`New weight for ${member.name} in ${unitWord}`}
            className="h-11 w-[4.5rem] shrink-0 rounded-xl border border-line bg-paper px-2.5 text-base tabular-nums text-ink placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={addBusy}
            className="h-11 w-14 shrink-0 rounded-full text-sm font-medium text-white touch-manipulation"
            style={{ background: member.color }}
          >
            {addBusy ? "Adding" : "Add"}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-2 text-sm text-stamp" aria-live="polite">
          {error}
        </p>
      )}

      {panel ? (
        <div className="mt-3 rounded-2xl border border-stamp/40 p-3">
          <p className="text-sm">
            {panel === "remove"
              ? `Remove ${member.name}${entries.length ? ` and ${entries.length} weigh-in${entries.length === 1 ? "" : "s"}` : ""}?`
              : `Delete all ${entries.length} of ${member.name}'s weigh-ins?`}
          </p>
          <p className="mt-1 text-xs text-muted">This cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPanel(null)}
              disabled={panelBusy}
              className="h-11 flex-1 rounded-full border border-line px-4 text-sm touch-manipulation"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() => void (panel === "remove" ? removePerson() : clearAll())}
              disabled={panelBusy}
              className="h-11 flex-1 rounded-full bg-stamp px-4 text-sm font-medium text-white touch-manipulation"
            >
              {panelBusy ? "Working" : panel === "remove" ? "Remove" : "Delete all"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
          {entries.length > 0 ? (
            <button
              type="button"
              onClick={() => setPanel("clear")}
              className="h-11 text-sm text-stamp underline decoration-line underline-offset-4 touch-manipulation"
            >
              Delete all weigh-ins
            </button>
          ) : (
            <span />
          )}
          {canRemove && (
            <button
              type="button"
              onClick={() => setPanel("remove")}
              className="h-11 text-sm text-stamp underline decoration-line underline-offset-4 touch-manipulation"
            >
              Remove {member.name}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
