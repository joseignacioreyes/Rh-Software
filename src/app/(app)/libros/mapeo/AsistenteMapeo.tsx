"use client";

import { useState, useTransition } from "react";
import { analizarArchivo, importarConMapeo, type Analisis, type ResultadoMapeo } from "./acciones";
import { formatoPesos } from "@/lib/formato";
import { claseBotonPrimario, claseBotonSecundario, claseError, claseExito, claseInput } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Encabezado";

type Campo = { campo: string; nombre: string; obligatorio: boolean };
type Props = { campos: Record<"libro_compras" | "libro_ventas", Campo[]>; anio: number; mes: number; ia: boolean };

const FUENTE = { guardado: "Mapeo guardado reconocido", ia: "Sugerido con IA", nombres: "Sugerido por el nombre de las columnas" };

export function AsistenteMapeo({ campos, anio, mes, ia }: Props) {
  const [tipo, setTipo] = useState<"libro_compras" | "libro_ventas">("libro_compras");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, number | null>>({});
  const [periodo, setPeriodo] = useState({ anio, mes });
  const [nombreMapeo, setNombreMapeo] = useState("");
  const [resultado, setResultado] = useState<ResultadoMapeo | null>(null);
  const [pendiente, iniciar] = useTransition();

  function analizar(f: File, t = tipo) {
    const fd = new FormData();
    fd.set("archivo", f);
    fd.set("tipo", t);
    setResultado(null);
    iniciar(async () => {
      const r = await analizarArchivo(fd);
      setAnalisis(r);
      setMapeo(r.mapeo ?? {});
      if (r.nombreGuardado) setNombreMapeo(r.nombreGuardado);
    });
  }

  function validar(confirmar: boolean) {
    if (!archivo) return;
    const fd = new FormData();
    fd.set("archivo", archivo);
    fd.set("tipo", tipo);
    fd.set("mapeo", JSON.stringify(mapeo));
    fd.set("anio", String(periodo.anio));
    fd.set("mes", String(periodo.mes));
    fd.set("nombreMapeo", nombreMapeo);
    if (confirmar) fd.set("confirmar", "1");
    iniciar(async () => setResultado(await importarConMapeo(fd)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-borde bg-white p-4">
        <label className="text-sm">Libro
          <select value={tipo} onChange={(e) => { const t = e.target.value as typeof tipo; setTipo(t); if (archivo) analizar(archivo, t); }} className={`${claseInput} w-48`}>
            <option value="libro_compras">Libro de compras</option>
            <option value="libro_ventas">Libro de ventas</option>
          </select>
        </label>
        <label className="text-sm">Periodo
          <input type="month" value={`${periodo.anio}-${String(periodo.mes).padStart(2, "0")}`} onChange={(e) => { const [a, m] = e.target.value.split("-").map(Number); if (a && m) setPeriodo({ anio: a, mes: m }); }} className={`${claseInput} w-44`} />
        </label>
        <label className="text-sm">Archivo (.xlsx o .csv)
          <input type="file" accept=".xlsx,.csv,.txt" className="block text-sm" onChange={(e) => { const f = e.target.files?.[0] ?? null; setArchivo(f); if (f) analizar(f); }} />
        </label>
        {!ia && <span className="text-xs text-texto-suave">Las sugerencias con IA se activan al configurar la clave de la API de Claude.</span>}
      </div>

      {pendiente && <p className="text-sm text-texto-suave">Procesando…</p>}
      {analisis?.error && <p className={claseError}>{analisis.error}</p>}

      {analisis?.encabezados && (
        <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <div className="rounded-lg border border-borde bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-azul">1. ¿Qué columna es cada dato?</h2>
              {analisis.fuente && <Etiqueta tono={analisis.fuente === "nombres" ? "gris" : "verde"}>{FUENTE[analisis.fuente]}</Etiqueta>}
            </div>
            <div className="space-y-2">
              {campos[tipo].map((c) => (
                <label key={c.campo} className="grid grid-cols-[150px_1fr] items-center gap-2 text-sm">
                  <span>{c.nombre}{c.obligatorio && <span className="text-rojo"> *</span>}</span>
                  <select
                    value={mapeo[c.campo] ?? ""}
                    onChange={(e) => setMapeo({ ...mapeo, [c.campo]: e.target.value === "" ? null : Number(e.target.value) })}
                    className={`${claseInput} py-1 ${c.obligatorio && (mapeo[c.campo] ?? null) === null ? "border-rojo" : ""}`}
                  >
                    <option value="">— No está en el archivo —</option>
                    {analisis.encabezados!.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <label className="mt-4 block text-sm">Guardar este mapeo como (opcional)
              <input value={nombreMapeo} onChange={(e) => setNombreMapeo(e.target.value)} placeholder="Ej.: Libro compras de software X" className={claseInput} />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={pendiente} className={claseBotonSecundario} onClick={() => validar(false)}>2. Validar</button>
              <button type="button" disabled={pendiente || !resultado?.vista || (resultado.errores ?? []).length > 0} className={claseBotonPrimario} onClick={() => validar(true)}>
                3. Importar {resultado?.documentos ?? ""}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="overflow-auto rounded-lg border border-borde bg-white">
              <p className="border-b border-borde px-3 py-2 text-xs font-semibold text-texto-suave">Primeras filas del archivo ({analisis.filas} filas)</p>
              <table className="w-full text-xs">
                <thead className="bg-fondo-suave">
                  <tr>{analisis.encabezados.map((h, i) => {
                    const campo = Object.entries(mapeo).find(([, v]) => v === i)?.[0];
                    return <th key={i} className={`px-2 py-1.5 text-left whitespace-nowrap ${campo ? "bg-celeste text-azul" : ""}`}>{h}{campo && <div className="font-normal">→ {campos[tipo].find((c) => c.campo === campo)?.nombre}</div>}</th>;
                  })}</tr>
                </thead>
                <tbody>
                  {analisis.ejemplos!.map((f, k) => (
                    <tr key={k} className="border-t border-gray-100">{f.map((c, i) => <td key={i} className="px-2 py-1 whitespace-nowrap">{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            {resultado?.error && <p className={claseError}>{resultado.error}</p>}
            {resultado?.ok && <p className={claseExito}>{resultado.ok}</p>}
            {resultado?.vista && (
              <div className="rounded-lg border border-borde bg-white">
                <p className="border-b border-borde px-3 py-2 text-sm">
                  <strong>{resultado.documentos}</strong> documentos válidos · total {formatoPesos(resultado.total ?? 0)}
                  {(resultado.errores ?? []).length > 0 && <span className="text-rojo"> · {resultado.errores!.length} filas con error (corrígelas en el archivo o ajusta el mapeo)</span>}
                </p>
                {(resultado.errores ?? []).length > 0 && (
                  <ul className="list-disc px-8 py-2 text-xs text-rojo">{resultado.errores!.slice(0, 10).map((e) => <li key={e.fila}>Fila {e.fila}: {e.mensaje}</li>)}</ul>
                )}
                <table className="w-full text-xs">
                  <thead className="bg-fondo-suave"><tr><th className="px-2 py-1 text-left">Tipo</th><th className="px-2 py-1 text-left">Folio</th><th className="px-2 py-1 text-left">Fecha</th><th className="px-2 py-1 text-left">RUT</th><th className="px-2 py-1 text-left">Razón social</th><th className="px-2 py-1 text-right">Neto</th><th className="px-2 py-1 text-right">IVA</th><th className="px-2 py-1 text-right">Total</th></tr></thead>
                  <tbody>{resultado.vista.map((d, i) => (
                    <tr key={i} className="border-t border-gray-100"><td className="px-2 py-1">{d.tipo_doc}</td><td className="px-2 py-1">{d.folio}</td><td className="numeros px-2 py-1">{d.fecha}</td><td className="numeros px-2 py-1">{d.rut}</td><td className="px-2 py-1">{d.razon}</td><td className="numeros px-2 py-1 text-right">{formatoPesos(d.neto)}</td><td className="numeros px-2 py-1 text-right">{formatoPesos(d.iva)}</td><td className="numeros px-2 py-1 text-right">{formatoPesos(d.total)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
