"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  id: z.string().uuid().nullable(),
  tipo: z.enum(["ingreso", "egreso", "traspaso", "apertura"]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  glosa: z.string().trim().min(3, "Escribe la glosa del comprobante"),
  lineas: z
    .array(
      z.object({
        cuenta_id: z.string().uuid("Hay una línea sin cuenta"),
        glosa: z.string().max(300).optional().default(""),
        debe: z.number().int().min(0),
        haber: z.number().int().min(0),
        centro_costo_id: z.string().uuid().nullable().optional(),
      }),
    )
    .min(2, "El comprobante necesita al menos dos líneas"),
});

export type DatosComprobante = z.input<typeof esquema>;

/** Guarda (crea o modifica) un comprobante. La base de datos vuelve a validar todo. */
export async function guardarComprobante(datos: DatosComprobante): Promise<{ error?: string; id?: string; numero?: number }> {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "contabilidad").editar) {
    return { error: "No tienes permiso para registrar comprobantes en esta empresa." };
  }
  const r = esquema.safeParse(datos);
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  const debe = d.lineas.reduce((s, l) => s + l.debe, 0);
  const haber = d.lineas.reduce((s, l) => s + l.haber, 0);
  if (debe !== haber) return { error: `No cuadra: el debe suma ${debe} y el haber ${haber}.` };
  if (d.lineas.some((l) => (l.debe > 0) === (l.haber > 0))) return { error: "Cada línea debe tener monto en el debe o en el haber (no en ambos)." };

  const supabase = await clienteServidor();
  const { data: id, error } = await supabase.rpc("guardar_comprobante", {
    p_empresa: ctx.empresa.id,
    p_id: d.id,
    p_tipo: d.tipo,
    p_fecha: d.fecha,
    p_glosa: d.glosa,
    p_lineas: d.lineas.map((l) => ({ ...l, centro_costo_id: l.centro_costo_id ?? null })),
  });
  if (error) return { error: error.message };
  const { data: c } = await supabase.from("comprobantes").select("numero").eq("id", id).single();
  revalidatePath("/contabilidad", "layout");
  revalidatePath("/mi-mes");
  return { id: id as string, numero: c?.numero };
}

export async function anularComprobante(id: string, motivo: string) {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "contabilidad").editar) return { error: "Sin permiso." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("anular_comprobante", { p_id: id, p_motivo: motivo });
  if (error) return { error: error.message };
  revalidatePath("/contabilidad", "layout");
  return {};
}
