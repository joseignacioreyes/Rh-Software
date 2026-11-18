"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aprobarPago, rechazarPago, ajustarSuscripcion } from "./acciones";

export function RevisarPago({ id }: { id: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button type="button" disabled={pendiente} className="rounded-md bg-verde px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          onClick={() => { if (confirm("¿Aprobar este pago? Se extiende la suscripción del estudio.")) iniciar(async () => { setMsg(await aprobarPago(id)); router.refresh(); }); }}>Aprobar</button>
        <button type="button" disabled={pendiente} className="rounded-md border border-rojo px-3 py-1 text-xs font-semibold text-rojo disabled:opacity-60"
          onClick={() => { const m = prompt("Motivo del rechazo (lo verá el estudio):"); if (m) iniciar(async () => { setMsg(await rechazarPago(id, m)); router.refresh(); }); }}>Rechazar</button>
      </div>
      {msg?.error && <span className="text-xs text-rojo">{msg.error}</span>}
      {msg?.ok && <span className="text-xs text-verde">{msg.ok}</span>}
    </div>
  );
}

export function ExtenderPrueba({ estudioId, hasta }: { estudioId: string; hasta: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return (
    <button type="button" disabled={pendiente} className="text-xs text-azul underline disabled:opacity-60"
      onClick={() => {
        const d = new Date(`${hasta}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 15);
        if (confirm("¿Extender 15 días?")) iniciar(async () => { await ajustarSuscripcion(estudioId, { pagado_hasta: d.toISOString().slice(0, 10) }); router.refresh(); });
      }}>+15 días</button>
  );
}
