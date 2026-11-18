"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aprobarTodas, calcularLiquidaciones, guardarNovedad, type CampoNovedad } from "./acciones";
import { formatoPesos } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";
import { claseBotonPrimario, claseBotonSecundario, claseError, claseExito } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Encabezado";

export type FilaTrabajador = {
  id: string;
  nombre: string;
  rut: string;
  cargo: string | null;
  novedades: Partial<Record<CampoNovedad, number>>;
  liquidacion: {
    id: string; estado: string; dias: number; imponible: number; haberes: number; descuentos: number; liquido: number; costo: number; impuesto: number;
    alertas: { tono: string; texto: string }[]; desactualizada: boolean;
  } | null;
};

const COLUMNAS: { campo: CampoNovedad; titulo: string; esMonto: boolean }[] = [
  { campo: "horas_extra", titulo: "Horas extra", esMonto: false },
  { campo: "dias_licencia", titulo: "Días licencia", esMonto: false },
  { campo: "dias_ausencia", titulo: "Días ausencia", esMonto: false },
  { campo: "bono_imponible", titulo: "Bonos", esMonto: true },
  { campo: "comisiones", titulo: "Comisiones", esMonto: true },
  { campo: "anticipo", titulo: "Anticipo", esMonto: true },
  { campo: "prestamo", titulo: "Préstamo", esMonto: true },
];

