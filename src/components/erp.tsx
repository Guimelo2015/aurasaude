"use client";

/**
 * Kit de telas estilo ERP: barra de ações, abas Registros/Cadastro, sub-abas de seção,
 * grade densa e cabeçalho da ficha. Só usa tokens do tema.
 */
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Barra de ações ─────────────────────────────────────────────────────────
export function Toolbar({ children, aside, label = "Ações" }: { children: ReactNode; aside?: ReactNode; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="toolbar" aria-label={label} className="flex max-w-full items-stretch gap-0.5 overflow-x-auto rounded-2xl border border-border bg-surface p-1 [scrollbar-width:thin]">
        {children}
      </div>
      {aside}
    </div>
  );
}

export function ToolSep() {
  return <span aria-hidden className="mx-1 my-1.5 w-px shrink-0 bg-border" />;
}

export function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  reason,
  form,
  type = "button",
  tone,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Por que está desativado (aparece no tooltip). */
  reason?: string;
  form?: string;
  type?: "button" | "submit";
  tone?: "danger" | "primary";
}) {
  return (
    <button
      type={type}
      form={form}
      aria-disabled={disabled || undefined}
      title={disabled ? reason ?? label : label}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onClick?.();
      }}
      className={cn(
        "flex min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-primary",
        disabled
          ? "cursor-not-allowed opacity-35"
          : cn("cursor-pointer hover:bg-surface-2", tone === "danger" ? "text-danger" : tone === "primary" ? "text-primary-strong" : "text-fg"),
      )}
    >
      <Icon size={18} strokeWidth={1.8} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

// ─── Abas Registros / Cadastro ──────────────────────────────────────────────
export function RecordTabs({
  value,
  registrosHref,
  cadastroHref,
  cadastroReason = "Selecione um registro",
}: {
  value: "registros" | "cadastro";
  registrosHref: string;
  cadastroHref?: string;
  cadastroReason?: string;
}) {
  const cls = (a: boolean) =>
    cn(
      "-mb-px rounded-t-lg border border-b-0 px-4 py-1.5 text-xs transition",
      a ? "border-border bg-surface font-bold text-fg" : "border-transparent text-muted hover:text-fg",
    );
  return (
    <div role="tablist" aria-label="Modo" className="flex gap-0.5 border-b border-border">
      <Link role="tab" aria-selected={value === "registros"} href={registrosHref} className={cls(value === "registros")}>
        Registros
      </Link>
      {cadastroHref ? (
        <Link role="tab" aria-selected={value === "cadastro"} href={cadastroHref} className={cls(value === "cadastro")}>
          Cadastro
        </Link>
      ) : (
        <span role="tab" aria-selected={false} aria-disabled title={cadastroReason} className={cn(cls(false), "cursor-not-allowed opacity-35")}>
          Cadastro
        </span>
      )}
    </div>
  );
}

// ─── Sub-abas de seção (?secao=) ────────────────────────────────────────────
export function SectionTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode; count?: number }[];
}) {
  return (
    <div role="tablist" aria-label="Seções" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none]">
      {items.map((it) => {
        const a = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={a}
            onClick={() => onChange(it.value)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] transition cursor-pointer",
              a ? "border-primary font-semibold text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-[10px]", a ? "bg-primary-soft text-primary-strong" : "bg-surface-2")}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Grade densa estilo planilha ────────────────────────────────────────────
export type Column<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => ReactNode;
};

export function DataGrid<T extends { id: string }>({
  columns,
  rows,
  selectedId,
  onSelect,
  onOpen,
  sort,
  dir,
  onSort,
  empty,
  label = "Registros",
}: {
  columns: Column<T>[];
  rows: T[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  sort?: string;
  dir?: "asc" | "desc";
  onSort?: (key: string) => void;
  empty?: ReactNode;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedId) return;
    ref.current?.querySelector(`[data-row="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!rows.length) return;
    const i = rows.findIndex((r) => r.id === selectedId);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onSelect(rows[Math.min(rows.length - 1, i + 1)].id);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onSelect(rows[Math.max(0, i - 1)].id);
    } else if (e.key === "Enter" && selectedId) {
      e.preventDefault();
      onOpen(selectedId);
    }
  };

  if (!rows.length) return <>{empty}</>;

  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={onKey}
      aria-label={`${label}: setas mudam a linha, Enter abre o cadastro`}
      className="overflow-auto outline-none lg:max-h-[calc(100vh-22rem)] lg:min-h-48 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
    >
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr className="text-left">
            {columns.map((c) => {
              const active = sort === c.key;
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : undefined}
                  className={cn("whitespace-nowrap border-b border-border px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted", c.className)}
                >
                  {c.sortable && onSort ? (
                    <button onClick={() => onSort(c.key)} className={cn("inline-flex items-center gap-1 uppercase tracking-wider hover:text-fg cursor-pointer", active && "text-fg")}>
                      {c.label}
                      {active && (dir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sel = r.id === selectedId;
            return (
              <tr
                key={r.id}
                data-row={r.id}
                aria-selected={sel}
                onClick={() => onSelect(r.id)}
                onDoubleClick={() => onOpen(r.id)}
                className={cn(
                  "cursor-default border-b border-border/50 transition-colors even:bg-surface-2/40",
                  sel ? "!bg-primary-soft shadow-[inset_3px_0_0_var(--color-primary)]" : "hover:bg-surface-2",
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-1.5 align-middle", c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GridFooter({
  total,
  page,
  pages,
  onPage,
  noun = "registro(s)",
}: {
  total: number;
  page: number;
  pages: number;
  onPage: (p: number) => void;
  noun?: string;
}) {
  const btn = "grid h-7 w-7 place-items-center rounded-full border border-border hover:bg-surface-2 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed";
  return (
    <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted">
      <span>
        {total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <button disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Página anterior" className={btn}>
          <ChevronLeft size={13} />
        </button>
        <span className="tabular-nums">
          Página {page + 1} de {pages}
        </span>
        <button disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="Próxima página" className={btn}>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Cabeçalho da ficha ─────────────────────────────────────────────────────
export function CadastroHeader({
  kicker,
  title,
  meta,
  position,
  leading,
  children,
}: {
  kicker: string;
  title: ReactNode;
  meta?: ReactNode;
  position?: { index: number; total: number };
  leading?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start gap-4">
        {leading}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{kicker}</p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight">{title}</h1>
          {meta && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</div>}
        </div>
        {position && position.index >= 0 && (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] tabular-nums text-muted">
            {position.index + 1} de {position.total}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
