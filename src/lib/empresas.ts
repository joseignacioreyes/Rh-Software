import { z } from "zod";
import { normalizarRut } from "@/lib/rut";

// Regímenes tributarios. Configurable: agregar aquí si se necesita otro.
export const REGIMENES = [
  { codigo: "propyme_general", nombre: "Pro Pyme General (14 D N°3)" },
  { codigo: "propyme_transparente", nombre: "Pro Pyme Transparente (14 D N°8)" },
  { codigo: "semi_integrado", nombre: "Semi integrado (14 A)" },
  { codigo: "renta_presunta", nombre: "Renta presunta" },
  { codigo: "otro", nombre: "Otro" },
] as const;

export function nombreRegimen(codigo: string) {
  return REGIMENES.find((r) => r.codigo === codigo)?.nombre ?? codigo;
}

const rut = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizarRut(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "RUT no válido (revisa el dígito verificador)" });
      return z.NEVER;
    }
    return n;
  });

const rutOpcional = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizarRut(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "RUT no válido" });
      return z.NEVER;
    }
    return n;
  });

const textoOpcional = z.string().trim().transform((v) => v || null);

/** Porcentaje escrito con coma o punto ("0,25" o "0.25"). */
const porcentaje = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "Escribe un porcentaje entre 0 y 100" });
      return z.NEVER;
    }
    return n;
  });

export const esquemaEmpresa = z.object({
  rut,
  razon_social: z.string().trim().min(2, "Escribe la razón social"),
  nombre_fantasia: textoOpcional,
  giro: textoOpcional,
  actividades_economicas: z
    .string()
    .trim()
    .transform((v) => v.split(/[,;\s]+/).filter(Boolean)),
  direccion: textoOpcional,
  comuna: textoOpcional,
  representante_legal: textoOpcional,
  rut_representante: rutOpcional,
  regimen: z.enum(REGIMENES.map((r) => r.codigo) as [string, ...string[]]),
  inicio_actividades: z
    .string()
    .trim()
    .transform((v) => v || null),
  tasa_ppm: porcentaje,
  emite_factura_electronica: z.string().optional().transform((v) => v === "on"),
  organismo_16744: textoOpcional,
  tasa_cotizacion_adicional: porcentaje,
  caja_compensacion: textoOpcional,
  contacto_nombre: textoOpcional,
  contacto_correo: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.email("Correo no válido").nullable()),
  contacto_whatsapp: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const d = v.replace(/\D/g, "");
      const n = d.length === 9 ? `56${d}` : d;
      if (!/^56\d{9}$/.test(n)) {
        ctx.addIssue({ code: "custom", message: "Escribe un celular chileno, por ejemplo +56 9 1234 5678" });
        return z.NEVER;
      }
      return n;
    }),
});

export type DatosEmpresa = z.infer<typeof esquemaEmpresa>;
