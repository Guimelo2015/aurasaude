"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Modal, Select, toast } from "../ui";
import { useApp } from "@/lib/store";
import type { Budget, BudgetItem, ID } from "@/lib/types";
import { money } from "@/lib/utils";

export function BudgetFormModal({ open, onClose, leadId, patientId, procedureId, onSaved }: { open: boolean; onClose: () => void; leadId?: ID; patientId?: ID; procedureId?: ID; onSaved?: (b: Budget) => void }) {
  const procedures = useApp((s) => s.procedures);
  const addBudget = useApp((s) => s.addBudget);
  const [items, setItems] = useState<BudgetItem[]>([]);

  useEffect(() => {
    if (!open) return;
    const p = procedures.find((x) => x.id === procedureId) ?? procedures[0];
    setItems(p ? [{ procedureId: p.id, description: p.name, qty: 1, unitPrice: p.price }] : []);
  }, [open, procedureId, procedures]);

  const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const upd = (idx: number, patch: Partial<BudgetItem>) => setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const save = () => {
    const b = addBudget({ leadId, patientId, items, total, status: "aberto" });
    toast("Orçamento criado — lead movido para 'Orçamento Enviado'");
    onSaved?.(b);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Novo orçamento"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!items.length}>Salvar orçamento · {money(total)}</Button>
        </>
      }
    >
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_70px_110px_90px_32px] gap-2 text-[11px] font-medium uppercase tracking-wide text-muted">
          <span>Procedimento</span><span>Qtd.</span><span>Valor unit.</span><span className="text-right">Subtotal</span><span />
        </div>
        {items.map((it, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_70px_110px_90px_32px] items-center gap-2">
            <Select
              value={it.procedureId}
              onChange={(e) => {
                const p = procedures.find((x) => x.id === e.target.value)!;
                upd(idx, { procedureId: p.id, description: p.name, unitPrice: p.price });
              }}
            >
              {procedures.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Input type="number" min={1} value={it.qty} onChange={(e) => upd(idx, { qty: Math.max(1, Number(e.target.value)) })} />
            <Input type="number" min={0} value={it.unitPrice} onChange={(e) => upd(idx, { unitPrice: Number(e.target.value) })} />
            <span className="text-right text-sm font-medium">{money(it.qty * it.unitPrice)}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted" onClick={() => setItems((a) => a.filter((_, i) => i !== idx))} aria-label="Remover item">
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const p = procedures[0];
            setItems((a) => [...a, { procedureId: p.id, description: p.name, qty: 1, unitPrice: p.price }]);
          }}
        >
          <Plus size={14} /> Adicionar item
        </Button>
        <div className="flex justify-end border-t border-border pt-3 text-sm">
          Total: <span className="ml-2 font-semibold">{money(total)}</span>
        </div>
      </div>
    </Modal>
  );
}
