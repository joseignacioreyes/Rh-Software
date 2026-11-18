"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calcularF29Empresa, cambiarEstadoF29, guardarComparacion, subirComprobanteF29 } from "./acciones";
import type { LineaF29, ResultadoF29 } from "@/lib/f29";
import { formatoPesos } from "@/lib/formato";
import { claseBotonPrimario, claseBotonSecundario, claseError, claseExito, claseInput } from "@/components/ui/estilos";
import { Etiqueta, Vacio } from "@/components/ui/Encabezado";

type Datos = {
  calculada: ResultadoF29;
  propuestaSii: Record<string, number>;
  ajustes: Record<string, number>;
  estado: string;
  notas: string | null;
  totalAPagar: number;
  revisadoPor: string | null;
  revisadoEl: string | null;
  folio: string | null;
  montoPagado: number | null;
  urlComprobante: string | null;
  versionDatos: string;
  calculadoEl: string;
};

const GRUPOS: { clave: LineaF29["grupo"]; titulo: string }[] = [
  { clave: "debitos", titulo: "Débitos (ventas)" },
  { clave: "creditos", titulo: "Créditos (compras)" },
  { clave: "iva", titulo: "IVA" },
  { clave: "ppm", titulo: "Pagos provisionales mensuales" },
  { clave: "retenciones", titulo: "Retenciones" },
  { clave: "total", titulo: "Total" },
];

const leer = (t: string) => {
  const limpio = t.replace(/[^\d-]/g, "");
  return limpio === "" ? null : Number(limpio);
};
const miles = (n: number | null | undefined) => (n === null || n === undefined ? "" : n.toLocaleString("es-CL"));

