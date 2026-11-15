"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type QueryPatch = Record<string, string | number | null | undefined>;

/** Lê e grava parâmetros da URL sem recarregar a página (a aba do topo acompanha). */
export function useQuery() {
  const params = useSearchParams();
  const pathname = usePathname();
  const set = useCallback(
    (patch: QueryPatch) => {
      const p = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") p.delete(k);
        else p.set(k, String(v));
      }
      const qs = p.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname],
  );
  return { params, get: (k: string) => params.get(k) ?? "", set };
}
