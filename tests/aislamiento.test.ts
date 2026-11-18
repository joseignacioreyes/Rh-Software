// Pruebas automáticas de aislamiento (Row Level Security) contra la base de datos.
// Requieren Supabase corriendo (local: `npx supabase start`) y el demo cargado (`npm run seed:demo`).
// Crean un segundo estudio "ajeno" y verifican que nadie vea lo que no le corresponde.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO } from "../src/lib/demo";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SERVICIO, { auth: { persistSession: false } });

const AJENO = {
  estudio: "00000000-0000-4000-8000-00000000ff01",
  empresa: "00000000-0000-4000-8000-00000000ff02",
  contador: { id: "00000000-0000-4000-8000-00000000ff03", rut: "12345678-5", correo: "ajeno@prueba.rhsoftware.cl" },
  superadmin: { id: "00000000-0000-4000-8000-00000000ff04", rut: "19222444-6", correo: "super@prueba.rhsoftware.cl" },
  cliente: { id: "00000000-0000-4000-8000-00000000ff05", rut: "20333555-5", correo: "cliente@prueba.rhsoftware.cl" },
};
const CLAVE = "Prueba1234";

async function sesion(correo: string, clave = CLAVE): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw new Error(`No pudo iniciar sesión ${correo}: ${error.message}`);
  return c;
}

async function crearUsuario(u: { id: string; rut: string; correo: string }, nombre: string, extra: Record<string, unknown> = {}) {
  await admin.auth.admin.deleteUser(u.id).catch(() => {});
  const r = await admin.auth.admin.createUser({ id: u.id, email: u.correo, password: CLAVE, email_confirm: true });
  if (r.error) throw r.error;
  const p = await admin.from("usuarios").upsert({ id: u.id, rut: u.rut, nombre, correo: u.correo, requiere_2fa: false, ...extra });
  if (p.error) throw p.error;
}

let ana: SupabaseClient, luis: SupabaseClient, visitante: SupabaseClient, ajeno: SupabaseClient, superadmin: SupabaseClient, cliente: SupabaseClient;

beforeAll(async () => {
  await admin.from("estudios").delete().eq("id", AJENO.estudio);
  await crearUsuario(AJENO.contador, "Contador Ajeno");
  await crearUsuario(AJENO.superadmin, "Super Admin Prueba", { es_superadmin: true });
  await crearUsuario(AJENO.cliente, "Cliente Prueba");
  await admin.from("estudios").insert({ id: AJENO.estudio, nombre: "Estudio Ajeno" });
  await admin.from("empresas").insert({ id: AJENO.empresa, estudio_id: AJENO.estudio, rut: "96555444-0", razon_social: "Empresa Ajena SpA" });
  await admin.from("membresias").insert([
    { usuario_id: AJENO.contador.id, estudio_id: AJENO.estudio, rol: "contador", permisos: {} },
    { usuario_id: AJENO.cliente.id, estudio_id: DEMO.estudio.id, empresa_id: DEMO.empresas.almacen, rol: "cliente", permisos: {} },
  ]);
  [ana, luis, visitante, ajeno, superadmin, cliente] = await Promise.all([
    sesion(DEMO.ana.correo, DEMO.clave),
    sesion(DEMO.luis.correo, DEMO.clave),
    sesion(DEMO.visitante.correo, DEMO.clave),
    sesion(AJENO.contador.correo),
    sesion(AJENO.superadmin.correo),
    sesion(AJENO.cliente.correo),
  ]);
});

afterAll(async () => {
  await admin.from("estudios").delete().eq("id", AJENO.estudio);
  await admin.from("membresias").delete().eq("usuario_id", AJENO.cliente.id);
  for (const u of [AJENO.contador, AJENO.superadmin, AJENO.cliente]) await admin.auth.admin.deleteUser(u.id);
});

