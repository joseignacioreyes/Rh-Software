"use client";

import { useRouter } from "next/navigation";

/** Lista de cuentas para cambiar el mayor que se está viendo. */
export function SelectorCuenta({ cuentas, actual }: { cuentas: { id: string; codigo: string; nombre: string }[]; actual?: string }) {
  const router = useRouter();
  return (
    <select
      aria-label="Elegir cuenta"
      value={actual ?? ""}
      onChange={(e) => router.push(e.target.value ? `/contabilidad/libro-mayor?cuenta=${e.target.value}` : "/contabilidad/libro-mayor")}
      className="w-80 rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
    >
      <option value="">Elegir cuenta…</option>
      {cuentas.map((c) => (
        <option key={c.id} value={c.id}>{c.codigo} {c.nombre}</option>
      ))}
    </select>
  );
}
