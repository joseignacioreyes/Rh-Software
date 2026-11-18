// Asistente de mapeo de columnas para libros de otros softwares, Excel propios y cartolas bancarias.
import { leerEntero, leerFecha, normalizarEncabezado, huella } from "./csv";
import { normalizarRut } from "@/lib/rut";
import type { DocumentoRcv, LibroRcv } from "./rcv";

export type TipoMapeo = "libro_compras" | "libro_ventas" | "cartola";

export const CAMPOS: Record<TipoMapeo, { campo: string; nombre: string; obligatorio: boolean; sinonimos: string[] }[]> = {
  libro_compras: [
    { campo: "tipo_doc", nombre: "Tipo de documento", obligatorio: true, sinonimos: ["tipo doc", "tipo documento", "tipo", "td", "cod doc"] },
    { campo: "folio", nombre: "Folio", obligatorio: true, sinonimos: ["folio", "numero", "n documento", "numero documento", "nro", "num doc"] },
    { campo: "fecha", nombre: "Fecha", obligatorio: true, sinonimos: ["fecha", "fecha documento", "fecha emision", "fec doc"] },
    { campo: "rut", nombre: "RUT proveedor", obligatorio: true, sinonimos: ["rut", "rut proveedor", "rut emisor", "rut contraparte"] },
    { campo: "razon_social", nombre: "Razón social", obligatorio: false, sinonimos: ["razon social", "proveedor", "nombre"] },
    { campo: "exento", nombre: "Exento", obligatorio: false, sinonimos: ["exento", "monto exento"] },
    { campo: "neto", nombre: "Neto", obligatorio: false, sinonimos: ["neto", "afecto", "monto neto"] },
    { campo: "iva", nombre: "IVA", obligatorio: false, sinonimos: ["iva", "monto iva", "iva credito", "iva recuperable"] },
    { campo: "otros", nombre: "Otros impuestos", obligatorio: false, sinonimos: ["otros impuestos", "otros imp", "impuesto especifico", "ila"] },
    { campo: "total", nombre: "Total", obligatorio: true, sinonimos: ["total", "monto total", "total documento"] },
  ],
  libro_ventas: [],
  cartola: [
    { campo: "fecha", nombre: "Fecha", obligatorio: true, sinonimos: ["fecha", "fecha movimiento", "fecha contable", "fecha operacion"] },
    { campo: "descripcion", nombre: "Descripción", obligatorio: true, sinonimos: ["descripcion", "glosa", "detalle", "concepto", "movimiento", "descripcion movimiento"] },
    { campo: "documento", nombre: "N° documento", obligatorio: false, sinonimos: ["documento", "n documento", "numero documento", "nro documento", "serial", "operacion"] },
    { campo: "cargo", nombre: "Cargo (sale)", obligatorio: false, sinonimos: ["cargo", "cargos", "giros", "debito", "debe", "monto cargo"] },
    { campo: "abono", nombre: "Abono (entra)", obligatorio: false, sinonimos: ["abono", "abonos", "depositos", "credito", "haber", "monto abono"] },
    { campo: "monto", nombre: "Monto (+/−)", obligatorio: false, sinonimos: ["monto", "importe", "valor"] },
    { campo: "saldo", nombre: "Saldo", obligatorio: false, sinonimos: ["saldo", "saldo contable", "saldo disponible"] },
  ],
};
CAMPOS.libro_ventas = CAMPOS.libro_compras.map((c) =>
  c.campo === "rut" ? { ...c, nombre: "RUT cliente", sinonimos: ["rut", "rut cliente", "rut receptor", "rut contraparte"] }
    : c.campo === "razon_social" ? { ...c, sinonimos: ["razon social", "cliente", "nombre"] }
    : c.campo === "iva" ? { ...c, sinonimos: ["iva", "monto iva", "iva debito"] } : c,
);

export type Mapeo = Record<string, number | null>;

/** Firma de los encabezados (para reconocer el mismo formato la próxima vez). */
export function firmaEncabezados(encabezados: string[]) {
  return huella(encabezados.map(normalizarEncabezado).join("|"));
}

/** Sugiere qué columna corresponde a cada campo, por el nombre del encabezado. */
export function sugerirMapeo(tipo: TipoMapeo, encabezados: string[]): Mapeo {
  const norm = encabezados.map(normalizarEncabezado);
  const usadas = new Set<number>();
  const mapeo: Mapeo = {};
  for (const c of CAMPOS[tipo]) {
    let idx = -1;
    for (const s of c.sinonimos) {
      idx = norm.findIndex((h, i) => !usadas.has(i) && h === s);
      if (idx >= 0) break;
    }
    if (idx < 0) {
      for (const s of c.sinonimos) {
        idx = norm.findIndex((h, i) => !usadas.has(i) && (h.includes(s) || (s.length > 3 && s.includes(h) && h.length > 2)));
        if (idx >= 0) break;
      }
    }
    mapeo[c.campo] = idx >= 0 ? idx : null;
    if (idx >= 0) usadas.add(idx);
  }
  return mapeo;
}

