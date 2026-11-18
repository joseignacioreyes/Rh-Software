"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { procesarArchivos, type ResultadoArchivo } from "./acciones";
import { formatoPesos } from "@/lib/formato";
import { claseBotonPrimario, claseBotonSecundario, claseExito } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Encabezado";

const TIPO: Record<ResultadoArchivo["tipo"], string> = {
  rcv_compras: "Compras (RCV)", rcv_ventas: "Ventas (RCV)", honorarios_recibidos: "Honorarios recibidos",
  honorarios_emitidos: "Honorarios emitidos", desconocido: "No reconocido",
};

/** Zona para arrastrar varios archivos de varias empresas. Primero muestra una vista previa; luego importa. */
export function ZonaImportacion({ empresaActual }: { empresaActual: string | null }) {
  const router = useRouter();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [resultados, setResultados] = useState<ResultadoArchivo[] | null>(null);
  const [encima, setEncima] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [listo, setListo] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  function agregar(lista: FileList | null) {
    if (!lista) return;
    const nuevos = [...archivos, ...Array.from(lista)].filter((f, i, a) => a.findIndex((x) => x.name === f.name && x.size === f.size) === i);
    setArchivos(nuevos);
    setListo(null);
    analizar(nuevos, false);
  }

  function analizar(lista: File[], confirmar: boolean) {
    const fd = new FormData();
    lista.forEach((f) => fd.append("archivos", f));
    if (confirmar) fd.set("confirmar", "1");
    iniciar(async () => {
      const r = await procesarArchivos(fd);
      setResultados(r);
      if (confirmar) {
        const hechos = r.filter((x) => x.importado && x.nuevos > 0);
        const n = hechos.reduce((s, x) => s + x.nuevos, 0);
        setListo(`Importación lista: ${n} documentos nuevos en ${hechos.length} archivos.`);
        setArchivos([]);
        router.refresh();
      }
    });
  }

  const importables = (resultados ?? []).filter((r) => !r.problema && r.nuevos > 0);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => { e.preventDefault(); setEncima(false); agregar(e.dataTransfer.files); }}
        onClick={() => entrada.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && entrada.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          encima ? "border-azul bg-celeste" : "border-gray-300 bg-white hover:border-azul hover:bg-celeste/40"
        }`}
      >
        <svg viewBox="0 0 24 24" className="mb-2 h-10 w-10 text-azul" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-semibold text-texto">Arrastra aquí los archivos del SII o haz clic para elegirlos</p>
        <p className="mt-1 text-sm text-texto-suave">
          RCV_COMPRA_REGISTRO_…csv, RCV_VENTA_…csv, informes de boletas de honorarios. Puedes mezclar empresas y meses.
          {empresaActual && ` Los archivos sin RUT en el nombre van a ${empresaActual}.`}
        </p>
        <input ref={entrada} type="file" multiple accept=".csv,.txt" className="hidden" onChange={(e) => agregar(e.target.files)} />
      </div>

      {listo && <p className={claseExito} role="status">{listo}</p>}
      {pendiente && <p className="text-sm text-texto-suave" role="status">Revisando archivos…</p>}

      {resultados && resultados.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-borde bg-white">
          <table className="w-full text-sm">
            <thead className="bg-fondo-suave text-xs text-texto-suave">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Archivo</th>
                <th className="px-3 py-2 text-left font-semibold">Empresa</th>
                <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                <th className="px-3 py-2 text-left font-semibold">Periodo</th>
                <th className="px-3 py-2 text-right font-semibold">Documentos</th>
                <th className="px-3 py-2 text-right font-semibold">Nuevos</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-left font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={r.archivo} className="border-t border-gray-100 align-top">
                  <td className="max-w-64 truncate px-3 py-2 font-mono text-xs" title={r.archivo}>{r.archivo}</td>
                  <td className="px-3 py-2">{r.empresa?.nombre ?? "—"}</td>
                  <td className="px-3 py-2">{TIPO[r.tipo]}</td>
                  <td className="numeros px-3 py-2">{r.periodo ?? "—"}</td>
                  <td className="numeros px-3 py-2 text-right">{r.documentos}</td>
                  <td className="numeros px-3 py-2 text-right">{r.nuevos}{r.duplicados > 0 && <span className="text-xs text-texto-suave"> ({r.duplicados} ya estaban)</span>}</td>
                  <td className="numeros px-3 py-2 text-right">{r.total ? formatoPesos(r.total) : ""}</td>
                  <td className="px-3 py-2">
                    {r.problema ? <Etiqueta tono="rojo">{r.problema}</Etiqueta>
                      : r.importado ? <Etiqueta tono="verde">Importado</Etiqueta>
                      : r.nuevos === 0 ? <Etiqueta tono="gris">Nada nuevo</Etiqueta>
                      : r.errores.length ? <Etiqueta tono="ambar">{r.errores.length} filas con error</Etiqueta>
                      : <Etiqueta tono="verde">Listo para importar</Etiqueta>}
                    {r.errores.length > 0 && (
                      <details className="mt-1 text-xs text-rojo">
                        <summary className="cursor-pointer">Ver errores</summary>
                        <ul className="mt-1 list-disc pl-4">{r.errores.slice(0, 15).map((e) => <li key={e.fila + e.mensaje}>Fila {e.fila}: {e.mensaje}</li>)}</ul>
                      </details>
                    )}
                    {r.avisos.length > 0 && (
                      <details className="mt-1 text-xs text-ambar">
                        <summary className="cursor-pointer">{r.avisos.length} avisos</summary>
                        <ul className="mt-1 list-disc pl-4">{r.avisos.slice(0, 15).map((a) => <li key={a}>{a}</li>)}</ul>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3 border-t border-borde bg-fondo-suave px-3 py-2">
            <button type="button" disabled={pendiente || importables.length === 0 || archivos.length === 0} className={claseBotonPrimario} onClick={() => analizar(archivos, true)}>
              Importar {importables.reduce((s, r) => s + r.nuevos, 0)} documentos nuevos
            </button>
            <button type="button" className={claseBotonSecundario} onClick={() => { setArchivos([]); setResultados(null); }}>Limpiar</button>
            <span className="text-xs text-texto-suave">Los documentos que ya estaban (mismo tipo, folio y RUT) no se duplican.</span>
          </div>
        </div>
      )}
    </div>
  );
}
