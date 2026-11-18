"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copiarPlan, crearCuenta, editarCuenta, importarPlanExcel } from "./acciones";
import { NOMBRE_TIPO, type Cuenta, type TipoCuenta } from "@/lib/contabilidad";
import { descargarExcel } from "@/lib/excel";
import {
  claseBotonPrimario, claseBotonSecundario, claseError, claseEtiqueta, claseExito, claseInput,
} from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Encabezado";

type Props = {
  cuentas: Cuenta[];
  conMovimientos: string[];
  puedeEditar: boolean;
  otrasEmpresas: { id: string; nombre: string }[];
  nombreEmpresa: string;
};

type ResultadoImport = {
  error?: string; ok?: string; errores?: string[];
  vista?: { codigo: string; nombre: string; tipo: string; imputable: boolean }[]; total?: number;
};

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function PlanDeCuentas({ cuentas, conMovimientos, puedeEditar, otrasEmpresas, nombreEmpresa }: Props) {
  const router = useRouter();
  const [filtro, setFiltro] = useState("");
  const [soloImputables, setSoloImputables] = useState(false);
  const [panel, setPanel] = useState<null | "nueva" | "copiar" | "importar">(cuentas.length === 0 ? "copiar" : null);
  const [editando, setEditando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ ok?: string; error?: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [estadoNueva, accionNueva, creando] = useActionState(crearCuenta, undefined);
  const [importacion, setImportacion] = useState<ResultadoImport | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const usadas = useMemo(() => new Set(conMovimientos), [conMovimientos]);

  const visibles = useMemo(() => {
    const q = sinTildes(filtro.trim());
    return cuentas.filter(
      (c) => (!soloImputables || c.imputable) && (!q || sinTildes(`${c.codigo} ${c.nombre}`).includes(q)),
    );
  }, [cuentas, filtro, soloImputables]);

  function ejecutar(promesa: Promise<{ ok?: string; error?: string }>) {
    iniciar(async () => {
      setMensaje(await promesa);
      router.refresh();
    });
  }

  async function revisarArchivo(confirmar: boolean) {
    if (!archivo) return;
    const fd = new FormData();
    fd.set("archivo", archivo);
    if (confirmar) fd.set("confirmar", "1");
    iniciar(async () => {
      const r = (await importarPlanExcel(fd)) as ResultadoImport;
      setImportacion(r);
      if (r.ok) {
        setMensaje({ ok: r.ok });
        setPanel(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por código o nombre…"
          aria-label="Buscar cuenta"
          className="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-azul focus:outline-none"
        />
        <label className="flex items-center gap-1.5 text-sm text-texto-suave">
          <input type="checkbox" checked={soloImputables} onChange={(e) => setSoloImputables(e.target.checked)} className="accent-azul" />
          Solo imputables
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          {puedeEditar && (
            <>
              <button type="button" className={claseBotonPrimario} onClick={() => setPanel(panel === "nueva" ? null : "nueva")}>Nueva cuenta</button>
              <button type="button" className={claseBotonSecundario} onClick={() => setPanel(panel === "copiar" ? null : "copiar")}>Copiar plan</button>
              <button type="button" className={claseBotonSecundario} onClick={() => { setPanel(panel === "importar" ? null : "importar"); setImportacion(null); }}>Importar Excel</button>
            </>
          )}
          <button
            type="button"
            className={claseBotonSecundario}
            onClick={() =>
              descargarExcel(
                `plan-de-cuentas-${sinTildes(nombreEmpresa).replace(/[^a-z0-9]+/g, "-")}`,
                `Plan de cuentas · ${nombreEmpresa}`,
                [{ titulo: "Código", ancho: 14 }, { titulo: "Nombre", ancho: 44 }, { titulo: "Tipo", ancho: 22 }, { titulo: "Imputable", ancho: 10 }, { titulo: "Activa", ancho: 10 }],
                visibles.map((c) => [c.codigo, c.nombre, NOMBRE_TIPO[c.tipo], c.imputable ? "Sí" : "No", c.activa ? "Sí" : "No"]),
              )
            }
          >
            Exportar a Excel
          </button>
        </div>
      </div>

      {mensaje?.ok && <p className={claseExito}>{mensaje.ok}</p>}
      {mensaje?.error && <p className={claseError}>{mensaje.error}</p>}

      {panel === "nueva" && (
        <form action={accionNueva} className="grid grid-cols-[140px_1fr_200px_auto_auto] items-end gap-3 rounded-lg border border-borde bg-white p-4">
          <div>
            <label htmlFor="n-codigo" className={claseEtiqueta}>Código</label>
            <input id="n-codigo" name="codigo" className={`${claseInput} numeros`} placeholder="1.1.01.005" autoFocus />
          </div>
          <div>
            <label htmlFor="n-nombre" className={claseEtiqueta}>Nombre</label>
            <input id="n-nombre" name="nombre" className={claseInput} />
          </div>
          <div>
            <label htmlFor="n-tipo" className={claseEtiqueta}>Tipo</label>
            <select id="n-tipo" name="tipo" className={claseInput}>
              {(Object.keys(NOMBRE_TIPO) as TipoCuenta[]).map((t) => <option key={t} value={t}>{NOMBRE_TIPO[t]}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-sm">
            <input type="checkbox" name="imputable" defaultChecked className="accent-azul" /> Imputable
          </label>
          <button type="submit" disabled={creando} className={claseBotonPrimario}>Crear</button>
          {estadoNueva?.error && <p className={`${claseError} col-span-5`}>{estadoNueva.error}</p>}
          {estadoNueva?.ok && <p className={`${claseExito} col-span-5`}>{estadoNueva.ok}</p>}
        </form>
      )}

      {panel === "copiar" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-borde bg-white p-4 text-sm">
          <span className="text-texto-suave">
            {cuentas.length === 0 ? "Esta empresa no tiene plan de cuentas. " : ""}Agrega las cuentas que falten (no modifica las existentes):
          </span>
          <button type="button" disabled={pendiente} className={claseBotonPrimario} onClick={() => ejecutar(copiarPlan(null))}>
            Plantilla base para pymes
          </button>
          {otrasEmpresas.length > 0 && (
            <select
              className={`${claseInput} w-72`}
              defaultValue=""
              onChange={(e) => e.target.value && confirm(`¿Copiar el plan de ${e.target.selectedOptions[0].text}?`) && ejecutar(copiarPlan(e.target.value))}
              aria-label="Copiar desde otra empresa"
            >
              <option value="">Copiar desde otra empresa…</option>
              {otrasEmpresas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          )}
        </div>
      )}

      {panel === "importar" && (
        <div className="space-y-3 rounded-lg border border-borde bg-white p-4 text-sm">
          <p className="text-texto-suave">
            Primera hoja con columnas <strong>Código</strong>, <strong>Nombre</strong>, <strong>Tipo</strong> (opcional: activo, pasivo,
            patrimonio, pérdida, ganancia; si falta se deduce del primer dígito) e <strong>Imputable</strong> (opcional: Sí/No).
            Primero verás una vista previa.
          </p>
          <div className="flex items-center gap-3">
            <input type="file" accept=".xlsx" onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setImportacion(null); }} className="text-sm" />
            <button type="button" disabled={!archivo || pendiente} className={claseBotonSecundario} onClick={() => revisarArchivo(false)}>Revisar archivo</button>
            {importacion?.vista && (importacion.errores ?? []).length === 0 && (
              <button type="button" disabled={pendiente} className={claseBotonPrimario} onClick={() => revisarArchivo(true)}>
                Importar {importacion.total} cuentas
              </button>
            )}
          </div>
          {importacion?.error && <p className={claseError}>{importacion.error}</p>}
          {(importacion?.errores ?? []).length > 0 && (
            <ul className={`${claseError} list-disc pl-6`}>{importacion!.errores!.slice(0, 20).map((e) => <li key={e}>{e}</li>)}</ul>
          )}
          {importacion?.vista && (
            <div className="max-h-60 overflow-auto rounded border border-borde">
              <table className="w-full text-xs">
                <thead className="bg-fondo-suave"><tr><th className="px-2 py-1 text-left">Código</th><th className="px-2 py-1 text-left">Nombre</th><th className="px-2 py-1 text-left">Tipo</th><th className="px-2 py-1">Imputable</th></tr></thead>
                <tbody>
                  {importacion.vista.map((f) => (
                    <tr key={f.codigo} className="border-t border-gray-100"><td className="numeros px-2 py-1">{f.codigo}</td><td className="px-2 py-1">{f.nombre}</td><td className="px-2 py-1">{NOMBRE_TIPO[f.tipo as TipoCuenta]}</td><td className="px-2 py-1 text-center">{f.imputable ? "Sí" : "No"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="overflow-auto rounded-lg border border-borde bg-white" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-fondo-suave text-xs text-texto-suave">
            <tr>
              <th scope="col" className="w-36 px-3 py-2 text-left font-semibold">Código</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Nombre</th>
              <th scope="col" className="w-48 px-3 py-2 text-left font-semibold">Tipo</th>
              <th scope="col" className="w-28 px-3 py-2 text-left font-semibold">Estado</th>
              {puedeEditar && <th scope="col" className="w-40 px-3 py-2"><span className="sr-only">Acciones</span></th>}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-texto-suave">{cuentas.length === 0 ? "Sin plan de cuentas. Usa “Copiar plan” para partir con la plantilla base." : "Ninguna cuenta coincide con la búsqueda."}</td></tr>
            )}
            {visibles.map((c) => (
              <tr key={c.id} className={`border-t border-gray-100 hover:bg-celeste/40 ${c.imputable ? "" : "bg-fondo-suave/70 font-semibold"} ${c.activa ? "" : "text-gray-400"}`}>
                <td className="numeros px-3 py-1.5">{c.codigo}</td>
                <td className="px-3 py-1.5" style={{ paddingLeft: `${12 + (c.codigo.split(".").length - 1) * 16}px` }}>
                  {editando === c.id ? (
                    <input
                      autoFocus
                      defaultValue={c.nombre}
                      className="w-full rounded border border-azul px-2 py-0.5 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditando(null);
                        if (e.key === "Enter") {
                          const nombre = (e.target as HTMLInputElement).value;
                          setEditando(null);
                          if (nombre !== c.nombre) ejecutar(editarCuenta(c.id, { nombre }));
                        }
                      }}
                      onBlur={() => setEditando(null)}
                      aria-label={`Nuevo nombre para ${c.codigo}`}
                    />
                  ) : (
                    c.nombre
                  )}
                </td>
                <td className="px-3 py-1.5 text-texto-suave">{NOMBRE_TIPO[c.tipo]}</td>
                <td className="px-3 py-1.5">
                  {!c.activa ? <Etiqueta tono="gris">Inactiva</Etiqueta> : c.imputable ? <Etiqueta tono="verde">Imputable</Etiqueta> : <Etiqueta tono="azul">Grupo</Etiqueta>}
                </td>
                {puedeEditar && (
                  <td className="px-3 py-1.5 text-right text-xs whitespace-nowrap">
                    <button type="button" className="text-azul hover:underline" onClick={() => setEditando(c.id)}>Renombrar</button>
                    <button
                      type="button"
                      className="ml-3 text-texto-suave hover:underline"
                      onClick={() => {
                        if (c.activa && usadas.has(c.id) && !confirm("Esta cuenta tiene movimientos. Si la desactivas no se podrá usar en comprobantes nuevos, pero sus movimientos se mantienen. ¿Continuar?")) return;
                        ejecutar(editarCuenta(c.id, { activa: !c.activa }));
                      }}
                    >
                      {c.activa ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-texto-suave">Las cuentas no se borran: se desactivan, para no perder la historia contable.</p>
    </div>
  );
}
