// Perfil de ejemplo: Estudio Contable Demo (todo ficticio).
// Uso: npm run seed:demo
// Se puede volver a correr: borra el estudio demo y lo crea de nuevo, siempre igual.
import { createClient } from "@supabase/supabase-js";
import { DEMO } from "../src/lib/demo";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (ver .env.example).");
  process.exit(1);
}
const db = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function revisar<T = any>(r: { data: unknown; error: { message: string } | null }, que: string): T {
  if (r.error) throw new Error(`${que}: ${r.error.message}`);
  return r.data as T;
}

// ---------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------
async function asegurarUsuario(u: { id: string; rut: string; nombre: string; correo: string }, requiere2fa: boolean) {
  const existente = await db.auth.admin.getUserById(u.id);
  if (existente.data.user) {
    // Limpia factores de 2FA y deja la clave del demo.
    const factores = await db.auth.admin.mfa.listFactors({ userId: u.id });
    for (const f of factores.data?.factors ?? []) await db.auth.admin.mfa.deleteFactor({ userId: u.id, id: f.id });
    revisar(await db.auth.admin.updateUserById(u.id, { email: u.correo, password: DEMO.clave, email_confirm: true }), "actualizar usuario");
  } else {
    revisar(
      await db.auth.admin.createUser({ id: u.id, email: u.correo, password: DEMO.clave, email_confirm: true }),
      `crear usuario ${u.nombre}`,
    );
  }
  revisar(
    await db.from("usuarios").upsert({
      id: u.id, rut: u.rut, nombre: u.nombre, correo: u.correo, requiere_2fa: requiere2fa, es_superadmin: false,
    }),
    "perfil",
  );
}

// ---------------------------------------------------------------------
// Comprobantes de ejemplo
// ---------------------------------------------------------------------
type Linea = [codigo: string, debe: number, haber: number, glosa?: string];
type Comprobante = { tipo: "ingreso" | "egreso" | "traspaso" | "apertura"; fecha: string; glosa: string; lineas: Linea[] };

// Tasa usada SOLO para inventar montos de ejemplo coherentes. Los cálculos reales de IVA
// usarán la tabla de parámetros legales (Fase 4).
const IVA_EJEMPLO = 0.19;
const iva = (neto: number) => Math.round(neto * IVA_EJEMPLO);

/** Varía un monto base de forma fija según el mes (para que los meses no sean idénticos). */
const variar = (base: number, mes: number, k = 1) => Math.round((base * (1 + ((mes * 7 + k * 3) % 11 - 5) / 50)) / 10) * 10;

