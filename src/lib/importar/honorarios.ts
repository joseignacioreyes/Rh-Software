// Boletas de honorarios (recibidas o emitidas) desde el informe descargado del SII (CSV o Excel convertido a filas).
import { leerEntero, leerFecha } from "./csv";
import { ubicarColumnas } from "./rcv";
import { normalizarRut } from "@/lib/rut";

export type BoletaHonorarios = {
  folio: string;
  fecha: string;
  rut_contraparte: string;
  nombre: string | null;
  monto_bruto: number;
  monto_retencion: number;
  monto_liquido: number;
  estado: "vigente" | "anulada";
  retencion_por: "receptor" | "emisor" | null;
  datos_originales: Record<string, string>;
};

const COLUMNAS_HONORARIOS: Record<string, string[]> = {
  folio: ["numero boleta", "numero", "folio", "boleta"],
  estado: ["estado"],
  fecha: ["fecha boleta", "fecha emision", "fecha"],
  rut: ["rut emisor", "rut receptor", "rut prestador", "rut"],
  nombre: ["nombre o razon social emisor", "nombre emisor", "nombre o razon social receptor", "razon social", "nombre"],
  bruto: ["monto bruto", "brutos", "bruto", "honorarios brutos"],
  retencion: ["monto retenido", "retenido", "retencion", "monto retencion"],
  liquido: ["monto pagado", "pagado", "liquido", "monto liquido"],
  retenedor: ["retencion receptor", "retenedor", "ret receptor"],
};

export function leerHonorarios(filas: string[][]): { boletas: BoletaHonorarios[]; errores: { fila: number; mensaje: string }[] } {
  const errores: { fila: number; mensaje: string }[] = [];
  // El informe del SII trae algunas filas de título antes del encabezado: buscar la fila con "rut" y "bruto".
  const inicio = filas.findIndex((f) => f.some((c) => /rut/i.test(c)) && f.some((c) => /brut/i.test(c)));
  if (inicio < 0) return { boletas: [], errores: [{ fila: 1, mensaje: "No se encontró el encabezado (columnas RUT y Monto Bruto)." }] };
  const encabezados = filas[inicio];
  const pos = ubicarColumnas(encabezados, COLUMNAS_HONORARIOS);
  const boletas: BoletaHonorarios[] = [];
  const v = (f: string[], c: string) => (pos[c] !== undefined ? f[pos[c]] ?? "" : "");

  for (let k = inicio + 1; k < filas.length; k++) {
    const f = filas[k];
    const n = k + 1;
    if (/total/i.test(f.join(" "))) continue;
    const rut = normalizarRut(v(f, "rut"));
    const fecha = leerFecha(v(f, "fecha"));
    const bruto = leerEntero(v(f, "bruto"));
    if (!rut || !fecha || bruto === null) {
      if (f.filter(Boolean).length > 2) errores.push({ fila: n, mensaje: "Faltan RUT, fecha o monto bruto válidos." });
      continue;
    }
    const retencion = leerEntero(v(f, "retencion")) ?? 0;
    const liquido = leerEntero(v(f, "liquido")) ?? bruto - retencion;
    if (bruto - retencion !== liquido) {
      errores.push({ fila: n, mensaje: `Bruto (${bruto}) menos retención (${retencion}) no da el líquido (${liquido}).` });
    }
    const estado = /anul|nula/i.test(v(f, "estado")) ? "anulada" : "vigente";
    const ret = v(f, "retenedor");
    boletas.push({
      folio: v(f, "folio").replace(/^0+(?=\d)/, "") || `${rut}-${fecha}`,
      fecha,
      rut_contraparte: rut,
      nombre: v(f, "nombre") || null,
      monto_bruto: bruto,
      monto_retencion: retencion,
      monto_liquido: liquido,
      estado,
      retencion_por: ret ? (/s|x|1|receptor/i.test(ret) ? "receptor" : "emisor") : retencion > 0 ? "receptor" : null,
      datos_originales: Object.fromEntries(encabezados.map((h, i) => [h, f[i] ?? ""])),
    });
  }
  return { boletas, errores };
}