describe("aislamiento entre estudios", () => {
  it("la contadora del demo ve sus 3 empresas y no la del estudio ajeno", async () => {
    const { data } = await ana.from("empresas").select("id");
    const ids = (data ?? []).map((e) => e.id);
    expect(ids).toHaveLength(3);
    expect(ids).not.toContain(AJENO.empresa);
  });
  it("el contador ajeno no ve empresas, comprobantes ni auditoría del demo", async () => {
    const e = await ajeno.from("empresas").select("id");
    expect((e.data ?? []).map((x) => x.id)).toEqual([AJENO.empresa]);
    const c = await ajeno.from("comprobantes").select("id").eq("estudio_id", DEMO.estudio.id);
    expect(c.data).toEqual([]);
    const a = await ajeno.from("auditoria").select("id").eq("estudio_id", DEMO.estudio.id);
    expect(a.data).toEqual([]);
    const u = await ajeno.from("usuarios").select("id").eq("id", DEMO.ana.id);
    expect(u.data).toEqual([]);
  });
  it("el contador ajeno no puede crear empresas ni comprobantes en el demo", async () => {
    const r = await ajeno.from("empresas").insert({ estudio_id: DEMO.estudio.id, rut: "17888999-0", razon_social: "Intrusa" });
    expect(r.error).not.toBeNull();
    const c = await ajeno.rpc("guardar_comprobante", {
      p_empresa: DEMO.empresas.almacen, p_id: null, p_tipo: "traspaso", p_fecha: "2026-10-15", p_glosa: "intrusión", p_lineas: [],
    });
    expect(c.error?.message).toMatch(/permiso/);
  });
  it("no se puede darse acceso a sí mismo a otro estudio", async () => {
    const r = await ajeno.from("membresias").insert({ usuario_id: AJENO.contador.id, estudio_id: DEMO.estudio.id, rol: "contador", permisos: {} });
    expect(r.error).not.toBeNull();
  });
});

describe("permisos por rol dentro del estudio", () => {
  it("el asistente con solo remuneraciones ve sus 2 empresas pero no la contabilidad", async () => {
    const e = await luis.from("empresas").select("id");
    expect((e.data ?? []).map((x) => x.id).sort()).toEqual([DEMO.empresas.almacen, DEMO.empresas.transportes].sort());
    const c = await luis.from("comprobantes").select("id").limit(1);
    expect(c.data).toEqual([]);
    const p = await luis.from("plan_cuentas").select("id").limit(1);
    expect(p.data).toEqual([]);
  });
  it("el asistente no puede registrar comprobantes sin permiso de contabilidad", async () => {
    const r = await luis.rpc("guardar_comprobante", {
      p_empresa: DEMO.empresas.almacen, p_id: null, p_tipo: "traspaso", p_fecha: "2026-10-15", p_glosa: "x", p_lineas: [],
    });
    expect(r.error?.message).toMatch(/permiso/);
  });
  it("el visitante del demo ve todo pero no puede modificar nada", async () => {
    const c = await visitante.from("comprobantes").select("id").limit(1);
    expect(c.data?.length).toBe(1);
    const u = await visitante.from("empresas").update({ razon_social: "Cambiada" }).eq("id", DEMO.empresas.almacen).select();
    expect(u.data ?? []).toEqual([]);
    const r = await visitante.rpc("cerrar_periodo", { p_empresa: DEMO.empresas.almacen, p_anio: 2026, p_mes: 10 });
    expect(r.error).not.toBeNull();
  });
  it("el cliente ve su empresa pero no su contabilidad interna", async () => {
    const e = await cliente.from("empresas").select("id");
    expect((e.data ?? []).map((x) => x.id)).toEqual([DEMO.empresas.almacen]);
    const c = await cliente.from("comprobantes").select("id").limit(1);
    expect(c.data).toEqual([]);
  });
  it("nadie puede borrar comprobantes ni auditoría directamente", async () => {
    const c = await ana.from("comprobantes").delete().eq("empresa_id", DEMO.empresas.almacen).select();
    expect(c.error ?? (c.data ?? []).length === 0).toBeTruthy();
    const a = await ana.from("auditoria").delete().eq("estudio_id", DEMO.estudio.id).select();
    expect(a.error ?? (a.data ?? []).length === 0).toBeTruthy();
  });
});