function movimientosAlmacen(mes: number): Comprobante[] {
  const f = (d: number) => `2026-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const ventas = variar(6_200_000, mes);
  const compras = variar(5_100_000, mes, 2); // mucho crédito: compra casi tanto como vende
  const arriendo = 650_000;
  const luz = variar(118_000, mes, 3);
  const sueldos = 1_090_000;
  return [
    { tipo: "ingreso", fecha: f(15), glosa: "Ventas con boleta primera quincena", lineas: [
      ["1.1.01.001", Math.round((ventas + iva(ventas)) / 2), 0],
      ["5.1.01.004", 0, Math.round(ventas / 2)],
      ["2.1.04.001", 0, Math.round((ventas + iva(ventas)) / 2) - Math.round(ventas / 2)],
    ] },
    { tipo: "ingreso", fecha: f(28), glosa: "Ventas con boleta segunda quincena", lineas: [
      ["1.1.01.001", ventas + iva(ventas) - Math.round((ventas + iva(ventas)) / 2), 0],
      ["5.1.01.004", 0, ventas - Math.round(ventas / 2)],
      ["2.1.04.001", 0, iva(ventas) - (Math.round((ventas + iva(ventas)) / 2) - Math.round(ventas / 2))],
    ] },
    { tipo: "traspaso", fecha: f(10), glosa: "Compra de mercaderías a Distribuidora Sur (factura ficticia)", lineas: [
      ["1.1.04.001", compras, 0], ["1.1.05.001", iva(compras), 0], ["2.1.02.001", 0, compras + iva(compras)],
    ] },
    { tipo: "egreso", fecha: f(20), glosa: "Pago a proveedores", lineas: [
      ["2.1.02.001", compras + iva(compras), 0], ["1.1.01.003", 0, compras + iva(compras)],
    ] },
    { tipo: "traspaso", fecha: f(29), glosa: "Depósito de caja en banco", lineas: [
      ["1.1.01.003", ventas, 0], ["1.1.01.001", 0, ventas],
    ] },
    { tipo: "egreso", fecha: f(5), glosa: "Arriendo del local", lineas: [
      ["4.2.02.001", arriendo, 0], ["1.1.01.003", 0, arriendo],
    ] },
    { tipo: "egreso", fecha: f(12), glosa: "Cuenta de luz", lineas: [
      ["4.2.02.002", luz, 0], ["1.1.01.003", 0, luz],
    ] },
    { tipo: "traspaso", fecha: f(30), glosa: "Costo de venta del mes", lineas: [
      ["4.1.01.001", Math.round(compras * 0.92), 0], ["1.1.04.001", 0, Math.round(compras * 0.92)],
    ] },
    { tipo: "egreso", fecha: f(30), glosa: "Pago de remuneraciones (2 trabajadores)", lineas: [
      ["4.2.01.001", sueldos, 0], ["1.1.01.003", 0, sueldos],
    ] },
  ];
}

function movimientosTransportes(mes: number): Comprobante[] {
  const f = (d: number) => `2026-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const fletes = variar(14_500_000, mes);
  const combustible = variar(3_900_000, mes, 4);
  const mantencion = variar(820_000, mes, 5);
  const sueldos = 5_350_000;
  const leasing = 1_250_000;
  return [
    { tipo: "traspaso", fecha: f(25), glosa: "Facturación de fletes del mes", lineas: [
      ["1.1.03.001", fletes + iva(fletes), 0], ["5.1.01.002", 0, fletes], ["2.1.04.001", 0, iva(fletes)],
    ] },
    { tipo: "ingreso", fecha: f(28), glosa: "Cobranza a clientes", lineas: [
      ["1.1.01.003", Math.round((fletes + iva(fletes)) * 0.8), 0], ["1.1.03.001", 0, Math.round((fletes + iva(fletes)) * 0.8)],
    ] },
    { tipo: "egreso", fecha: f(8), glosa: "Combustible del mes (tarjeta de flota)", lineas: [
      ["4.1.01.003", combustible, 0], ["1.1.05.001", iva(combustible), 0], ["1.1.01.003", 0, combustible + iva(combustible)],
    ] },
    { tipo: "egreso", fecha: f(14), glosa: "Mantención de camiones", lineas: [
      ["4.2.02.005", mantencion, 0], ["1.1.05.001", iva(mantencion), 0], ["1.1.01.003", 0, mantencion + iva(mantencion)],
    ] },
    { tipo: "egreso", fecha: f(5), glosa: "Cuota préstamo camión", lineas: [
      ["2.2.01.001", leasing - 180_000, 0], ["4.3.01.001", 180_000, 0], ["1.1.01.003", 0, leasing],
    ] },
    { tipo: "traspaso", fecha: f(30), glosa: "Remuneraciones del mes (5 trabajadores)", lineas: [
      ["4.2.01.001", sueldos, 0], ["2.1.03.001", 0, sueldos],
    ] },
    { tipo: "egreso", fecha: f(30), glosa: "Pago de remuneraciones", lineas: [
      ["2.1.03.001", sueldos, 0], ["1.1.01.003", 0, sueldos],
    ] },
  ];
}