export function PanelF29({ f29, explicaciones, puedeEditar, periodo }: { f29: Datos | null; explicaciones: Record<string, string>; puedeEditar: boolean; periodo: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok?: string; error?: string } | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [sii, setSii] = useState<Record<string, number | null>>(f29?.propuestaSii ?? {});
  const [ajustes, setAjustes] = useState<Record<string, number | null>>(f29?.ajustes ?? {});
  const [notas, setNotas] = useState(f29?.notas ?? "");
  const [declarando, setDeclarando] = useState(false);
  const [folio, setFolio] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);

  const ejecutar = (p: Promise<{ ok?: string; error?: string }>) =>
    iniciar(async () => {
      setMensaje(await p);
      router.refresh();
    });

  if (!f29) {
    return (
      <Vacio titulo={`Aún no hay F29 calculado para ${periodo.toLowerCase()}`}>
        {puedeEditar && (
          <button type="button" disabled={pendiente} className={`${claseBotonPrimario} mt-3`} onClick={() => ejecutar(calcularF29Empresa())}>
            {pendiente ? "Calculando…" : "Calcular F29 desde los libros"}
          </button>
        )}
      </Vacio>
    );
  }

  const bloqueado = f29.estado === "declarado" || f29.estado === "pagado";
  const final = (l: LineaF29) => (ajustes[l.codigo] ?? null) !== null ? ajustes[l.codigo]! : l.valor;
  const resumen = f29.calculada.lineas.filter((l) => final(l) !== 0);
  const hayDif = f29.calculada.lineas.some((l) => sii[l.codigo] !== undefined && sii[l.codigo] !== null && sii[l.codigo] !== final(l));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {puedeEditar && !bloqueado && (
          <button type="button" disabled={pendiente} className={claseBotonSecundario} onClick={() => ejecutar(calcularF29Empresa())}>Recalcular</button>
        )}
        {puedeEditar && f29.estado === "borrador" && (
          <button type="button" disabled={pendiente} className={claseBotonPrimario} onClick={() => ejecutar(cambiarEstadoF29("revisado"))}>Marcar como revisado</button>
        )}
        {puedeEditar && f29.estado === "revisado" && (
          <>
            <button type="button" disabled={pendiente} className={claseBotonPrimario} onClick={() => setDeclarando(true)}>Marcar como declarado y pagado</button>
            <button type="button" disabled={pendiente} className={claseBotonSecundario} onClick={() => ejecutar(cambiarEstadoF29("borrador"))}>Volver a borrador</button>
          </>
        )}
        {f29.revisadoPor && <span className="text-sm text-texto-suave">Revisado por: <strong className="text-texto">{f29.revisadoPor}</strong> el {f29.revisadoEl}</span>}
        {bloqueado && f29.folio && <span className="text-sm text-texto-suave">· Folio {f29.folio}</span>}
        {f29.urlComprobante && <a href={f29.urlComprobante} target="_blank" rel="noopener noreferrer" className="text-sm text-azul underline">Ver comprobante de pago</a>}
        <span className="ml-auto text-xs text-texto-suave">Calculado el {f29.calculadoEl} · versión de datos {f29.versionDatos}</span>
      </div>

      {mensaje?.ok && <p className={claseExito}>{mensaje.ok}</p>}
      {mensaje?.error && <p className={claseError}>{mensaje.error}</p>}

      {f29.calculada.avisos.length > 0 && (
        <ul className="space-y-1">
          {f29.calculada.avisos.map((a) => <li key={a} className="rounded-md border border-ambar/30 bg-amber-50 px-3 py-2 text-sm text-texto"><strong className="text-ambar">Revisar:</strong> {a}</li>)}
        </ul>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-lg border border-borde bg-white">
          <table className="w-full text-sm">
            <thead className="bg-fondo-suave text-xs text-texto-suave">
              <tr>
                <th className="w-16 px-3 py-2 text-left font-semibold">Código</th>
                <th className="px-3 py-2 text-left font-semibold">Concepto</th>
                <th className="w-32 px-3 py-2 text-right font-semibold">RH Software</th>
                <th className="w-32 px-3 py-2 text-right font-semibold">Ajuste</th>
                <th className="w-32 px-3 py-2 text-right font-semibold">Propuesta SII</th>
                <th className="w-28 px-3 py-2 text-right font-semibold">Diferencia</th>
                <th className="w-8" />
              </tr>
            </thead>
            {GRUPOS.map((g) => {
              const ls = f29.calculada.lineas.filter((l) => l.grupo === g.clave);
              if (!ls.length) return null;
              return (
                <tbody key={g.clave}>
                  <tr className="bg-celeste/40"><td colSpan={7} className="px-3 py-1.5 text-xs font-bold text-azul">{g.titulo}</td></tr>
                  {ls.map((l) => {
                    const valorSii = sii[l.codigo] ?? null;
                    const dif = valorSii === null ? null : valorSii - final(l);
                    const total = ["538", "537", "89", "77", "91"].includes(l.codigo);
                    return (
                      <Fragment key={l.codigo}>
                        <tr className={`border-t border-gray-100 ${total ? "font-semibold" : ""} ${dif ? "bg-red-50" : ""}`}>
                          <td className="numeros px-3 py-1.5 text-texto-suave">{l.codigo}</td>
                          <td className="px-3 py-1.5">{l.nombre}</td>
                          <td className="numeros px-3 py-1.5 text-right">{l.esCantidad ? miles(l.valor) : formatoPesos(l.valor)}</td>
                          <td className="px-1 py-1">
                            <input
                              disabled={bloqueado || !puedeEditar || total}
                              value={miles(ajustes[l.codigo] ?? null)}
                              onChange={(e) => setAjustes({ ...ajustes, [l.codigo]: leer(e.target.value) })}
                              className="numeros w-full rounded border border-transparent px-2 py-1 text-right text-sm hover:border-gray-300 focus:border-azul focus:outline-none disabled:bg-transparent"
                              aria-label={`Ajuste código ${l.codigo}`}
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              disabled={!puedeEditar}
                              value={miles(valorSii)}
                              onChange={(e) => setSii({ ...sii, [l.codigo]: leer(e.target.value) })}
                              className="numeros w-full rounded border border-gray-200 px-2 py-1 text-right text-sm focus:border-azul focus:outline-none"
                              aria-label={`Propuesta SII código ${l.codigo}`}
                            />
                          </td>
                          <td className={`numeros px-3 py-1.5 text-right ${dif ? "font-semibold text-rojo" : dif === 0 ? "text-verde" : ""}`}>
                            {dif === null ? "" : dif === 0 ? "Cuadra" : formatoPesos(dif)}
                          </td>
                          <td className="pr-2 text-center">
                            <button type="button" onClick={() => setAbierta(abierta === l.codigo ? null : l.codigo)} className="text-xs text-azul hover:underline" title="Ver cómo se calculó" aria-expanded={abierta === l.codigo}>
                              {abierta === l.codigo ? "▲" : "?"}
                            </button>
                          </td>
                        </tr>
                        {(abierta === l.codigo || (dif !== null && dif !== 0)) && (
                          <tr className="bg-fondo-suave/80 text-xs">
                            <td />
                            <td colSpan={6} className="px-3 py-2 text-texto-suave">
                              <strong className="text-texto">Cómo se calculó:</strong> {l.formula}{l.detalle ? ` (${l.detalle})` : ""}.
                              {dif !== null && dif !== 0 && explicaciones[l.codigo] && <span className="ml-1 text-rojo">Posible causa de la diferencia: {explicaciones[l.codigo]}</span>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
          <div className="flex flex-wrap items-center gap-3 border-t border-borde bg-fondo-suave px-3 py-2">
            <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (motivo de los ajustes, observaciones)" className={`${claseInput} max-w-lg flex-1 py-1`} disabled={!puedeEditar} />
            {puedeEditar && (
              <button type="button" disabled={pendiente} className={claseBotonSecundario} onClick={() => ejecutar(guardarComparacion(sii, ajustes, notas))}>
                Guardar comparación y ajustes
              </button>
            )}
            {hayDif ? <Etiqueta tono="rojo">Hay diferencias con el SII</Etiqueta> : Object.keys(sii).length > 0 ? <Etiqueta tono="verde">Cuadra con el SII</Etiqueta> : null}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-borde bg-white p-4">
            <h2 className="mb-2 font-bold text-azul">Resumen para declarar en sii.cl</h2>
            <dl className="space-y-1 text-sm">
              {resumen.map((l) => (
                <div key={l.codigo} className="flex justify-between gap-2">
                  <dt className="text-texto-suave">Código <span className="numeros font-semibold text-texto">{l.codigo}</span></dt>
                  <dd className="numeros">{l.esCantidad ? miles(final(l)) : formatoPesos(final(l))}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-borde pt-2 text-sm font-bold">Total a pagar: <span className="numeros">{formatoPesos(f29.totalAPagar)}</span></p>
            <button
              type="button"
              className="mt-2 text-xs text-azul hover:underline"
              onClick={() => navigator.clipboard.writeText(resumen.map((l) => `${l.codigo}\t${final(l)}`).join("\n"))}
            >
              Copiar códigos y montos
            </button>
          </div>
          <div className="rounded-lg border border-borde bg-white p-4 text-xs">
            <h2 className="mb-2 text-sm font-bold text-azul">Parámetros usados</h2>
            <ul className="space-y-2">
              {f29.calculada.parametros.map((p) => (
                <li key={`${p.codigo}${p.vigente_desde}`}>
                  <p className="font-semibold text-texto">{p.descripcion}: <span className="numeros">{typeof p.valor === "number" ? `${p.valor.toLocaleString("es-CL")}${p.unidad === "%" ? "%" : ""}` : "tabla"}</span></p>
                  <p className="text-texto-suave">
                    Vigente desde {p.vigente_desde.split("-").reverse().join("-")} · {p.fuente_url ? <a href={p.fuente_url} target="_blank" rel="noopener noreferrer" className="underline">{p.fuente}</a> : p.fuente}
                    {p.estado === "por_verificar" && <span className="ml-1 font-semibold text-ambar">POR VERIFICAR</span>}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-texto-suave">Los códigos del formulario deben verificarse con el instructivo vigente del SII. RH Software asiste: el contador revisa y responde por lo que declara.</p>
          </div>
        </aside>
      </div>

      {declarando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDeclarando(false)}>
          <div role="dialog" aria-label="Declarado y pagado" className="w-[460px] rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Declarado y pagado en sii.cl</h2>
            <p className="mt-1 text-sm text-texto-suave">Desde ahora el cálculo queda bloqueado. Adjunta el comprobante para tener el respaldo.</p>
            <label className="mt-3 block text-sm">Folio de la declaración<input value={folio} onChange={(e) => setFolio(e.target.value)} className={claseInput} /></label>
            <label className="mt-3 block text-sm">Comprobante (PDF o foto)<input type="file" accept=".pdf,image/*" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="block text-sm" /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={claseBotonSecundario} onClick={() => setDeclarando(false)}>Cancelar</button>
              <button
                type="button"
                disabled={pendiente}
                className={claseBotonPrimario}
                onClick={() =>
                  iniciar(async () => {
                    const r = await cambiarEstadoF29("pagado", { folio, monto: f29.totalAPagar });
                    if (!r.error && archivo) {
                      const fd = new FormData();
                      fd.set("archivo", archivo);
                      const s = await subirComprobanteF29(fd);
                      if (s.error) return setMensaje(s);
                    }
                    setMensaje(r);
                    setDeclarando(false);
                    router.refresh();
                  })
                }
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
