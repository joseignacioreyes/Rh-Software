"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarRevisado } from "./acciones";

export function EstadoFiniquito({ id, estado }: { id: string; estado: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const ir = (e: "revisado" | "firmado" | "anulado", pregunta: string) => {
    if (!confirm(pregunta)) return;
    iniciar(async () => {
      const r = await marcarRevisado(id, e);
      if (r.error) alert(r.error);
      router.refresh();
    });
  };
  return (
    <span className="ml-3 inline-flex gap-3">
      {estado === "borrador" && <button type="button" disabled={pendiente} className="text-azul hover:underline" onClick={() => ir("revisado", "¿Confirmas que revisaste el cálculo del finiquito? Quedará tu nombre como revisor.")}>Marcar revisado</button>}
      {estado === "revisado" && <button type="button" disabled={pendiente} className="text-verde hover:underline" onClick={() => ir("firmado", "¿El finiquito fue firmado y ratificado? Se registrará la fecha de término en la ficha.")}>Marcar firmado</button>}
      {estado !== "anulado" && estado !== "firmado" && <button type="button" disabled={pendiente} className="text-rojo hover:underline" onClick={() => ir("anulado", "¿Anular este finiquito?")}>Anular</button>}
    </span>
  );
}