function movimientosConsultora(mes: number): Comprobante[] {
  const f = (d: number) => `2026-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const exentas = variar(4_800_000, mes);
  const afectas = variar(1_900_000, mes, 6);
  const honorarios = variar(1_600_000, mes, 7);
  const retencion = Math.round(honorarios * 0.1525); // solo ejemplo; la tasa real va en parámetros
  return [
    { tipo: "traspaso", fecha: f(26), glosa: "Facturas exentas de asesoría", lineas: [
      ["1.1.03.001", exentas, 0], ["5.1.01.003", 0, exentas],
    ] },
    { tipo: "traspaso", fecha: f(27), glosa: "Facturas afectas de capacitación", lineas: [
      ["1.1.03.001", afectas + iva(afectas), 0], ["5.1.01.002", 0, afectas], ["2.1.04.001", 0, iva(afectas)],
    ] },
    { tipo: "ingreso", fecha: f(29), glosa: "Cobranza a clientes", lineas: [
      ["1.1.01.003", exentas, 0], ["1.1.03.001", 0, exentas],
    ] },
    { tipo: "traspaso", fecha: f(30), glosa: "Boletas de honorarios recibidas", lineas: [
      ["4.2.01.007", honorarios, 0], ["2.1.04.003", 0, retencion], ["2.1.02.004", 0, honorarios - retencion],
    ] },
    { tipo: "egreso", fecha: f(30), glosa: "Pago de honorarios líquidos", lineas: [
      ["2.1.02.004", honorarios - retencion, 0], ["1.1.01.003", 0, honorarios - retencion],
    ] },
    { tipo: "egreso", fecha: f(6), glosa: "Arriendo de oficina", lineas: [
      ["4.2.02.001", 780_000, 0], ["1.1.01.003", 0, 780_000],
    ] },
  ];
}

const APERTURAS: Record<string, Linea[]> = {
  almacen: [
    ["1.1.01.001", 350_000, 0], ["1.1.01.003", 4_800_000, 0], ["1.1.04.001", 6_200_000, 0],
    ["1.2.01.005", 2_400_000, 0], ["2.1.02.001", 0, 1_950_000], ["3.1.01.001", 0, 10_000_000],
    ["3.1.02.001", 0, 1_800_000],
  ],
  transportes: [
    ["1.1.01.003", 12_500_000, 0], ["1.1.03.001", 9_800_000, 0], ["1.2.01.004", 98_000_000, 0],
    ["1.2.01.009", 0, 21_000_000], ["2.2.01.001", 0, 38_000_000], ["2.1.02.001", 0, 2_300_000],
    ["3.1.01.001", 0, 50_000_000], ["3.1.02.001", 0, 9_000_000],
  ],
  consultora: [
    ["1.1.01.003", 7_400_000, 0], ["1.1.03.001", 3_100_000, 0], ["1.2.01.006", 3_500_000, 0],
    ["3.1.01.001", 0, 5_000_000], ["3.1.02.001", 0, 9_000_000],
  ],
};

async function crearComprobantes(empresaId: string, comprobantes: Comprobante[]) {
  const cuentas = revisar<{ id: string; codigo: string }[]>(await db.from("plan_cuentas").select("id, codigo").eq("empresa_id", empresaId), "cuentas");
  const idCuenta = new Map(cuentas!.map((c) => [c.codigo, c.id]));
  // Número correlativo por año, en orden de fecha.
  const ordenados = [...comprobantes].sort((a, b) => a.fecha.localeCompare(b.fecha));
  let numero = 0;
  for (const c of ordenados) {
    numero++;
    const debe = c.lineas.reduce((s, l) => s + l[1], 0);
    const haber = c.lineas.reduce((s, l) => s + l[2], 0);
    if (debe !== haber) throw new Error(`Comprobante de ejemplo no cuadra: ${c.glosa} (${debe} vs ${haber})`);
    const cab = revisar<{ id: string }>(
      await db.from("comprobantes").insert({
        estudio_id: DEMO.estudio.id, empresa_id: empresaId, numero, tipo: c.tipo, fecha: c.fecha,
        glosa: c.glosa, total_debe: debe, total_haber: haber, created_by: DEMO.ana.id,
      }).select("id").single(),
      "comprobante",
    );
    revisar(
      await db.from("lineas_comprobante").insert(
        c.lineas.map((l, i) => {
          const cuenta = idCuenta.get(l[0]);
          if (!cuenta) throw new Error(`Cuenta ${l[0]} no existe`);
          return {
            estudio_id: DEMO.estudio.id, empresa_id: empresaId, comprobante_id: cab!.id, orden: i + 1,
            cuenta_id: cuenta, debe: l[1], haber: l[2], glosa: l[3] ?? null,
          };
        }),
      ),
      "líneas",
    );
  }
  return numero;
}

// ---------------------------------------------------------------------
// Programa principal
// ---------------------------------------------------------------------
async function main() {
  console.log("Preparando el Estudio Contable Demo…");

  // 1. Borrar el demo anterior (reabriendo periodos para que el bloqueo permita borrar).
  await db.from("periodos").update({ estado: "abierto" }).eq("estudio_id", DEMO.estudio.id);
  revisar(await db.from("comprobantes").delete().eq("estudio_id", DEMO.estudio.id), "borrar comprobantes demo");
  revisar(await db.from("estudios").delete().eq("id", DEMO.estudio.id), "borrar estudio demo");
  await db.from("auditoria").delete().eq("estudio_id", DEMO.estudio.id);

  // 2. Usuarios (2FA desactivado solo en el demo).
  await asegurarUsuario(DEMO.ana, false);
  await asegurarUsuario(DEMO.luis, false);
  await asegurarUsuario(DEMO.visitante, false);

  // 3. Estudio y empresas.
  revisar(await db.from("estudios").insert({
    id: DEMO.estudio.id, nombre: DEMO.estudio.nombre, rut: DEMO.estudio.rut, es_demo: true, created_by: DEMO.ana.id,
  }), "estudio");

  const empresas = [
    {
      id: DEMO.empresas.almacen, rut: "76111222-8", razon_social: "Almacén Don Pepe SpA", nombre_fantasia: "Almacén Don Pepe",
      giro: "Venta al por menor en almacenes de barrio", actividades_economicas: ["472101"],
      direccion: "Av. Ficticia 123", comuna: "Maipú", representante_legal: "José Pérez Demo", rut_representante: "13444555-6",
      regimen: "propyme_transparente", inicio_actividades: "2019-03-01", tasa_ppm: 0.25, emite_factura_electronica: true,
      organismo_16744: "ISL", tasa_cotizacion_adicional: 0, caja_compensacion: null,
      contacto_nombre: "José Pérez Demo", contacto_correo: "contacto@almacendonpepe.demo", contacto_whatsapp: "56900000001",
    },
    {
      id: DEMO.empresas.transportes, rut: "77222333-1", razon_social: "Transportes Cordillera Ltda.", nombre_fantasia: "Transportes Cordillera",
      giro: "Transporte de carga por carretera", actividades_economicas: ["492300"],
      direccion: "Camino Interior 4500", comuna: "Quilicura", representante_legal: "María Soto Demo", rut_representante: "14777666-7",
      regimen: "propyme_general", inicio_actividades: "2015-07-15", tasa_ppm: 1.0, emite_factura_electronica: true,
      organismo_16744: "Mutual de Seguridad", tasa_cotizacion_adicional: 1.7, caja_compensacion: "Caja Demo",
      contacto_nombre: "María Soto Demo", contacto_correo: "administracion@cordillera.demo", contacto_whatsapp: "56900000002",
    },
    {
      id: DEMO.empresas.consultora, rut: "76333444-9", razon_social: "Consultora Andes SpA", nombre_fantasia: "Consultora Andes",
      giro: "Servicios de asesoría y consultoría", actividades_economicas: ["702000"],
      direccion: "Calle Imaginaria 77, of. 501", comuna: "Providencia", representante_legal: "Pedro Rojas Demo", rut_representante: "17888999-0",
      regimen: "propyme_general", inicio_actividades: "2021-01-04", tasa_ppm: 0.75, emite_factura_electronica: true,
      organismo_16744: "ISL", tasa_cotizacion_adicional: 0, caja_compensacion: null,
      contacto_nombre: "Pedro Rojas Demo", contacto_correo: "pedro@consultoraandes.demo", contacto_whatsapp: "56900000003",
    },
  ];
  revisar(await db.from("empresas").insert(empresas.map((e) => ({ ...e, estudio_id: DEMO.estudio.id, created_by: DEMO.ana.id }))), "empresas");

  // 4. Membresías: Ana contadora; Luis asistente solo de remuneraciones; visitante solo lectura.
  revisar(await db.from("membresias").insert([
    { usuario_id: DEMO.ana.id, estudio_id: DEMO.estudio.id, rol: "contador", permisos: {}, created_by: DEMO.ana.id },
    { usuario_id: DEMO.visitante.id, estudio_id: DEMO.estudio.id, rol: "lector", permisos: {}, created_by: DEMO.ana.id },
    ...[DEMO.empresas.almacen, DEMO.empresas.transportes].map((empresa_id) => ({
      usuario_id: DEMO.luis.id, estudio_id: DEMO.estudio.id, empresa_id, rol: "asistente",
      permisos: { contabilidad: false, libros: false, impuestos: false, remuneraciones: true, documentos: false },
      created_by: DEMO.ana.id,
    })),
  ]), "membresías");

  // 5. Plan de cuentas desde la plantilla, comprobantes de agosto a octubre de 2026.
  const plantilla = revisar<Record<string, unknown>[]>(await db.from("plan_cuentas_plantilla").select("*"), "plantilla")!;
  const generadores: Record<string, (mes: number) => Comprobante[]> = {
    almacen: movimientosAlmacen, transportes: movimientosTransportes, consultora: movimientosConsultora,
  };
  for (const [clave, empresaId] of Object.entries(DEMO.empresas)) {
    revisar(await db.from("plan_cuentas").insert(
      plantilla.map((c) => ({ ...c, estudio_id: DEMO.estudio.id, empresa_id: empresaId, created_by: DEMO.ana.id })),
    ), "plan de cuentas");
    revisar(await db.from("centros_costo").insert([
      { estudio_id: DEMO.estudio.id, empresa_id: empresaId, codigo: "ADM", nombre: "Administración", created_by: DEMO.ana.id },
      { estudio_id: DEMO.estudio.id, empresa_id: empresaId, codigo: "OPE", nombre: "Operaciones", created_by: DEMO.ana.id },
    ]), "centros de costo");

    const comprobantes: Comprobante[] = [
      { tipo: "apertura", fecha: "2026-08-01", glosa: "Saldos iniciales (migración desde sistema anterior)", lineas: APERTURAS[clave] },
      ...[8, 9, 10].flatMap((mes) => generadores[clave](mes)),
    ];
    const n = await crearComprobantes(empresaId, comprobantes);

    // Agosto y septiembre cerrados; octubre abierto.
    revisar(await db.from("periodos").insert([
      { estudio_id: DEMO.estudio.id, empresa_id: empresaId, anio: 2026, mes: 8, estado: "cerrado", cerrado_at: "2026-09-12T15:00:00Z", cerrado_por: DEMO.ana.id, created_by: DEMO.ana.id },
      { estudio_id: DEMO.estudio.id, empresa_id: empresaId, anio: 2026, mes: 9, estado: "cerrado", cerrado_at: "2026-10-14T15:00:00Z", cerrado_por: DEMO.ana.id, created_by: DEMO.ana.id },
      { estudio_id: DEMO.estudio.id, empresa_id: empresaId, anio: 2026, mes: 10, estado: "abierto", created_by: DEMO.ana.id },
    ]), "periodos");
    console.log(`  ${clave}: ${plantilla.length} cuentas, ${n} comprobantes`);
  }

  console.log("Listo. Ingresa con RUT 15.111.222-6 y clave Demo1234 (Ana Demo).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