describe("portal del cliente y bandeja", () => {
  it("el cliente solo ve liquidaciones aprobadas de su empresa", async () => {
    const { data: una } = await admin.from("liquidaciones").select("id").eq("empresa_id", DEMO.empresas.almacen).eq("anio", 2026).eq("mes", 10).limit(1).single();
    const r = await admin.from("liquidaciones").update({ estado: "calculada" }).eq("id", una!.id);
    expect(r.error).toBeNull();
    try {
      const { data } = await cliente.from("liquidaciones").select("id, estado, empresa_id");
      expect((data ?? []).length).toBeGreaterThan(0);
      expect((data ?? []).map((l) => l.id)).not.toContain(una!.id);
      expect((data ?? []).every((l) => l.estado === "aprobada" && l.empresa_id === DEMO.empresas.almacen)).toBe(true);
    } finally {
      await admin.from("liquidaciones").update({ estado: "aprobada" }).eq("id", una!.id);
    }
  });
  it("el cliente no ve la bandeja ni las liquidaciones de otra empresa", async () => {
    const b = await cliente.from("documentos_bandeja").select("id").eq("empresa_id", DEMO.empresas.transportes);
    expect(b.data).toEqual([]);
    const l = await cliente.from("liquidaciones").select("id").eq("empresa_id", DEMO.empresas.transportes);
    expect(l.data).toEqual([]);
  });
  it("el cliente sube a la bandeja, pero no registra en los libros ni marca documentos como registrados", async () => {
    const base = { estudio_id: DEMO.estudio.id, empresa_id: DEMO.empresas.almacen, nombre_archivo: "prueba.pdf", ruta_storage: "x/y/prueba.pdf" };
    const ok = await cliente.from("documentos_bandeja").insert({ ...base, origen: "portal" }).select("id").single();
    expect(ok.error).toBeNull();
    const mal = await cliente.from("documentos_bandeja").insert({ ...base, origen: "portal", estado: "registrado" });
    expect(mal.error).not.toBeNull();
    const cambio = await cliente.from("documentos_bandeja").update({ estado: "registrado" }).eq("id", ok.data!.id).select("id");
    expect(cambio.data ?? []).toEqual([]);
    const rcv = await cliente.from("documentos_rcv").insert({ estudio_id: DEMO.estudio.id, empresa_id: DEMO.empresas.almacen, libro: "compras", anio: 2026, mes: 11, tipo_doc: 33, folio: "1", rut_contraparte: "76555666-K", fecha_docto: "2026-11-01" });
    expect(rcv.error).not.toBeNull();
    await admin.from("documentos_bandeja").delete().eq("id", ok.data!.id);
  });
  it("el asistente sin permiso de documentos no ve la bandeja", async () => {
    const { data } = await luis.from("documentos_bandeja").select("id");
    expect(data).toEqual([]);
  });
});

describe("suscripción: solo lectura por atraso y límite del plan", () => {
  it("con el pago atrasado se puede ver todo pero no modificar, y sí informar un pago", async () => {
    await admin.from("suscripciones").upsert({ estudio_id: DEMO.estudio.id, plan: "inicial", estado: "activa", pagado_hasta: "2026-01-31", dias_gracia: 10 });
    try {
      const ver = await ana.from("empresas").select("id");
      expect(ver.data).toHaveLength(3);
      const c = await ana.from("centros_costo").insert({ estudio_id: DEMO.estudio.id, empresa_id: DEMO.empresas.almacen, codigo: "ZZ", nombre: "Prueba" });
      expect(c.error).not.toBeNull();
      const e = await ana.from("empresas").update({ giro: "cambio" }).eq("id", DEMO.empresas.almacen).select("id");
      expect(e.data ?? []).toEqual([]);
      const p = await ana.from("pagos_suscripcion").insert({ estudio_id: DEMO.estudio.id, plan: "inicial", monto: 29990, fecha_transferencia: "2026-11-18" });
      expect(p.error).toBeNull();
      const aprobar = await ana.rpc("aprobar_pago", { p_pago: "00000000-0000-4000-8000-000000000000" });
      expect(aprobar.error).not.toBeNull(); // solo el superadministrador aprueba
    } finally {
      await admin.from("pagos_suscripcion").delete().eq("estudio_id", DEMO.estudio.id);
      await admin.from("suscripciones").delete().eq("estudio_id", DEMO.estudio.id);
    }
  });
  it("no se pueden crear más empresas que las del plan", async () => {
    await admin.from("planes").upsert({ codigo: "prueba3", nombre: "Prueba", max_empresas: 3, precio_mensual: 0, activo: false });
    await admin.from("suscripciones").upsert({ estudio_id: DEMO.estudio.id, plan: "prueba3", estado: "activa", pagado_hasta: "2099-12-31" });
    try {
      const r = await ana.from("empresas").insert({ estudio_id: DEMO.estudio.id, rut: "96555444-0", razon_social: "Cuarta Empresa SpA" });
      expect(r.error?.message).toContain("Tu plan permite 3 empresas");
    } finally {
      await admin.from("suscripciones").delete().eq("estudio_id", DEMO.estudio.id);
      await admin.from("planes").delete().eq("codigo", "prueba3");
    }
  });
  it("un estudio no ve la suscripción ni los pagos de otro", async () => {
    const { data } = await ajeno.from("pagos_suscripcion").select("id").eq("estudio_id", DEMO.estudio.id);
    expect(data).toEqual([]);
  });
});

