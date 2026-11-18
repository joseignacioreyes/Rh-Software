import "server-only";
import { decodificar, leerCsv } from "./csv";

export type Celda = string | number | Date | null;

/** Lee la primera hoja de un Excel (.xlsx) o un CSV como filas de celdas. La primera fila no vacía es el encabezado. */
export async function leerFilasArchivo(archivo: File): Promise<{ encabezados: string[]; filas: Celda[][] }> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let todas: Celda[][];
  if (/\.xlsx$/i.test(archivo.name)) {
    const ExcelJS = (await import("exceljs")).default;
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    const hoja = libro.worksheets[0];
    todas = [];
    hoja?.eachRow({ includeEmpty: false }, (fila) => {
      const valores = (fila.values as unknown[]).slice(1).map((v): Celda => {
        if (v === null || v === undefined) return null;
        if (v instanceof Date) return v;
        if (typeof v === "object") {
          const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
          if (o.result !== undefined) return o.result as Celda;
          if (o.richText) return o.richText.map((r) => r.text).join("");
          return o.text ?? String(v);
        }
        return v as Celda;
      });
      todas.push(valores);
    });
  } else {
    todas = leerCsv(decodificar(bytes).texto);
  }
  // Encabezado: la primera fila con al menos 3 celdas de texto.
  const inicio = Math.max(0, todas.findIndex((f) => f.filter((c) => typeof c === "string" && c.trim()).length >= 3));
  const encabezados = (todas[inicio] ?? []).map((c, i) => (c === null ? `Columna ${i + 1}` : String(c).trim()));
  return { encabezados, filas: todas.slice(inicio + 1) };
}
