"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoEmpresa } from "../acciones";
import { claseBotonSecundario } from "@/components/ui/estilos";

/** Desactivar no borra nada: la empresa deja de aparecer en el selector y en "Mi mes". */
export function BotonEstadoEmpresa({ id, activa }: { id: string; activa: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      className={claseBotonSecundario}
      onClick={() => {
        const pregunta = activa
          ? "¿Desactivar esta empresa? No se borra ningún dato: deja de aparecer en el selector y en “Mi mes”, y puedes reactivarla cuando quieras."
          : "¿Reactivar esta empresa?";
        if (!confirm(pregunta)) return;
        iniciar(async () => {
          const r = await cambiarEstadoEmpresa(id, !activa);
          if (r.error) alert(r.error);
          router.refresh();
        });
      }}
    >
      {activa ? "Desactivar" : "Reactivar"}
    </button>
  );
}
