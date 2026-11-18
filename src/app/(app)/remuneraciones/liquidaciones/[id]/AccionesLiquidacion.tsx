"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoLiquidacion } from "../acciones";
import { claseBotonPrimario, claseBotonSecundario } from "@/components/ui/estilos";

export function AccionesLiquidacion({ id, estado }: { id: string; estado: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const ir = (e: "aprobada" | "calculada" | "anulada") =>
    iniciar(async () => {
      const r = await cambiarEstadoLiquidacion(id, e);
      if (r.error) alert(r.error);
      router.refresh();
    });
  if (estado === "calculada") return <button type="button" disabled={pendiente} className={claseBotonPrimario} onClick={() => ir("aprobada")}>Aprobar</button>;
  if (estado === "aprobada")
    return (
      <button type="button" disabled={pendiente} className={claseBotonSecundario} onClick={() => confirm("¿Anular la aprobación? Podrás recalcularla.") && ir("calculada")}>
        Quitar aprobación
      </button>
    );
  return null;
}
