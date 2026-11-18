"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { normalizarRut } from "@/lib/rut";
import { leerEntero } from "@/lib/importar/csv";

const monto = z.string().transform((v) => leerEntero(v) ?? 0).pipe(z.number().int().min(0));
const fechaOpcional = z.string().transform((v) => v || null);
const texto = z.string().trim().transform((v) => v || null);

const esquema = z.object({
  rut: z.string().transform((v, c) => normalizarRut(v) ?? (c.addIssue({ code: "custom", message: "RUT no válido" }), z.NEVER)),
  nombres: z.string().trim().min(2, "Escribe los nombres"),
  apellido_paterno: z.string().trim().min(2, "Escribe el apellido paterno"),
  apellido_materno: texto,
  fecha_nacimiento: fechaOpcional,
  sexo: z.enum(["F", "M", "X"]).optional().transform((v) => v ?? null),
  nacionalidad: texto,
  direccion: texto,
  comuna: texto,
  correo: texto,
  telefono: texto,
  cargo: texto,
  fecha_ingreso: z.string().min(10, "Indica la fecha de ingreso"),
  fecha_termino: fechaOpcional,
  tipo_contrato: z.enum(["indefinido", "plazo_fijo", "obra"]),
  jornada_horas: z.string().transform((v) => Number(v.replace(",", "."))).pipe(z.number().positive("Indica la jornada").max(60)),
  sueldo_base: monto,
  gratificacion: z.enum(["art50_mensual", "sin"]),
  colacion: monto,
  movilizacion: monto,
  afp: z.string().transform((v) => v || null),
  pensionado: z.string().optional().transform((v) => v === "on"),
  salud: z.string().min(1),
  plan_isapre_uf: z.string().transform((v) => (v ? Number(v.replace(",", ".")) : null)),
  plan_isapre_pesos: z.string().transform((v) => (v ? leerEntero(v) : null)),
  seguro_cesantia: z.string().optional().transform((v) => v === "on"),
  trabajo_pesado: z.enum(["no", "pesado", "menos_pesado"]),
  cargas_familiares: z.string().transform((v) => Number(v || 0)).pipe(z.number().int().min(0).max(20)),
  forma_pago: z.enum(["transferencia", "cheque", "efectivo"]),
  banco: texto,
  cuenta_bancaria: texto,
  consentimiento_whatsapp: z.string().optional().transform((v) => v === "on"),
});

export async function guardarTrabajador(_p: { error?: string; ok?: string } | undefined, datos: FormData) {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "remuneraciones").editar) return { error: "No tienes permiso de remuneraciones en esta empresa." };
  const r = esquema.safeParse(Object.fromEntries(datos.entries()));
  if (!r.success) return { error: r.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join(". ") };
  const d = r.data;
  if (d.tipo_contrato !== "indefinido" && !d.fecha_termino) return { error: "Un contrato a plazo fijo o por obra necesita fecha de término." };
  if (d.salud.startsWith("isapre") && !d.plan_isapre_uf && !d.plan_isapre_pesos) return { error: "Indica el valor del plan de Isapre (en UF o en pesos)." };
  const supabase = await clienteServidor();
  const id = String(datos.get("id") ?? "");
  if (id) {
    const { error } = await supabase.from("trabajadores").update(d).eq("id", id);
    if (error) return { error: error.code === "23505" ? "Ya existe otro trabajador con ese RUT en la empresa." : error.message };
    revalidatePath("/remuneraciones", "layout");
    return { ok: "Ficha guardada." };
  }
  const { data, error } = await supabase.from("trabajadores").insert({ ...d, estudio_id: ctx.estudio!.id, empresa_id: ctx.empresa.id }).select("id").single();
  if (error) return { error: error.code === "23505" ? "Ya existe un trabajador con ese RUT en la empresa." : error.message };
  revalidatePath("/remuneraciones", "layout");
  redirect(`/remuneraciones/trabajadores/${data.id}?creado=1`);
}

/** Desactiva al trabajador (no se borra: sus liquidaciones siguen disponibles). */
export async function cambiarActivo(id: string, activo: boolean) {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "remuneraciones").editar) return { error: "Sin permiso." };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("trabajadores").update({ activo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/remuneraciones", "layout");
  return {};
}
