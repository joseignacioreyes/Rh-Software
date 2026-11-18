"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { verificarParametro } from "./accion";

export function BotonVerificar({ id }: { id: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      className="mt-1 block text-[11px] font-medium text-azul hover:underline"
      onClick={() => {
        const quien = prompt("¿Quién verificó este valor contra la fuente oficial? (nombre)");
        if (!quien) return;
        iniciar(async () => {
          const r = await verificarParametro(id, quien);
          if (r.error) alert(r.error);
          router.refresh();
        });
      }}
    >
      Marcar como verificado
    </button>
  );
}
