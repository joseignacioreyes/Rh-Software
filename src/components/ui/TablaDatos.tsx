"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";
import { descargarExcel } from "@/lib/excel";

export type Fila = Record<string, string | number | boolean | null>;

export type Columna = {
  clave: string;
  titulo: string;
  tipo?: "texto" | "monto" | "fecha" | "rut" | "numero";
  /** Suma la columna en la fila de totales. */
  total?: boolean;
  /** Clave de la fila que tiene el link (la celda se vuelve link). */
  enlace?: string;
  ancho?: string;
  /** Para montos: muestra vacío en lugar de $0. */
  ocultarCero?: boolean;
};

function formatear(valor: Fila[string], tipo: Columna["tipo"], ocultarCero?: boolean): string {
  if (valor === null || valor === undefined || valor === "") return "";
  switch (tipo) {
    case "monto":
      return ocultarCero && Number(valor) === 0 ? "" : formatoPesos(Number(valor));
    case "fecha":
      return formatoFecha(new Date(`${valor}T12:00:00-04:00`));
    case "rut":
      return formatearRut(String(valor));
    case "numero":
      return Number(valor).toLocaleString("es-CL");
    default:
      return String(valor);
  }
}

const esNumerica = (t?: Columna["tipo"]) => t === "monto" || t === "numero";

/**
 * Tabla densa y clara: orden por columna, filtro, totales siempre visibles y exportación a Excel.
 * Los montos van a la derecha con separador de miles.
 */
export function TablaDatos({
  columnas,
  filas,
  nombreArchivo,
  tituloExcel,
  vacio = "No hay datos para mostrar.",
  filtro = true,
  filaResaltada,
  alturaMaxima = "calc(100vh - 240px)",
}: {
  columnas: Columna[];
  filas: Fila[];
  nombreArchivo: string;
  tituloExcel?: string;
  vacio?: string;
  filtro?: boolean;
  /** Clave booleana de la fila que la resalta (por ejemplo, cuentas de grupo). */
  filaResaltada?: string;
  alturaMaxima?: string;
}) {
  const [orden, setOrden] = useState<SortingState>([]);
  const [busqueda, setBusqueda] = useState("");

  const defs = useMemo<ColumnDef<Fila>[]>(
    () =>
      columnas.map((c) => ({
        id: c.clave,
        accessorFn: (f) => f[c.clave],
        header: c.titulo,
        sortingFn: esNumerica(c.tipo) ? "basic" : "alphanumeric",
        filterFn: "includesString",
      })),
    [columnas],
  );

  const tabla = useReactTable({
    data: filas,
    columns: defs,
    state: { sorting: orden, globalFilter: busqueda },
    onSortingChange: setOrden,
    onGlobalFilterChange: setBusqueda,
    globalFilterFn: (fila, _id, valor) => {
      const q = String(valor).toLowerCase();
      return columnas.some((c) => formatear(fila.original[c.clave], c.tipo).toLowerCase().includes(q) ||
        String(fila.original[c.clave] ?? "").toLowerCase().includes(q));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const visibles = tabla.getRowModel().rows.map((r) => r.original);
  const hayTotales = columnas.some((c) => c.total);
  const totales = columnas.map((c) =>
    c.total ? visibles.reduce((s, f) => s + (Number(f[c.clave]) || 0), 0) : null,
  );

  async function exportar() {
    await descargarExcel(
      nombreArchivo,
      tituloExcel ?? nombreArchivo,
      columnas.map((c) => ({ titulo: c.titulo, tipo: c.tipo === "monto" ? "monto" : c.tipo === "fecha" ? "fecha" : c.tipo === "numero" ? "numero" : "texto" })),
      visibles.map((f) =>
        columnas.map((c) => {
          const v = f[c.clave];
          if (v === null || v === undefined) return null;
          if (esNumerica(c.tipo)) return Number(v);
          return formatear(v, c.tipo);
        }),
      ),
      hayTotales ? columnas.map((c, i) => (i === 0 ? "Totales" : totales[i])) : undefined,
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-borde bg-white">
      <div className="flex items-center gap-3 border-b border-borde px-3 py-2">
        {filtro && (
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar…"
            aria-label="Filtrar la tabla"
            className="w-64 rounded-md border border-gray-300 px-2.5 py-1 text-sm focus:border-azul focus:outline-none"
          />
        )}
        <span className="text-xs text-texto-suave">
          {visibles.length.toLocaleString("es-CL")} {visibles.length === 1 ? "fila" : "filas"}
          {busqueda && ` de ${filas.length.toLocaleString("es-CL")}`}
        </span>
        <button
          type="button"
          onClick={exportar}
          className="ml-auto rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-texto hover:bg-fondo-suave"
        >
          Exportar a Excel
        </button>
      </div>
      <div className="overflow-auto" style={{ maxHeight: alturaMaxima }}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-fondo-suave">
            {tabla.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h, i) => {
                  const c = columnas[i];
                  const dir = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      style={{ width: c.ancho }}
                      className={`border-b border-borde px-3 py-2 text-xs font-semibold whitespace-nowrap text-texto-suave ${esNumerica(c.tipo) ? "text-right" : "text-left"}`}
                      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                    >
                      <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 hover:text-azul">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <span aria-hidden="true" className="text-[10px]">{dir === "asc" ? "▲" : dir === "desc" ? "▼" : ""}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="px-3 py-10 text-center text-texto-suave">{busqueda ? "Ningún resultado para el filtro." : vacio}</td>
              </tr>
            )}
            {tabla.getRowModel().rows.map((r) => {
              const resaltada = filaResaltada && r.original[filaResaltada];
              return (
                <tr key={r.id} className={`border-b border-gray-100 hover:bg-celeste/50 ${resaltada ? "bg-fondo-suave font-semibold" : ""}`}>
                  {columnas.map((c) => {
                    const texto = formatear(r.original[c.clave], c.tipo, c.ocultarCero);
                    const href = c.enlace ? r.original[c.enlace] : null;
                    return (
                      <td key={c.clave} className={`px-3 py-1.5 ${esNumerica(c.tipo) ? "numeros text-right whitespace-nowrap" : ""} ${c.tipo === "fecha" || c.tipo === "rut" ? "numeros whitespace-nowrap" : ""}`}>
                        {href ? <Link href={String(href)} className="text-azul hover:underline">{texto}</Link> : texto}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {hayTotales && visibles.length > 0 && (
            <tfoot className="sticky bottom-0 bg-white shadow-[0_-1px_0_#e5e7eb]">
              <tr className="font-semibold">
                {columnas.map((c, i) => (
                  <td key={c.clave} className={`px-3 py-2 ${esNumerica(c.tipo) ? "numeros text-right whitespace-nowrap" : ""}`}>
                    {i === 0 ? "Totales" : c.total ? formatoPesos(totales[i] as number) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
