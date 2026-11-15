"use client";

/** Página de impressão do recibo / NFS-e de reembolso (abre em nova aba; Imprimir ou salvar em PDF). */
import Link from "next/link";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { ReimbursementDocument } from "@/components/reimbursement";
import { useApp, useCurrentUser, useHydrated } from "@/lib/store";
import { canIssueReimbursement, can } from "@/lib/permissions";

export default function DocumentoPage() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const doc = useApp((s) => s.reimbursementDocs.find((d) => d.id === id));
  const patient = useApp((s) => s.patients.find((p) => p.id === doc?.patientId));
  const professional = useApp((s) => s.professionals.find((p) => p.id === doc?.professionalId));
  const clinic = useApp((s) => s.clinic);
  const appointments = useApp((s) => s.appointments);
  const procedures = useApp((s) => s.procedures);
  const roles = useApp((s) => s.settings.reimbursementRoles);

  if (!hydrated) return <p className="p-10 text-center text-sm text-muted">Carregando…</p>;
  if (!user) {
    return (
      <div className="p-10 text-center text-sm">
        Faça login para ver este documento. <Link href="/login" className="font-semibold text-primary-strong hover:underline">Entrar</Link>
      </div>
    );
  }
  // mesmo critério da ficha: quem vê o financeiro, quem emite, ou o profissional que assina
  const allowed = can(user.role, "financeiro.view") || user.role === "recepcao" || canIssueReimbursement(user.role, roles) || user.professionalId === doc?.professionalId;
  if (!doc || !patient || !allowed) return <p className="p-10 text-center text-sm text-muted">Documento não encontrado ou sem permissão.</p>;

  return (
    <div className="min-h-screen bg-surface-2 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[800px] items-center justify-between px-4 print:hidden">
        <Link href={`/pacientes/${patient.id}?secao=financeiro`} className="text-sm text-muted hover:text-fg">← Voltar para a ficha</Link>
        <Button onClick={() => window.print()}><Printer size={14} /> Imprimir / salvar PDF</Button>
      </div>
      <ReimbursementDocument doc={doc} patient={patient} professional={professional} clinic={clinic} appointments={appointments} procedures={procedures} />
    </div>
  );
}
