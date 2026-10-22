"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, type Query, type QueryConstraint } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { toMap } from "@/lib/costing";
import type { BusinessSettings, MenuItem, StockItem, Supplier } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/billing";

/**
 * Live Firestore query. Pass `null` as path to skip. The query re-subscribes
 * when `path` or `key` changes — put anything the constraints depend on in `key`.
 */
export function useLive<T>(path: string | null, constraints: QueryConstraint[] = [], key = "") {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    const q: Query = query(collection(db, path), ...constraints);
    return onSnapshot(
      q,
      (s) => {
        setData(s.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);
  return { data, loading, error };
}

export function useLiveDoc<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!path) return;
    return onSnapshot(doc(db, path), (s) => {
      setData(s.exists() ? ({ id: s.id, ...s.data() } as T) : null);
      setLoading(false);
    });
  }, [path]);
  return { data, loading };
}

export function useItems() {
  const r = useLive<StockItem>("items");
  return { ...r, map: toMap(r.data) };
}
export const useMenu = () => useLive<MenuItem>("menuItems");
export const useSuppliers = () => useLive<Supplier>("suppliers");
export function useSettings(): BusinessSettings {
  const { data } = useLiveDoc<BusinessSettings>("settings/business");
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
}
