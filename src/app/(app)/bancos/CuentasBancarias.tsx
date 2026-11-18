"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { crearCuentaBancaria } from "./acciones";
import { claseBotonPrimario, claseBotonSecundario, claseError, claseInput } from "@/components/ui/estilos";

type Props = {
  cuentas: { id: string; nombre: string }[];
  actual: string | null;
  opcionesCuenta: { id: string; nombre: string }[];
  puedeEditar: boolean;
};

export function CuentasBancarias({ cuentas, actual, opcionesCuenta, puedeEditar }: Props) {
  const [abierto, setAbierto] = useState(cuentas.length === 0);
  const [estado, accion, enviando] = useActionState(crearCuentaBancaria, undefined);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {cuentas.map((c) => (
        <Link key={c.id} href={`/bancos?cuenta=${c.id}`} className={`rounded-md border px-3 py-1.5 text-sm ${c.id === actual ? "border-azul bg-azul text-white" : "border-gray-300 bg-white hover:bg-fondo-suave"}`}>
          {c.nombre}
        </Link>
      ))}
      {puedeEditar && !abierto && <button type="button" className={claseBotonSecundario} onClick={() => setAbierto(true)}>+ Cuenta bancaria</button>}
      {puedeEditar && abierto && (
        <form action={accion} className="flex flex-wrap items-end gap-2 rounded-lg border border-borde bg-white p-3">
          <label className="text-sm">Banco<input name="banco" className={`${claseInput} w-44`} placeholder="Banco Demo" /></label>
          <label className="text-sm">N° de cuenta<input name="numero" className={`${claseInput} w-40`} /></label>
          <label className="text-sm">Cuenta contable
            <select name="cuenta_contable_id" className={`${claseInput} w-72`} defaultValue={opcionesCuenta.find((o) => o.nombre.includes("corriente"))?.id}>
              {opcionesCuenta.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </label>
          <button type="submit" disabled={enviando} className={claseBotonPrimario}>Agregar</button>
          {estado?.error && <p className={claseError}>{estado.error}</p>}
        </form>
      )}
    </div>
  );
}
