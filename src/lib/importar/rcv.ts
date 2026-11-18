// Importación del Registro de Compras y Ventas (RCV) descargado desde sii.cl.
// Archivos "RCV_COMPRA_REGISTRO_<RUT>_<AAAAMM>.csv" y "RCV_VENTA_<RUT>_<AAAAMM>.csv",
// separados por punto y coma. Las columnas se reconocen por nombre (no por posición).
import { leerCsv, leerEntero, leerFecha, normalizarEncabezado } from "./csv";
import { normalizarRut } from "@/lib/rut";

export type LibroRcv = "compras" | "ventas";

export type DocumentoRcv = {
  libro: LibroRcv;
  anio: number;
  mes: number;
  tipo_doc: number;
  tipo_operacion: string | null;
  folio: string;
  rut_contraparte: string;
  razon_social: string | null;
  fecha_docto: string;
  fecha_recepcion: string | null;
  monto_exento: number;
  monto_neto: number;
  monto_iva: number;
  monto_iva_no_recuperable: number;
  codigo_iva_no_recuperable: string | null;
  iva_uso_comun: number;
  monto_neto_activo_fijo: number;
  iva_activo_fijo: number;
  otros_impuestos: number;
  monto_total: number;
  datos_originales: Record<string, string>;
};

export type ResultadoLectura = {
  libro: LibroRcv | null;
  rutEmpresa: string | null;
  anio: number | null;
  mes: number | null;
  documentos: DocumentoRcv[];
  errores: { fila: number; mensaje: string }[];
  avisos: string[];
};

/** Tipos de documento SII más usados. */
export const TIPOS_DOCUMENTO: Record<number, string> = {
  29: "Factura de inicio",
  30: "Factura",
  32: "Factura exenta",
  33: "Factura electrónica",
  34: "Factura exenta electrónica",
  35: "Boleta",
  38: "Boleta exenta",
  39: "Boleta electrónica",
  41: "Boleta exenta electrónica",
  43: "Liquidación factura electrónica",
  45: "Factura de compra",
  46: "Factura de compra electrónica",
  48: "Comprobante de pago electrónico",
  55: "Nota de débito",
  56: "Nota de débito electrónica",
  60: "Nota de crédito",
  61: "Nota de crédito electrónica",
  110: "Factura de exportación electrónica",
  111: "Nota de débito de exportación electrónica",
  112: "Nota de crédito de exportación electrónica",
  914: "Declaración de ingreso (DIN)",
};

/** Las notas de crédito restan en los libros y en el IVA. */
export const esNotaCredito = (tipo: number) => tipo === 60 || tipo === 61 || tipo === 106 || tipo === 112;

/** Lee RUT, libro y periodo desde el nombre del archivo del SII. */
export function datosDesdeNombre(nombre: string): { libro: LibroRcv | null; rut: string | null; anio: number | null; mes: number | null } {
  const n = nombre.toUpperCase();
  const libro: LibroRcv | null = n.includes("COMPRA") ? "compras" : n.includes("VENTA") ? "ventas" : null;
  const rutM = n.match(/(\d{7,8}-[\dK])/);
  const perM = n.match(/_(\d{4})(\d{2})(?:\D|$)/);
  const anio = perM ? Number(perM[1]) : null;
  const mes = perM ? Number(perM[2]) : null;
  return {
    libro,
    rut: rutM ? normalizarRut(rutM[1]) : null,
    anio: anio && mes && mes >= 1 && mes <= 12 ? anio : null,
    mes: anio && mes && mes >= 1 && mes <= 12 ? mes : null,
  };
}

