import { Bot, CalendarClock, CreditCard, Stethoscope, UserCheck } from "lucide-react";
import { Badge } from "../ui";
import { URGENCY } from "@/lib/labels";
import type { HandoffCard as Card } from "@/lib/types";
import { cn, fmtTime } from "@/lib/utils";

export function HandoffCard({ card, aiName, compact }: { card: Card; aiName: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-surface", card.urgency === "alta" ? "border-danger/40" : "border-violet/30")}>
      <div className={cn("flex items-center gap-2 rounded-t-xl px-3 py-2", card.urgency === "alta" ? "bg-danger-soft" : "bg-violet-soft")}>
        <Bot size={14} className={card.urgency === "alta" ? "text-danger" : "text-violet"} />
        <span className="text-xs font-semibold">Resumo da triagem · {aiName}</span>
        <span className="ml-auto text-[10px] text-muted">{fmtTime(card.createdAt)}</span>
      </div>
      <div className="space-y-2.5 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold">{card.interest}</span>
          <Badge tone={URGENCY[card.urgency].tone}>{URGENCY[card.urgency].label}</Badge>
        </div>
        {!compact && <p className="text-xs leading-relaxed text-muted">{card.complaint}</p>}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Info icon={CreditCard} label="Convênio" value={card.insurance} />
          <Info icon={CalendarClock} label="Período" value={card.preferredPeriod} />
          <Info icon={UserCheck} label="Paciente" value={card.isReturningPatient ? "Já é paciente" : "Primeira vez"} />
          <Info icon={Stethoscope} label="Interesse" value={card.interest} />
        </div>
        {!compact && card.summary && (
          <p className="rounded-lg bg-surface-2 px-2.5 py-2 text-xs leading-relaxed">
            <span className="font-medium">Observação da IA: </span>
            {card.summary}
          </p>
        )}
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon size={13} className="mt-0.5 shrink-0 text-muted" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}
