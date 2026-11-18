"use client";

import { useActionState } from "react";
import { registrarLicencia, registrarVacaciones } from "./acciones";
import { claseBotonPrimario, claseError, claseExito, claseInput } from "@/components/ui/estilos";

export function Formularios({ trabajadores }: { trabajadores: { id: string; nombre: string }[] }) {
  const [ev, av, pv] = useActionState(registrarVacaciones, undefined);
  const [el, al, pl] = useActionState(registrarLicencia, undefined);
  const selector = (
    <select name="trabajador_id" className={claseInput} required defaultValue="">
      <option value="" disabled>Trabajador…</option>
      {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
    </select>
  );
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form action={av} className="space-y-2 rounded-lg border border-borde bg-white p-4">
        <h2 className="font-bold text-azul">Registrar vacaciones</h2>
        <div className="grid grid-cols-3 gap-2">
          {selector}
          <input type="date" name="desde" className={claseInput} required aria-label="Desde" />
          <input type="date" name="hasta" className={claseInput} required aria-label="Hasta" />
        </div>
        <input name="observaciones" placeholder="Observaciones (opcional)" className={claseInput} />
        <button type="submit" disabled={pv} className={claseBotonPrimario}>Registrar</button>
        {ev?.error && <p className={claseError}>{ev.error}</p>}
        {ev?.ok && <p className={claseExito}>{ev.ok}</p>}
      </form>
      <form action={al} className="space-y-2 rounded-lg border border-borde bg-white p-4">
        <h2 className="font-bold text-azul">Registrar licencia médica</h2>
        <div className="grid grid-cols-3 gap-2">
          {selector}
          <input type="date" name="desde" className={claseInput} required aria-label="Desde" />
          <input type="date" name="hasta" className={claseInput} required aria-label="Hasta" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select name="tipo" className={claseInput} defaultValue="enfermedad">
            <option value="enfermedad">Enfermedad</option><option value="accidente_trabajo">Accidente del trabajo</option>
            <option value="maternal">Maternal</option><option value="hijo_menor">Hijo menor de 1 año</option><option value="otra">Otra</option>
          </select>
          <input name="folio" placeholder="Folio" className={claseInput} />
          <input name="rut_pagadora" placeholder="RUT pagadora del subsidio" className={claseInput} />
        </div>
        <button type="submit" disabled={pl} className={claseBotonPrimario}>Registrar</button>
        {el?.error && <p className={claseError}>{el.error}</p>}
        {el?.ok && <p className={claseExito}>{el.ok}</p>}
      </form>
    </div>
  );
}