// Sinónimos de columnas (encabezados normalizados).
const COLUMNAS: Record<string, string[]> = {
  tipo_doc: ["tipo doc", "tipo documento", "tipo dte", "tipo docto"],
  tipo_operacion: ["tipo compra", "tipo venta", "tipo transaccion"],
  rut: ["rut proveedor", "rut cliente", "rut contraparte", "rut emisor", "rut receptor", "rut"],
  razon_social: ["razon social", "nombre", "razon social proveedor", "razon social cliente"],
  folio: ["folio", "numero documento", "numero", "folio documento"],
  fecha_docto: ["fecha docto", "fecha documento", "fecha emision", "fecha"],
  fecha_recepcion: ["fecha recepcion"],
  monto_exento: ["monto exento", "exento"],
  monto_neto: ["monto neto", "neto", "afecto"],
  monto_iva: ["monto iva recuperable", "monto iva", "iva", "iva recuperable", "iva debito"],
  monto_iva_no_recuperable: ["monto iva no recuperable", "iva no recuperable"],
  codigo_iva_no_recuperable: ["codigo iva no rec", "cod iva no rec"],
  iva_uso_comun: ["iva uso comun"],
  monto_neto_activo_fijo: ["monto neto activo fijo"],
  iva_activo_fijo: ["iva activo fijo"],
  otros_impuestos: ["valor otro impuesto", "valor otro imp", "otros impuestos", "impto sin derecho a credito"],
  monto_total: ["monto total", "total"],
};

/** Ubica cada campo en los encabezados (coincidencia exacta primero, luego parcial). */
export function ubicarColumnas(encabezados: string[], sinonimos = COLUMNAS): Record<string, number> {
  const norm = encabezados.map(normalizarEncabezado);
  const pos: Record<string, number> = {};
  const usadas = new Set<number>();
  for (const [campo, lista] of Object.entries(sinonimos)) {
    let i = -1;
    for (const s of lista) {
      i = norm.findIndex((h, k) => !usadas.has(k) && h === s);
      if (i >= 0) break;
    }
    if (i < 0) {
      for (const s of lista) {
        i = norm.findIndex((h, k) => !usadas.has(k) && h.startsWith(s));
        if (i >= 0) break;
      }
    }
    if (i >= 0) {
      pos[campo] = i;
      usadas.add(i);
    }
  }
  return pos;
}