describe("superadministrador", () => {
  it("no ve la contabilidad de las empresas sin autorización registrada", async () => {
    const e = await superadmin.from("empresas").select("id");
    expect(e.data).toEqual([]);
    const c = await superadmin.from("comprobantes").select("id").limit(1);
    expect(c.data).toEqual([]);
  });
});

describe("reglas contables en la base de datos", () => {
  it("rechaza un comprobante que no cuadra", async () => {
    const { data: cuentas } = await ana.from("plan_cuentas").select("id, codigo").eq("empresa_id", DEMO.empresas.consultora).in("codigo", ["1.1.01.001", "5.1.01.002"]);
    const [a, b] = cuentas!;
    const r = await ana.rpc("guardar_comprobante", {
      p_empresa: DEMO.empresas.consultora, p_id: null, p_tipo: "traspaso", p_fecha: "2026-10-20", p_glosa: "prueba",
      p_lineas: [{ cuenta_id: a.id, debe: 1000, haber: 0 }, { cuenta_id: b.id, debe: 0, haber: 999 }],
    });
    expect(r.error?.message).toMatch(/no cuadra/);
  });
  it("rechaza comprobantes en un mes cerrado", async () => {
    const { data: cuentas } = await ana.from("plan_cuentas").select("id").eq("empresa_id", DEMO.empresas.consultora).in("codigo", ["1.1.01.001", "5.1.01.002"]);
    const r = await ana.rpc("guardar_comprobante", {
      p_empresa: DEMO.empresas.consultora, p_id: null, p_tipo: "traspaso", p_fecha: "2026-09-10", p_glosa: "en mes cerrado",
      p_lineas: [{ cuenta_id: cuentas![0].id, debe: 1000, haber: 0 }, { cuenta_id: cuentas![1].id, debe: 0, haber: 1000 }],
    });
    expect(r.error?.message).toMatch(/cerrado/);
  });
  it("reabrir exige un motivo", async () => {
    const r = await ana.rpc("reabrir_periodo", { p_empresa: DEMO.empresas.consultora, p_anio: 2026, p_mes: 9, p_motivo: "corto" });
    expect(r.error?.message).toMatch(/motivo/);
  });
  it("registra en auditoría los cambios de empresas", async () => {
    await ana.from("empresas").update({ giro: "Asesoría y consultoría (prueba)" }).eq("id", DEMO.empresas.consultora);
    const { data } = await ana.from("auditoria").select("accion, tabla, detalle").eq("tabla", "empresas").eq("accion", "update").order("created_at", { ascending: false }).limit(1);
    expect(data?.[0]?.detalle).toHaveProperty("giro");
    await ana.from("empresas").update({ giro: "Servicios de asesoría y consultoría" }).eq("id", DEMO.empresas.consultora);
  });
});
