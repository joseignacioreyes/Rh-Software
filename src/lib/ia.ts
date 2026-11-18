import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Inteligencia artificial (API de Claude) para leer documentos y sugerir mapeos.
// Modelo indicado en la guía del proyecto: claude-haiku-5-5 (rápido y de bajo costo).
// Todo lo que sugiere la IA lo confirma una persona antes de guardarse.
// Si no hay ANTHROPIC_API_KEY, estas funciones devuelven null y la app sigue sin IA.

const MODELO = "claude-haiku-5-5";

export const iaDisponible = () => !!process.env.ANTHROPIC_API_KEY;

function cliente() {
  return new Anthropic();
}

/** Sugiere qué columna del archivo corresponde a cada campo. Devuelve índices de columna o null. */
export async function sugerirMapeoIA(
  campos: { campo: string; nombre: string }[],
  encabezados: string[],
  ejemplos: string[][],
): Promise<Record<string, number | null> | null> {
  if (!iaDisponible()) return null;
  const esquema = z.object({
    asignaciones: z.array(z.object({ campo: z.string(), columna: z.number().int().nullable() })),
  });
  try {
    const r = await cliente().messages.parse({
      model: MODELO,
      max_tokens: 2000,
      output_config: { format: zodOutputFormat(esquema) },
      messages: [
        {
          role: "user",
          content:
            `Eres un asistente contable chileno. Un archivo de un libro contable tiene estas columnas (índice: encabezado):\n` +
            encabezados.map((h, i) => `${i}: ${h}`).join("\n") +
            `\n\nPrimeras filas de ejemplo:\n${ejemplos.slice(0, 5).map((f) => f.join(" | ")).join("\n")}\n\n` +
            `Indica qué columna corresponde a cada campo (null si no existe):\n` +
            campos.map((c) => `- ${c.campo}: ${c.nombre}`).join("\n"),
        },
      ],
    });
    if (!r.parsed_output) return null;
    const mapeo: Record<string, number | null> = {};
    for (const a of r.parsed_output.asignaciones) {
      if (campos.some((c) => c.campo === a.campo)) {
        mapeo[a.campo] = a.columna !== null && a.columna >= 0 && a.columna < encabezados.length ? a.columna : null;
      }
    }
    return mapeo;
  } catch (e) {
    console.error("IA: no se pudo sugerir el mapeo", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return null;
  }
}

export const esquemaDocumentoLeido = z.object({
  tipo_documento: z.enum(["factura", "factura_exenta", "boleta", "boleta_honorarios", "nota_credito", "nota_debito", "guia_despacho", "otro"]),
  codigo_sii: z.number().int().nullable(),
  folio: z.string().nullable(),
  fecha: z.string().nullable().describe("Fecha de emisión en formato AAAA-MM-DD"),
  rut_emisor: z.string().nullable(),
  razon_social_emisor: z.string().nullable(),
  rut_receptor: z.string().nullable(),
  monto_neto: z.number().int().nullable(),
  monto_exento: z.number().int().nullable(),
  monto_iva: z.number().int().nullable(),
  monto_total: z.number().int().nullable(),
  glosa: z.string().nullable().describe("Descripción breve de lo comprado o vendido"),
  cuenta_sugerida: z.string().nullable().describe("Nombre de la cuenta contable de gasto o activo más probable"),
  confianza: z.enum(["alta", "media", "baja"]),
  observaciones: z.string().nullable(),
});
export type DocumentoLeido = z.infer<typeof esquemaDocumentoLeido>;

/** Lee una factura o boleta (foto o PDF) y devuelve sus datos. Siempre se muestran para confirmar. */
export async function leerDocumentoIA(bytes: Buffer, tipoMime: string): Promise<DocumentoLeido | null> {
  if (!iaDisponible()) return null;
  const datos = bytes.toString("base64");
  const bloque: Anthropic.ContentBlockParam =
    tipoMime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: datos } }
      : {
          type: "image",
          source: { type: "base64", media_type: tipoMime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: datos },
        };
  try {
    const r = await cliente().messages.parse({
      model: MODELO,
      max_tokens: 4000,
      output_config: { format: zodOutputFormat(esquemaDocumentoLeido) },
      messages: [
        {
          role: "user",
          content: [
            bloque,
            {
              type: "text",
              text:
                "Lee este documento tributario chileno y extrae sus datos. Montos en pesos enteros, sin puntos. " +
                "RUT con guion y dígito verificador (ej. 76123456-7). Si un dato no se ve con claridad, déjalo en null y baja la confianza. " +
                "No inventes datos.",
            },
          ],
        },
      ],
    });
    return r.parsed_output ?? null;
  } catch (e) {
    console.error("IA: no se pudo leer el documento", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return null;
  }
}
