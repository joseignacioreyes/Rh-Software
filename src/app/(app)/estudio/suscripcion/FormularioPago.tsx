"use client";

import { useActionState, useState } from "react";
import { informarPago } from "./acciones";
import { formatoPesos } from "@/lib/formato";
import { claseBotonPrimario, claseEtiqueta, claseError, claseExito, claseInput } from "@/components/ui/estilos";

type Plan = { codigo: string; nombre: string; precio_mensual: number; max_empresas: number };

export function FormularioPago({ planes, planActual, hoy }: { planes: Plan[]; planActual: string; hoy: string }) {
  const [estado, accion, pendiente] = useActionState(informarPago, null as { ok?: string; error?: string } | null);
  const [plan, setPlan] = useState(planActual);
  const [meses, setMeses] = useState(1);
  const precio = planes.find((p) => p.codigo === plan)?.precio_mensual ?? 0;
  return (
    <form action={accion} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label><span className={claseEtiqueta}>Plan</span>
          <select name="plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={claseInput}>
            {planes.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre} (hasta {p.max_empresas} empresas)</option>)}
          </select>
        </label>
        <label><span className={claseEtiqueta}>Meses que pagas</span>
          <select name="meses" value={meses} onChange={(e) => setMeses(Number(e.target.value))} className={claseInput}>
            {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}</option>)}
          </select>
        </label>
        <label><span className={claseEtiqueta}>Fecha de la transferencia</span><input type="date" name="fecha" defaultValue={hoy} max={hoy} className={claseInput} required /></label>
        <label><span className={claseEtiqueta}>Banco de origen</span><input name="banco" placeholder="Ej.: BancoEstado" className={claseInput} /></label>
        <label><span className={claseEtiqueta}>N° de operación (opcional)</span><input name="operacion" className={claseInput} /></label>
        <label><span className={claseEtiqueta}>Comprobante (foto o PDF)</span><input type="file" name="comprobante" accept="image/*,application/pdf" className="block w-full text-sm" required /></label>
      </div>
      <p className="rounded-md bg-celeste px-3 py-2 text-sm">Monto a transferir: <b className="numeros">{formatoPesos(precio * meses)}</b> ({meses} × {formatoPesos(precio)}, IVA incluido)</p>
      {estado?.error && <p className={claseError}>{estado.error}</p>}
      {estado?.ok && <p className={claseExito}>{estado.ok}</p>}
      <button type="submit" disabled={pendiente} className={claseBotonPrimario}>{pendiente ? "Enviando…" : "Informar pago"}</button>
    </form>
  );
}
