// Lectura de archivos de texto separados (CSV) como los del SII y los bancos:
// codificación UTF-8 o Latin-1 y separador punto y coma, coma o tabulación.

/** Decodifica bytes: intenta UTF-8 estricto y, si falla, Latin-1 (como los archivos del SII). */
export function decodificar(bytes: Uint8Array): { texto: string; codificacion: "utf-8" | "latin1" } {
  try {
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { texto: texto.replace(/^﻿/, ""), codificacion: "utf-8" };
  } catch {
    return { texto: new TextDecoder("latin1").decode(bytes), codificacion: "latin1" };
  }
}

/** Detecta el separador mirando la primera línea. */
export function detectarSeparador(primeraLinea: string): string {
  const cuenta = (s: string) => primeraLinea.split(s).length - 1;
  const candidatos = [";", ",", "\t", "|"].map((s) => [s, cuenta(s)] as const);
  candidatos.sort((a, b) => b[1] - a[1]);
  return candidatos[0][1] > 0 ? candidatos[0][0] : ";";
}

/** Parte un CSV respetando comillas. Devuelve filas de celdas (sin filas vacías). */
export function leerCsv(texto: string, separador?: string): string[][] {
  const lineas = texto.replace(/\r\n?/g, "\n");
  const sep = separador ?? detectarSeparador(lineas.split("\n", 1)[0] ?? "");
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < lineas.length; i++) {
    const c = lineas[i];
    if (entreComillas) {
      if (c === '"') {
        if (lineas[i + 1] === '"') {
          celda += '"';
          i++;
        } else entreComillas = false;
      } else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) {
      fila.push(celda.trim());
      celda = "";
    } else if (c === "\n") {
      fila.push(celda.trim());
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  fila.push(celda.trim());
  if (fila.some((x) => x !== "")) filas.push(fila);
  return filas;
}

/** Normaliza un encabezado para compararlo: sin tildes, minúsculas, sin signos. */
export function normalizarEncabezado(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/n°|nº|no\./g, "numero")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Lee un monto entero: "1.234.567", "-1234", "1234,00", "$ 1.234". */
export function leerEntero(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor) : null;
  let t = valor.trim().replace(/\$|\s/g, "");
  if (t === "" || t === "-") return 0;
  const negativo = /^\(.*\)$/.test(t) || t.startsWith("-");
  t = t.replace(/[()-]/g, "");
  // "1.234.567,89" o "1234,00" → decimales con coma
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  else if (/^\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, "");
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(negativo ? -n : n);
}

/** Lee una fecha "DD/MM/AAAA", "DD-MM-AAAA", "AAAA-MM-DD" o número de serie de Excel. Devuelve "AAAA-MM-DD". */
export function leerFecha(valor: string | number | Date | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString().slice(0, 10);
  if (typeof valor === "number") {
    // Serie de Excel (días desde 1899-12-30).
    const d = new Date(Date.UTC(1899, 11, 30) + valor * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const t = valor.trim();
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return armar(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return armar(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}

function armar(a: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCMonth() !== m - 1) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Huella simple (FNV-1a de 64 bits en hexadecimal) para detectar duplicados. */
export function huella(texto: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}
