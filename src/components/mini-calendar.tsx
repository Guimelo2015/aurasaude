"use client";

/**
 * Calendário mensal para escolher qualquer data. Mostra um ponto nos dias com
 * agendamentos (`counts`, chave yyyy-MM-dd) e permite pular de mês e ano.
 */
import { useEffect, useState } from "react";
import { addDays, addMonths, format, isSameDay, isSameMonth, isToday, setMonth, setYear, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2026, i, 1), "MMMM", { locale: ptBR }));

export function MiniCalendar({
  value,
  onChange,
  counts,
}: {
  value: Date;
  onChange: (d: Date) => void;
  counts?: Record<string, number>;
}) {
  const [month, setMonthView] = useState(() => startOfMonth(value));
  useEffect(() => setMonthView(startOfMonth(value)), [value]);

  const first = startOfWeek(month, { weekStartsOn: 1 });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const year = month.getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => year - 5 + i);
  const sel = "rounded-md border border-border bg-surface px-1.5 py-1 text-xs capitalize outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer";
  const nav = "grid h-7 w-7 place-items-center rounded-full hover:bg-surface-2 cursor-pointer";

  return (
    <div className="w-72 select-none">
      <div className="mb-2 flex items-center gap-1">
        <button type="button" aria-label="Mês anterior" onClick={() => setMonthView((m) => addMonths(m, -1))} className={nav}>
          <ChevronLeft size={15} />
        </button>
        <div className="flex flex-1 justify-center gap-1">
          <select aria-label="Mês" value={month.getMonth()} onChange={(e) => setMonthView((m) => setMonth(m, Number(e.target.value)))} className={sel}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select aria-label="Ano" value={year} onChange={(e) => setMonthView((m) => setYear(m, Number(e.target.value)))} className={sel}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" aria-label="Próximo mês" onClick={() => setMonthView((m) => addMonths(m, 1))} className={nav}>
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
        {WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}
      </div>
      <div role="grid" aria-label={format(month, "MMMM 'de' yyyy", { locale: ptBR })} className="grid grid-cols-7 gap-0.5">
        {cells.map((d) => {
          const n = counts?.[format(d, "yyyy-MM-dd")] ?? 0;
          const selected = isSameDay(d, value);
          const out = !isSameMonth(d, month);
          return (
            <button
              key={d.toISOString()}
              type="button"
              aria-pressed={selected}
              aria-label={`${format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}${n ? `, ${n} agendamento(s)` : ""}`}
              onClick={() => onChange(startOfDay(d))}
              className={cn(
                "relative flex h-9 flex-col items-center justify-center rounded-lg text-xs tabular-nums transition cursor-pointer",
                selected ? "bg-primary font-semibold text-white" : isToday(d) ? "bg-primary-soft font-semibold text-primary-strong" : "hover:bg-surface-2",
                out && !selected && "text-muted/60",
              )}
            >
              {format(d, "d")}
              {n > 0 && <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", selected ? "bg-white" : "bg-primary")} />}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
        <button type="button" onClick={() => onChange(startOfDay(new Date()))} className="rounded-md px-2 py-1 font-medium text-primary-strong hover:bg-primary-soft cursor-pointer">
          Hoje
        </button>
        <label className="flex items-center gap-1.5 text-muted">
          Ir para
          <input
            type="date"
            aria-label="Digitar data"
            value={format(value, "yyyy-MM-dd")}
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, m, d] = e.target.value.split("-").map(Number);
              if (y > 1900) onChange(new Date(y, m - 1, d));
            }}
            className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
      </div>
    </div>
  );
}