/** Convierte filas de un libro mapeado en documentos RCV. */
export function aplicarMapeoLibro(
  libro: LibroRcv,
  filas: (string | number | Date | null)[][],
  mapeo: Mapeo,
  periodo: { anio: number; mes: number },
) {
  const documentos: DocumentoRcv[] = [];
  const errores: { fila: number; mensaje: string }[] = [];
  const v = (f: (string | number | Date | null)[], c: string) => (mapeo[c] !== null && mapeo[c] !== undefined ? f[mapeo[c]!] : null);
  const txt = (x: unknown) => (x === null || x === undefined ? "" : String(x).trim());
  filas.forEach((f, k) => {
    const n = k + 2;
    const tipo = leerEntero(txt(v(f, "tipo_doc")));
    const rut = normalizarRut(txt(v(f, "rut")));
    const fecha = leerFecha(v(f, "fecha") as string);
    const folio = txt(v(f, "folio"));
    const total = leerEntero(v(f, "total") as string);
    if (!tipo && !rut && !folio) return; // fila vacía
    if (!tipo) return errores.push({ fila: n, mensaje: "Tipo de documento no válido." });
    if (!rut) return errores.push({ fila: n, mensaje: `RUT no válido: "${txt(v(f, "rut"))}".` });
    if (!fecha) return errores.push({ fila: n, mensaje: "Fecha no válida." });
    if (!folio) return errores.push({ fila: n, mensaje: "Sin folio." });
    if (total === null) return errores.push({ fila: n, mensaje: "Total no válido." });
    const num = (c: string) => leerEntero(v(f, c) as string) ?? 0;
    documentos.push({
      libro, anio: periodo.anio, mes: periodo.mes, tipo_doc: tipo, tipo_operacion: null, folio,
      rut_contraparte: rut, razon_social: txt(v(f, "razon_social")) || null, fecha_docto: fecha, fecha_recepcion: null,
      monto_exento: num("exento"), monto_neto: num("neto"), monto_iva: num("iva"), monto_iva_no_recuperable: 0,
      codigo_iva_no_recuperable: null, iva_uso_comun: 0, monto_neto_activo_fijo: 0, iva_activo_fijo: 0,
      otros_impuestos: num("otros"), monto_total: total, datos_originales: {},
    });
  });
  return { documentos, errores };
}

export type MovimientoLeido = { fecha: string; descripcion: string; documento: string | null; monto: number; saldo: number | null; huella: string };

/** Convierte filas de una cartola mapeada en movimientos (abono positivo, cargo negativo). */
export function aplicarMapeoCartola(filas: (string | number | Date | null)[][], mapeo: Mapeo) {
  const movimientos: MovimientoLeido[] = [];
  const errores: { fila: number; mensaje: string }[] = [];
  const v = (f: (string | number | Date | null)[], c: string) => (mapeo[c] !== null && mapeo[c] !== undefined ? f[mapeo[c]!] : null);
  const repetidos = new Map<string, number>();
  filas.forEach((f, k) => {
    const n = k + 2;
    const fecha = leerFecha(v(f, "fecha") as string);
    const descripcion = String(v(f, "descripcion") ?? "").trim();
    if (!fecha && !descripcion) return;
    if (!fecha) return errores.push({ fila: n, mensaje: "Fecha no válida." });
    let monto: number | null = null;
    if (mapeo.monto !== null && mapeo.monto !== undefined) monto = leerEntero(v(f, "monto") as string);
    else {
      const cargo = Math.abs(leerEntero(v(f, "cargo") as string) ?? 0);
      const abono = Math.abs(leerEntero(v(f, "abono") as string) ?? 0);
      monto = abono - cargo;
    }
    if (!monto) return; // filas de saldo o sin movimiento
    const documento = String(v(f, "documento") ?? "").trim() || null;
    const saldo = leerEntero(v(f, "saldo") as string);
    // Huella: fecha + monto + descripción + documento (+ número de repetición el mismo día).
    const base = `${fecha}|${monto}|${descripcion}|${documento ?? ""}`;
    const rep = (repetidos.get(base) ?? 0) + 1;
    repetidos.set(base, rep);
    movimientos.push({ fecha, descripcion: descripcion || "(sin descripción)", documento, monto, saldo, huella: huella(`${base}|${rep}`) });
  });
  return { movimientos, errores };
}
