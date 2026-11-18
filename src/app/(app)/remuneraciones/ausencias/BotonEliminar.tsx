"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarRegistro } from "./acciones";

/** Eliminar pide confirmación (nada se borra sin preguntar) y queda en la auditoría. */
export function BotonEliminar({ tabla, id }: { tabla: "vacaciones" | "licencias"; id: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      className="text-xs text-rojo hover:underline"
      onClick={() => {
        if (!confirm(`¿Eliminar este registro de ${tabla}? Quedará constancia en la auditoría.`)) return;
        iniciar(async () => {
          const r = await eliminarRegistro(tabla, id);
          if (r.error) alert(r.error);
          router.refresh();
        });
      }}
    >
      Eliminar
    </button>
  );
}
