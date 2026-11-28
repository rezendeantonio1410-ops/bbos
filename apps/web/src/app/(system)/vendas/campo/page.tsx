"use client";

import { FieldTeamReport } from "@/components/field-team-report";

/** Equipe em campo: km, tempo com clientes e venda por km (só liderança). */
export default function EquipeEmCampoPage() {
  return (
    <div className="mx-auto max-w-[1100px] space-y-4 px-4 py-5 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Equipe em campo</h1>
        <p className="text-sm text-stone-500">Quilômetros, tempo com clientes e quanto cada km rendeu em vendas. Os dados vêm do BBOS Campo, entre Iniciar dia e Encerrar dia.</p>
      </header>
      <FieldTeamReport />
    </div>
  );
}