export function PanelLiquidaciones({ filas, puedeEditar }: { filas: FilaTrabajador[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [valores, setValores] = useState(() => Object.fromEntries(filas.map((f) => [f.id, { ...f.novedades }])));
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ ok?: string; error?: string; avisos?: string[] } | null>(null);
  const [pendiente, iniciar] = useTransition();

  async function guardar(id: string) {
    setGuardando(id);
    const r = await guardarNovedad(id, valores[id]);
    setGuardando(null);
    if (r.error) setMensaje({ error: r.error });
  }

  const total = (k: "haberes" | "descuentos" | "liquido" | "costo" | "impuesto") => filas.reduce((s, f) => s + (f.liquidacion && f.liquidacion.estado !== "anulada" ? f.liquidacion[k] : 0), 0);
  const calculadas = filas.filter((f) => f.liquidacion?.estado === "calculada").length;
  const alertas = filas.flatMap((f) => f.liquidacion?.alertas ?? []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {puedeEditar && (
          <button
            type="button"
            disabled={pendiente}
            className={claseBotonPrimario}
            onClick={() => iniciar(async () => { setMensaje(await calcularLiquidaciones()); router.refresh(); })}
          >
            {pendiente ? "Calculando…" : "Calcular liquidaciones del mes"}
          </button>
        )}
        {puedeEditar && calculadas > 0 && (
          <button type="button" disabled={pendiente} className={claseBotonSecundario} onClick={() => iniciar(async () => { setMensaje(await aprobarTodas()); router.refresh(); })}>
            Aprobar {calculadas} liquidaciones
          </button>
        )}
        <span className="text-xs text-texto-suave">Las novedades se guardan al salir de cada celda. Usa Enter para pasar a la siguiente.</span>
      </div>
      {mensaje?.ok && <p className={claseExito}>{mensaje.ok}</p>}
      {mensaje?.error && <p className={claseError}>{mensaje.error}</p>}
      {alertas.length > 0 && (
        <ul className="space-y-1">
          {[...new Set(alertas.map((a) => `${a.tono}|${a.texto}`))].map((k) => {
            const [tono, texto] = k.split("|");
            return <li key={k} className={`rounded-md border px-3 py-1.5 text-sm ${tono === "rojo" ? "border-rojo/30 bg-red-50" : "border-ambar/30 bg-amber-50"}`}><strong className={tono === "rojo" ? "text-rojo" : "text-ambar"}>{tono === "rojo" ? "Corregir:" : "Revisar:"}</strong> {texto}</li>;
          })}
        </ul>
      )}
      <div className="overflow-x-auto rounded-lg border border-borde bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-fondo-suave text-xs text-texto-suave">
            <tr>
              <th rowSpan={2} className="px-3 py-2 text-left font-semibold">Trabajador</th>
              <th colSpan={COLUMNAS.length} className="border-l border-borde px-2 pt-1.5 text-center font-semibold">Novedades del mes</th>
              <th colSpan={6} className="border-l border-borde px-2 pt-1.5 text-center font-semibold">Liquidación</th>
            </tr>
            <tr>
              {COLUMNAS.map((c, i) => <th key={c.campo} className={`px-1 py-1.5 text-right text-[11px] leading-tight font-semibold ${i === 0 ? "border-l border-borde" : ""}`}>{c.titulo}</th>)}
              <th className="border-l border-borde px-2 py-1.5 text-right font-semibold">Días</th>
              <th className="px-2 py-1.5 text-right font-semibold">Haberes</th>
              <th className="px-2 py-1.5 text-right font-semibold">Descuentos</th>
              <th className="px-2 py-1.5 text-right font-semibold">Líquido</th>
              <th className="px-2 py-1.5 text-right font-semibold">Costo empresa</th>
              <th className="px-2 py-1.5 text-left font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, fi) => (
              <tr key={f.id} className="border-t border-gray-100">
                <td className="px-3 py-1.5">
                  <Link href={f.liquidacion ? `/remuneraciones/liquidaciones/${f.liquidacion.id}` : `/remuneraciones/trabajadores/${f.id}`} className="font-medium hover:text-azul hover:underline">{f.nombre}</Link>
                  <div className="numeros text-xs text-texto-suave">{formatearRut(f.rut)}</div>
                </td>
                {COLUMNAS.map((c, ci) => (
                  <td key={c.campo} className={`px-0.5 py-0.5 ${ci === 0 ? "border-l border-gray-100" : ""}`}>
                    <input
                      id={`nov-${fi}-${ci}`}
                      disabled={!puedeEditar || f.liquidacion?.estado === "aprobada"}
                      inputMode="numeric"
                      value={valores[f.id][c.campo] ? (c.esMonto ? valores[f.id][c.campo]!.toLocaleString("es-CL") : String(valores[f.id][c.campo])) : ""}
                      onChange={(e) => {
                        const v = c.esMonto ? Number(e.target.value.replace(/\D/g, "")) : Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""));
                        setValores({ ...valores, [f.id]: { ...valores[f.id], [c.campo]: Number.isFinite(v) ? v : 0 } });
                      }}
                      onBlur={() => guardar(f.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const sig = document.getElementById(ci + 1 < COLUMNAS.length ? `nov-${fi}-${ci + 1}` : `nov-${fi + 1}-0`);
                          (sig as HTMLInputElement | null)?.focus();
                        }
                      }}
                      aria-label={`${c.titulo} de ${f.nombre}`}
                      className={`numeros w-[4.25rem] rounded border border-transparent px-1.5 py-1 text-right hover:border-gray-300 focus:border-azul focus:bg-celeste/40 focus:outline-none ${guardando === f.id ? "opacity-60" : ""}`}
                    />
                  </td>
                ))}
                {f.liquidacion ? (
                  <>
                    <td className="numeros border-l border-gray-100 px-2 py-1.5 text-right">{f.liquidacion.dias}</td>
                    <td className="numeros px-2 py-1.5 text-right">{formatoPesos(f.liquidacion.haberes)}</td>
                    <td className="numeros px-2 py-1.5 text-right">{formatoPesos(f.liquidacion.descuentos)}</td>
                    <td className="numeros px-2 py-1.5 text-right font-semibold">{formatoPesos(f.liquidacion.liquido)}</td>
                    <td className="numeros px-2 py-1.5 text-right text-texto-suave">{formatoPesos(f.liquidacion.costo)}</td>
                    <td className="px-2 py-1.5">
                      {f.liquidacion.estado === "aprobada" ? <Etiqueta tono="verde">Aprobada</Etiqueta> : f.liquidacion.estado === "anulada" ? <Etiqueta tono="gris">Anulada</Etiqueta> : f.liquidacion.desactualizada ? <Etiqueta tono="ambar">Recalcular</Etiqueta> : <Etiqueta tono="azul">Calculada</Etiqueta>}
                    </td>
                  </>
                ) : (
                  <td colSpan={6} className="border-l border-gray-100 px-2 py-1.5 text-center text-xs text-texto-suave">Sin calcular</td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-borde bg-fondo-suave font-semibold">
            <tr>
              <td className="px-3 py-2">Totales ({filas.length} trabajadores)</td>
              <td colSpan={COLUMNAS.length} />
              <td />
              <td className="numeros px-2 py-2 text-right">{formatoPesos(total("haberes"))}</td>
              <td className="numeros px-2 py-2 text-right">{formatoPesos(total("descuentos"))}</td>
              <td className="numeros px-2 py-2 text-right">{formatoPesos(total("liquido"))}</td>
              <td className="numeros px-2 py-2 text-right">{formatoPesos(total("costo"))}</td>
              <td className="px-2 py-2 text-xs font-normal text-texto-suave">Imp. único {formatoPesos(total("impuesto"))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
