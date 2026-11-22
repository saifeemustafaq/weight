import { useCallback, useSyncExternalStore } from "react";
import type { Unit } from "@/lib/units";

const KEY = "weight-unit";
const listeners = new Set<() => void>();
// Private browsing can refuse storage. The choice then lasts until reload.
let remembered: Unit = "lb";

function read(): Unit {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "kg" || stored === "lb") return stored;
  } catch {
    // Fall through to the in-memory choice.
  }
  return remembered;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The unit this phone reads in. It is a display choice, so it lives in the browser. */
export function useUnit(): [Unit, (unit: Unit) => void] {
  const unit = useSyncExternalStore(subscribe, read, () => "lb" as Unit);
  const setUnit = useCallback((next: Unit) => {
    remembered = next;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Nothing to do: `remembered` already holds it.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [unit, setUnit];
}