/** Lee el contenido de un CSV del RCV. `nombreArchivo` ayuda a detectar libro, RUT y periodo. */
export function leerRcv(texto: string, nombreArchivo: string, libroForzado?: LibroRcv): ResultadoLectura {
  const filas = leerCsv(texto);
  const errores: ResultadoLectura["errores"] = [];
  const avisos: string[] = [];
  const desdeNombre = datosDesdeNombre(nombreArchivo);
  if (filas.length === 0) {
    return { ...vacio(desdeNombre), errores: [{ fila: 0, mensaje: "El archivo está vacío." }] };
  }
  const encabezados = filas[0];
  const pos = ubicarColumnas(encabezados);
  const norm = encabezados.map(normalizarEncabezado);
  const libro: LibroRcv | null =
    libroForzado ?? desdeNombre.libro ??
    (norm.some((h) => h.includes("proveedor") || h.includes("tipo compra")) ? "compras"
      : norm.some((h) => h.includes("cliente") || h.includes("tipo venta")) ? "ventas" : null);

  const faltan = ["tipo_doc", "rut", "folio", "fecha_docto", "monto_total"].filter((c) => pos[c] === undefined);
  if (faltan.length) {
    return {
      ...vacio(desdeNombre),
      libro,
      errores: [{ fila: 1, mensaje: `No se reconocen las columnas: ${faltan.join(", ")}. Si el archivo viene de otro software, usa el asistente de mapeo.` }],
    };
  }

  const documentos: DocumentoRcv[] = [];
  const valor = (f: string[], campo: string) => (pos[campo] !== undefined ? f[pos[campo]] ?? "" : "");
  const entero = (f: string[], campo: string) => leerEntero(valor(f, campo)) ?? 0;

  for (let k = 1; k < filas.length; k++) {
    const f = filas[k];
    const n = k + 1;
    const tipo = leerEntero(valor(f, "tipo_doc"));
    if (!tipo) {
      // Filas de totales o vacías al final del archivo.
      if (/total/i.test(f.join(" "))) continue;
      errores.push({ fila: n, mensaje: "Sin tipo de documento." });
      continue;
    }
    const rut = normalizarRut(valor(f, "rut"));
    if (!rut) {
      errores.push({ fila: n, mensaje: `RUT no válido: "${valor(f, "rut")}".` });
      continue;
    }
    const fecha = leerFecha(valor(f, "fecha_docto"));
    if (!fecha) {
      errores.push({ fila: n, mensaje: `Fecha no válida: "${valor(f, "fecha_docto")}".` });
      continue;
    }
    const folio = valor(f, "folio").replace(/^0+(?=\d)/, "");
    if (!folio) {
      errores.push({ fila: n, mensaje: "Sin folio." });
      continue;
    }
    const d: DocumentoRcv = {
      libro: libro ?? "compras",
      anio: desdeNombre.anio ?? Number(fecha.slice(0, 4)),
      mes: desdeNombre.mes ?? Number(fecha.slice(5, 7)),
      tipo_doc: tipo,
      tipo_operacion: valor(f, "tipo_operacion") || null,
      folio,
      rut_contraparte: rut,
      razon_social: valor(f, "razon_social") || null,
      fecha_docto: fecha,
      fecha_recepcion: leerFecha(valor(f, "fecha_recepcion")),
      monto_exento: entero(f, "monto_exento"),
      monto_neto: entero(f, "monto_neto"),
      monto_iva: entero(f, "monto_iva"),
      monto_iva_no_recuperable: entero(f, "monto_iva_no_recuperable"),
      codigo_iva_no_recuperable: valor(f, "codigo_iva_no_recuperable") || null,
      iva_uso_comun: entero(f, "iva_uso_comun"),
      monto_neto_activo_fijo: entero(f, "monto_neto_activo_fijo"),
      iva_activo_fijo: entero(f, "iva_activo_fijo"),
      otros_impuestos: entero(f, "otros_impuestos"),
      monto_total: entero(f, "monto_total"),
      datos_originales: Object.fromEntries(encabezados.map((h, i) => [h, f[i] ?? ""])),
    };
    // Coherencia del total (aviso, no error: hay impuestos específicos que no vienen desglosados).
    const suma = d.monto_exento + d.monto_neto + d.monto_iva + d.monto_iva_no_recuperable + d.otros_impuestos;
    if (Math.abs(suma - d.monto_total) > 2) {
      avisos.push(`Fila ${n} (folio ${d.folio}): exento + neto + IVA + otros = ${suma} y el total dice ${d.monto_total}.`);
    }
    documentos.push(d);
  }

  // Si el nombre no traía periodo, se usa el mes más frecuente de las fechas.
  let { anio, mes } = desdeNombre;
  if ((!anio || !mes) && documentos.length) {
    const conteo = new Map<string, number>();
    for (const d of documentos) conteo.set(d.fecha_docto.slice(0, 7), (conteo.get(d.fecha_docto.slice(0, 7)) ?? 0) + 1);
    const [clave] = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0];
    anio = Number(clave.slice(0, 4));
    mes = Number(clave.slice(5, 7));
    for (const d of documentos) {
      d.anio = anio;
      d.mes = mes;
    }
    avisos.push(`El nombre del archivo no indica el periodo: se asumió ${String(mes).padStart(2, "0")}-${anio} según las fechas.`);
  }
  return { libro, rutEmpresa: desdeNombre.rut, anio, mes, documentos, errores, avisos };
}

function vacio(d: ReturnType<typeof datosDesdeNombre>): ResultadoLectura {
  return { libro: d.libro, rutEmpresa: d.rut, anio: d.anio, mes: d.mes, documentos: [], errores: [], avisos: [] };
}

/** Totales de un libro (las notas de crédito restan). */
export function totalesLibro(docs: Pick<DocumentoRcv, "tipo_doc" | "monto_exento" | "monto_neto" | "monto_iva" | "monto_iva_no_recuperable" | "otros_impuestos" | "monto_total">[]) {
  const t = { documentos: docs.length, exento: 0, neto: 0, iva: 0, ivaNoRecuperable: 0, otros: 0, total: 0 };
  for (const d of docs) {
    const s = esNotaCredito(d.tipo_doc) ? -1 : 1;
    t.exento += s * d.monto_exento;
    t.neto += s * d.monto_neto;
    t.iva += s * d.monto_iva;
    t.ivaNoRecuperable += s * d.monto_iva_no_recuperable;
    t.otros += s * d.otros_impuestos;
    t.total += s * d.monto_total;
  }
  return t;
}
