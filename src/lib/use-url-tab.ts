"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Seção da tela guardada na URL (?aba=). O menu lateral e as abas do topo
 * navegam por ela, então a tela não precisa de menu próprio.
 */
export function useUrlTab<T extends string>(allowed: readonly T[], fallback: T): [T, (t: T) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("aba");
  const value = (allowed as readonly string[]).includes(raw ?? "") ? (raw as T) : fallback;
  const qs = params.toString();
  const set = useCallback(
    (t: T) => {
      const p = new URLSearchParams(qs);
      p.set("aba", t);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [qs, pathname, router],
  );
  return [value, set];
}
