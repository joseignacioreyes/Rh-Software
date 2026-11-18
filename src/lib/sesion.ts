import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { ZONA_HORARIA } from "@/lib/formato";

// Contexto de trabajo del usuario: quién es, en qué estudio, empresa y periodo está,
// y qué puede hacer. Se calcula una vez por solicitud.

export const COOKIE_ESTUDIO = "rh_estudio";
export const COOKIE_EMPRESA = "rh_empresa";
export const COOKIE_PERIODO = "rh_periodo";

export type Modulo = "contabilidad" | "libros" | "impuestos" | "remuneraciones" | "documentos";
export const MODULOS: { codigo: Modulo; nombre: string }[] = [
  { codigo: "contabilidad", nombre: "Contabilidad" },
  { codigo: "libros", nombre: "Libros" },
  { codigo: "impuestos", nombre: "Impuestos" },
  { codigo: "remuneraciones", nombre: "Remuneraciones" },
  { codigo: "documentos", nombre: "Documentos" },
];

export type Rol = "contador" | "asistente" | "cliente" | "lector";

export type EmpresaResumen = {
  id: string;
  rut: string;
  razon_social: string;
  nombre_fantasia: string | null;
  regimen: string;
  activa: boolean;
};

export type Periodo = { anio: number; mes: number };

export type Contexto = {
  usuario: {
    id: string;
    rut: string;
    nombre: string;
    correo: string;
    requiere_2fa: boolean;
    es_superadmin: boolean;
    debe_cambiar_clave: boolean;
  };
  estudios: { id: string; nombre: string; es_demo: boolean; rol: Rol }[];
  estudio: { id: string; nombre: string; es_demo: boolean } | null;
  /** Rol a nivel de estudio (contador o lector); null si solo tiene acceso por empresa. */
  rolEstudio: Rol | null;
  empresas: EmpresaResumen[];
  empresa: EmpresaResumen | null;
  periodo: Periodo;
  /** Permisos por empresa para asistentes y clientes. */
  membresiasEmpresa: { empresa_id: string; rol: Rol; permisos: Record<string, boolean> }[];
};

/** Periodo por defecto: el mes anterior al actual (el que el contador está cerrando). */
export function periodoPorDefecto(hoy = new Date()): Periodo {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA, year: "numeric", month: "numeric" })
    .formatToParts(hoy);
  const anio = Number(partes.find((p) => p.type === "year")!.value);
  const mes = Number(partes.find((p) => p.type === "month")!.value);
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
}

export function leerPeriodo(valor: string | undefined): Periodo {
  const m = valor?.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const anio = Number(m[1]);
    const mes = Number(m[2]);
    if (anio >= 2000 && anio <= 2100 && mes >= 1 && mes <= 12) return { anio, mes };
  }
  return periodoPorDefecto();
}

/**
 * Obtiene el contexto. Si no hay sesión, o falta el segundo factor obligatorio, redirige.
 */
export const obtenerContexto = cache(async (): Promise<Contexto> => {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, rut, nombre, correo, requiere_2fa, es_superadmin, debe_cambiar_clave")
    .eq("id", user.id)
    .single();
  if (!perfil) redirect("/ingresar?error=perfil");

  // Segundo factor obligatorio para quien lo requiere.
  if (perfil.requiere_2fa) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      redirect(aal?.nextLevel === "aal2" ? "/ingresar/verificar" : "/ingresar/configurar-2fa");
    }
  }

  // Clave temporal de invitación: hay que cambiarla antes de seguir.
  if (perfil.debe_cambiar_clave) redirect("/ingresar/nueva-clave");

  const { data: membresias } = await supabase
    .from("membresias")
    .select("estudio_id, empresa_id, rol, permisos, estudios(id, nombre, es_demo)")
    .eq("usuario_id", user.id)
    .eq("activa", true);

  // Estudios del usuario (sin repetir), con su rol más alto en cada uno.
  const prioridad: Record<Rol, number> = { contador: 4, lector: 3, asistente: 2, cliente: 1 };
  const porEstudio = new Map<string, Contexto["estudios"][number]>();
  for (const m of membresias ?? []) {
    const e = m.estudios as unknown as { id: string; nombre: string; es_demo: boolean } | null;
    if (!e) continue;
    const previo = porEstudio.get(e.id);
    if (!previo || prioridad[m.rol as Rol] > prioridad[previo.rol]) {
      porEstudio.set(e.id, { ...e, rol: m.rol as Rol });
    }
  }
  const estudios = [...porEstudio.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const almacen = await cookies();
  const estudio =
    estudios.find((e) => e.id === almacen.get(COOKIE_ESTUDIO)?.value) ?? estudios[0] ?? null;

  const rolEstudio =
    (membresias ?? []).find(
      (m) => m.estudio_id === estudio?.id && m.empresa_id === null && (m.rol === "contador" || m.rol === "lector"),
    )?.rol ?? null;

  const membresiasEmpresa = (membresias ?? [])
    .filter((m) => m.estudio_id === estudio?.id && m.empresa_id)
    .map((m) => ({ empresa_id: m.empresa_id as string, rol: m.rol as Rol, permisos: (m.permisos ?? {}) as Record<string, boolean> }));

  let empresas: EmpresaResumen[] = [];
  if (estudio) {
    const { data } = await supabase
      .from("empresas")
      .select("id, rut, razon_social, nombre_fantasia, regimen, activa")
      .eq("estudio_id", estudio.id)
      .order("razon_social");
    empresas = data ?? [];
  }
  const activas = empresas.filter((e) => e.activa);
  const empresa = activas.find((e) => e.id === almacen.get(COOKIE_EMPRESA)?.value) ?? activas[0] ?? null;

  return {
    usuario: perfil,
    estudios,
    estudio: estudio ? { id: estudio.id, nombre: estudio.nombre, es_demo: estudio.es_demo } : null,
    rolEstudio: rolEstudio as Rol | null,
    empresas,
    empresa,
    periodo: leerPeriodo(almacen.get(COOKIE_PERIODO)?.value),
    membresiasEmpresa,
  };
});

/** ¿Puede ver o editar el módulo en la empresa? (la base de datos lo vuelve a verificar) */
export function permiso(ctx: Contexto, empresaId: string, modulo: Modulo): { ver: boolean; editar: boolean } {
  if (ctx.rolEstudio === "contador") return { ver: true, editar: true };
  if (ctx.rolEstudio === "lector") return { ver: true, editar: false };
  const m = ctx.membresiasEmpresa.find((x) => x.empresa_id === empresaId && x.rol === "asistente");
  const tiene = !!m?.permisos?.[modulo];
  return { ver: tiene, editar: tiene };
}

export function esContador(ctx: Contexto) {
  return ctx.rolEstudio === "contador";
}

/** Primer y último día del periodo, en formato AAAA-MM-DD. */
export function rangoPeriodo({ anio, mes }: Periodo) {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const m = String(mes).padStart(2, "0");
  return { desde: `${anio}-${m}-01`, hasta: `${anio}-${m}-${String(ultimo).padStart(2, "0")}` };
}

export const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function nombrePeriodo({ anio, mes }: Periodo) {
  return `${NOMBRES_MES[mes - 1]} ${anio}`;
}
