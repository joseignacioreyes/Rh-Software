"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { centralizar, guardarConfig } from "./acciones";
import { formatoPesos } from "@/lib/formato";
import { claseBotonPrimario, claseBotonSecundario, claseError, claseExito, claseInput } from "@/components/ui/estilos";

type Props = {
  puedeEditar: boolean;
  configGuardada: boolean;
  config: Record<string, string>;
  opciones: { id: string; texto: string }[];
  definiciones: { clave: string; nombre: string; grupo: string }[];
  libros: { que: "compras" | "ventas" | "honorarios"; titulo: string; documentos: number; total: number; previo: { id: string; numero: number } | null }[];
};

export function Centralizacion({ puedeEditar, configGuardada, config, opciones, definiciones, libros }: Props) {
  const router = useRouter();
  const [valores, setValores] = useState(config);
  const [verConfig, setVerConfig] = useState(!configGuardada);
  const [mensaje, setMensaje] = useState<{ ok?: string; error?: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const ejecutar = (p: Promise<{ ok?: string; error?: string }>) =>
    iniciar(async () => {
      setMensaje(await p);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {mensaje?.ok && <p className={claseExito}>{mensaje.ok}</p>}
      {mensaje?.error && <p className={claseError}>{mensaje.error}</p>}
      <div className="grid grid-cols-3 gap-4">
        {libros.map((l) => (
          <div key={l.que} className="rounded-lg border border-borde bg-white p-4">
            <h2 className="font-bold text-azul">{l.titulo}</h2>
            <p className="mt-1 text-sm text-texto-suave">{l.documentos} documentos · total {formatoPesos(l.total)}</p>
            <p className="mt-2 text-sm">
              {l.previo ? (
                <>Centralizado en el <Link href={`/contabilidad/comprobantes/${l.previo.id}`} className="text-azul underline">comprobante N° {l.previo.numero}</Link></>
              ) : (
                <span className="text-ambar">Aún no centralizado</span>
              )}
            </p>
            {puedeEditar && (
              <button
                type="button"
                disabled={pendiente || l.documentos === 0 || !configGuardada}
                className={`${l.previo ? claseBotonSecundario : claseBotonPrimario} mt-3`}
                onClick={() => {
                  if (l.previo && !confirm("Ya existe la centralización de este mes. Se anulará la anterior y se generará una nueva. ¿Continuar?")) return;
                  ejecutar(centralizar(l.que));
                }}
              >
                {l.previo ? "Regenerar" : "Centralizar"}
              </button>
            )}
          </div>
        ))}
      </div>
      {!configGuardada && <p className="text-sm text-ambar">Primero revisa y guarda las cuentas de destino (una sola vez por empresa).</p>}

      <div className="rounded-lg border border-borde bg-white">
        <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left font-bold text-azul" onClick={() => setVerConfig((v) => !v)}>
          Cuentas de destino {verConfig ? "▲" : "▼"}
        </button>
        {verConfig && (
          <div className="grid grid-cols-3 gap-6 border-t border-borde p-4">
            {["compras", "ventas", "honorarios"].map((g) => (
              <div key={g} className="space-y-2">
                <h3 className="text-sm font-semibold capitalize">{g}</h3>
                {definiciones.filter((d) => d.grupo === g).map((d) => (
                  <label key={d.clave} className="block text-xs text-texto-suave">{d.nombre}
                    <select disabled={!puedeEditar} value={valores[d.clave] ?? ""} onChange={(e) => setValores({ ...valores, [d.clave]: e.target.value })} className={`${claseInput} py-1 text-xs`}>
                      <option value="">— Elegir —</option>
                      {opciones.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            ))}
            {puedeEditar && (
              <div className="col-span-3">
                <button type="button" disabled={pendiente} className={claseBotonPrimario} onClick={() => ejecutar(guardarConfig(valores))}>Guardar cuentas</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
