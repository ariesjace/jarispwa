"use client";

/**
 * components/layout/FABContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Context-driven FAB registration system.
 *
 * Pages that want a custom mobile FAB call:
 *
 *   usePageFAB([
 *     { label: "Add New", Icon: Plus, color: TOKEN.primary, onClick: handleAdd },
 *   ]);
 *
 * CMSLayout reads this context and renders the FAB only when actions are
 * registered — pages that don't call usePageFAB get no FAB at all.
 *
 * Pass `enabled: false` to temporarily suppress the FAB (e.g. during bulk
 * selection mode in a table).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import type { FABAction } from "./FAB";

// ─── Context ──────────────────────────────────────────────────────────────────

interface FABContextValue {
  /** Currently registered actions (empty = no FAB shown) */
  actions: FABAction[];
  setPageFAB: (actions: FABAction[]) => void;
  clearPageFAB: () => void;
}

const FABContext = createContext<FABContextValue>({
  actions: [],
  setPageFAB: () => {},
  clearPageFAB: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FABProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<FABAction[]>([]);

  const setPageFAB = useCallback((newActions: FABAction[]) => {
    setActions(newActions);
  }, []);

  const clearPageFAB = useCallback(() => {
    setActions([]);
  }, []);

  return (
    <FABContext.Provider value={{ actions, setPageFAB, clearPageFAB }}>
      {children}
    </FABContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Low-level hook — prefer usePageFAB for page-level usage */
export function useFABContext() {
  return useContext(FABContext);
}

/**
 * usePageFAB
 * ─────────────────────────────────────────────────────────────────────────────
 * Registers custom FAB actions for the current page.
 * Actions are cleared automatically when the component unmounts (tab change).
 *
 * @param actions  Stable array of FABAction objects (use useMemo or define
 *                 outside the component to avoid re-registering every render).
 * @param enabled  Set false to hide the FAB temporarily (e.g. bulk mode).
 *                 Defaults to true.
 *
 * @example
 *   const fabActions = useMemo(() => [
 *     { label: "Add New Family", Icon: FolderPlus, color: TOKEN.primary, onClick: handleAdd },
 *   ], [handleAdd]);
 *
 *   usePageFAB(fabActions);          // always visible
 *   usePageFAB(fabActions, !isBulk); // hidden during bulk selection
 */
export function usePageFAB(actions: FABAction[], enabled = true) {
  const { setPageFAB, clearPageFAB } = useFABContext();

  // Keep a ref so effect dep only re-runs when `enabled` changes,
  // not when the caller forgets to memoize `actions`.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (enabled) {
      setPageFAB(actionsRef.current);
    } else {
      clearPageFAB();
    }
    return () => {
      clearPageFAB();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, setPageFAB, clearPageFAB]);
}
