// Previsualización de las Fases 1 a 8: capturas (escritorio 1440×900 y celular 390×844), index.html,
// video del recorrido y archivos de ejemplo. Cada fase queda en previews/fase-N/.
//
// Requisitos: Supabase local con el demo cargado y la app corriendo en BASE_URL (ideal: npm run build && npm start).
// El script vuelve a cargar el demo al empezar (npm run seed:demo) para partir siempre igual.
// Para las pantallas del superadministrador define PREVIEW_SUPERADMIN_RUT y PREVIEW_SUPERADMIN_CLAVE
// (un superadministrador LOCAL de prueba, sin 2FA). Sin ellas, esas capturas se omiten.
//
// Uso: npm run previews            (todas)   ·   npm run previews -- 5 6   (solo fases 5 y 6)
import { chromium, devices } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { mkdir, rm, rename, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const raiz = path.resolve(import.meta.dirname, "../..");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const E = { almacen: "00000000-0000-4000-8000-0000000000e1", transportes: "00000000-0000-4000-8000-0000000000e2", consultora: "00000000-0000-4000-8000-0000000000e3" };
const USUARIOS = {
  ana: { rut: "15111222-6", clave: "Demo1234", inicio: "/mi-mes" },
  luis: { rut: "16222333-K", clave: "Demo1234", inicio: "/mi-mes" },
  cliente: { rut: "13444555-6", clave: "Demo1234", inicio: "/portal" },
  superadmin: process.env.PREVIEW_SUPERADMIN_RUT ? { rut: process.env.PREVIEW_SUPERADMIN_RUT, clave: process.env.PREVIEW_SUPERADMIN_CLAVE, inicio: "/admin" } : null,
  marta: { rut: "14555666-K", clave: "Prueba1234", inicio: "/mi-mes" },
};
const ESTUDIO_NUEVO = "Contadores del Sur (ejemplo)";
const CORREO_MARTA = "marta.ejemplo@demo.rhsoftware.cl";

const ESCRITORIO = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "es-CL", timezoneId: "America/Santiago", acceptDownloads: true };
const CELULAR = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "es-CL", timezoneId: "America/Santiago" };

const navegador = await chromium.launch();
const sesiones = new Map();

async function ingresar(ctx, u) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/ingresar`);
  await p.fill("#rut", u.rut);
  await p.fill("#clave", u.clave);
  await p.click("button[type=submit]");
  await p.waitForURL(`**${u.inicio}`, { timeout: 60_000 });
  await p.close();
}

/** Contexto con sesión iniciada (se guarda el estado para no ingresar en cada captura). */
async function contexto(usuario, celular = false, extra = {}) {
  const clave = `${usuario}-${celular}`;
  let estado = sesiones.get(clave);
  if (usuario && !estado) {
    const c = await navegador.newContext(celular ? CELULAR : ESCRITORIO);
    await ingresar(c, USUARIOS[usuario]);
    estado = await c.storageState();
    sesiones.set(clave, estado);
    await c.close();
  }
  return navegador.newContext({ ...(celular ? CELULAR : ESCRITORIO), ...(estado ? { storageState: estado } : {}), ...extra });
}

const irA = (ruta, empresa, periodo) =>
  empresa ? `${BASE}/ir?empresa=${E[empresa]}&periodo=${periodo ?? "2026-10"}&a=${encodeURIComponent(ruta)}` : `${BASE}${ruta}`;

async function listo(p) {
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
}

/** Toma una captura. s = { archivo, ruta, usuario, empresa, periodo, celular, completa, antes(p), texto }. */
async function capturar(salida, s) {
  const ctx = await contexto(s.usuario, s.celular);
  const p = await ctx.newPage();
  try {
    if (s.ruta) { await p.goto(irA(s.ruta, s.empresa, s.periodo)); await listo(p); }
    if (s.antes) { await s.antes(p); await listo(p); }
    await p.screenshot({ path: path.join(salida, s.archivo), fullPage: !!s.completa });
    console.log(`  ✓ ${s.archivo}`);
    return true;
  } catch (e) {
    console.log(`  ✗ ${s.archivo}: ${e.message.split("\n")[0]}`);
    return false;
  } finally {
    await ctx.close();
  }
}

/** Descarga un archivo con la sesión de un usuario (empresa y periodo elegidos). */
async function descargar(salida, { usuario, empresa, periodo, url, nombre }) {
  const ctx = await contexto(usuario);
  const p = await ctx.newPage();
  await p.goto(irA("/mi-mes", empresa, periodo)); await listo(p);
  const r = await p.request.get(BASE + url);
  const cuerpo = await r.body();
  const disp = r.headers()["content-disposition"] ?? "";
  const archivo = nombre ?? (disp.match(/filename="([^"]+)"/)?.[1] ?? path.basename(url));
  await mkdir(path.join(salida, "archivos"), { recursive: true });
  await writeFile(path.join(salida, "archivos", archivo), cuerpo);
  await ctx.close();
  console.log(`  ↓ archivos/${archivo} (${r.status()})`);
  return { archivo, estado: r.status(), cuerpo };
}

/** Video del recorrido: visita las rutas en orden con pausas (pasos = [{ ruta, empresa, periodo, accion(p), usuario }]). */
async function grabar(salida, usuario, pasos, celular = false) {
  const carpeta = path.join(salida, "_video");
  const ctx = await contexto(usuario, celular, { recordVideo: { dir: carpeta, size: celular ? { width: 390, height: 844 } : { width: 1440, height: 900 } } });
  const p = await ctx.newPage();
  for (const paso of pasos) {
    try {
      if (paso.ruta) { await p.goto(irA(paso.ruta, paso.empresa, paso.periodo)); await listo(p); }
      await p.waitForTimeout(1200);
      if (paso.accion) { await paso.accion(p); await listo(p); await p.waitForTimeout(1200); }
      for (let i = 0; i < (paso.bajar ?? 0); i++) { await p.mouse.wheel(0, 350); await p.waitForTimeout(450); }
    } catch (e) { console.log(`  (video) ${paso.ruta}: ${e.message.split("\n")[0]}`); }
  }
  await ctx.close();
  const [video] = await readdir(carpeta);
  await rename(path.join(carpeta, video), path.join(salida, "recorrido.webm"));
  await rm(carpeta, { recursive: true, force: true });
  console.log("  ▶ recorrido.webm");
}

function pagina(fase, titulo, resumen, pantallas, archivos, verificar) {
  const tarjetas = pantallas.map((s, i) => `
    <figure>
      <figcaption><span class="n">${i + 1}</span> ${s.texto}</figcaption>
      <a href="${s.archivo}"><img src="${s.archivo}" alt="${s.archivo}" loading="lazy" class="${s.celular ? "cel" : ""}"></a>
    </figure>`).join("");
  const listaArchivos = archivos.length ? `<h2>Archivos de ejemplo generados</h2><ul>${archivos.map((a) => `<li><a href="archivos/${a.archivo}">${a.archivo}</a> — ${a.texto}</li>`).join("")}</ul>` : "";
  const listaVerificar = verificar.length ? `<h2>Qué debe verificar la socia contadora</h2><ol>${verificar.map((v) => `<li>${v}</li>`).join("")}</ol>` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RH Software · Fase ${fase}</title>
<style>
  :root{--azul:#1E3A8A;--verde:#059669;--celeste:#DBEAFE;--texto:#111827;--suave:#4B5563;--fondo:#F9FAFB}
  body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--fondo);color:var(--texto)}
  header{background:var(--azul);color:#fff;padding:24px 32px} header h1{margin:0;font-size:26px} header p{margin:6px 0 0;opacity:.9;max-width:900px}
  main{max-width:1200px;margin:0 auto;padding:24px 32px}
  h2{color:var(--azul);margin-top:32px}
  figure{background:#fff;border:1px solid #E5E7EB;border-radius:10px;margin:0 0 24px;padding:16px}
  figcaption{font-size:15px;margin-bottom:12px;line-height:1.5} .n{display:inline-block;background:var(--azul);color:#fff;border-radius:999px;width:24px;height:24px;text-align:center;line-height:24px;font-size:13px;margin-right:6px}
  img{width:100%;border:1px solid #E5E7EB;border-radius:6px} img.cel{width:auto;max-width:390px;max-height:844px}
  video{width:100%;border-radius:8px;border:1px solid #E5E7EB;background:#000}
  li{margin:6px 0;line-height:1.5} a{color:var(--azul)}
  .nav{margin-top:12px} .nav a{color:#fff;margin-right:14px;font-size:14px}
</style></head><body>
<header><h1>Fase ${fase}: ${titulo}</h1><p>${resumen}</p>
<div class="nav">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<a href="../fase-${n}/index.html">Fase ${n}</a>`).join("")}</div></header>
<main>
<h2>Recorrido en video</h2><video src="recorrido.webm" controls preload="metadata"></video>
<h2>Pantallas en orden de uso</h2>${tarjetas}
${listaArchivos}${listaVerificar}
</main></body></html>`;
}

async function fase(n, def) {
  const salida = path.join(raiz, `previews/fase-${n}`);
  await rm(salida, { recursive: true, force: true });
  await mkdir(salida, { recursive: true });
  console.log(`Fase ${n}: ${def.titulo}`);
  const hechas = [];
  for (const s of def.pantallas) if (s.usuario !== "superadmin" || USUARIOS.superadmin) if (await capturar(salida, s)) hechas.push(s);
  const archivos = [];
  for (const a of def.archivos ?? []) {
    try { const r = await descargar(salida, a); archivos.push({ archivo: r.archivo, texto: a.texto }); if (a.despues) await a.despues(r, salida, archivos); }
    catch (e) { console.log(`  ✗ archivo ${a.url}: ${e.message}`); }
  }
  if (def.extra) await def.extra(salida, archivos);
  await grabar(salida, def.video.usuario, def.video.pasos, def.video.celular);
  await writeFile(path.join(salida, "index.html"), pagina(n, def.titulo, def.resumen, hechas, archivos, def.verificar ?? []));
}

// ---------------------------------------------------------------------------------------------
// Preparación: demo limpio, y el estudio nuevo de la Fase 8 se borra para registrarlo de nuevo.
// ---------------------------------------------------------------------------------------------
console.log("Cargando el demo…");
execSync("npm run seed:demo", { cwd: raiz, stdio: "ignore" });
{
  const { data } = await db.from("usuarios").select("id").eq("rut", USUARIOS.marta.rut).maybeSingle();
  if (data) { await db.from("estudios").delete().eq("created_by", data.id); await db.auth.admin.deleteUser(data.id); }
  await db.from("intentos_login").delete().eq("rut", "registro");
}

const FASES = {
  1: {
    titulo: "Cuentas, multiempresa y seguridad",
    resumen: "Inicio de sesión con RUT, segundo factor, estudios y empresas, roles y permisos, selector de empresa y periodo (Ctrl+K), auditoría, páginas legales y el estudio de ejemplo.",
    pantallas: [
      { archivo: "01-ingresar.png", ruta: "/ingresar", texto: "Ingreso con RUT y clave. Prueba con el RUT 15.111.222-6 y la clave Demo1234 (Ana, contadora del demo)." },
      { archivo: "02-ingresar-error.png", ruta: "/ingresar", antes: async (p) => { await p.fill("#rut", "15111222-6"); await p.fill("#clave", "equivocada"); await p.click("button[type=submit]"); await p.waitForSelector("text=RUT o clave incorrectos"); }, texto: "Estado de error: clave equivocada. El mensaje no revela si el RUT existe. Después de 5 intentos se bloquea 15 minutos." },
      { archivo: "03-ingresar-rut-invalido.png", ruta: "/ingresar", antes: async (p) => { await p.fill("#rut", "15111222-5"); await p.fill("#clave", "x"); await p.click("button[type=submit]"); await p.waitForTimeout(800); }, texto: "El RUT se valida con dígito verificador (módulo 11) antes de consultar." },
      { archivo: "04-mi-mes.png", usuario: "ana", ruta: "/mi-mes", texto: "Al entrar, Ana ve el panel “Mi mes” con sus 3 empresas. El selector de empresa (arriba a la izquierda) y el periodo siempre están visibles." },
      { archivo: "05-selector-ctrl-k.png", usuario: "ana", ruta: "/mi-mes", antes: async (p) => { await p.keyboard.press("Control+k"); await p.waitForTimeout(400); await p.keyboard.type("cord"); await p.waitForTimeout(400); }, texto: "Ctrl+K abre el buscador de empresas: escribe parte del nombre o del RUT y Enter para cambiar en un segundo." },
      { archivo: "06-empresas.png", usuario: "ana", ruta: "/empresas", texto: "Empresas del estudio con su RUT, régimen y estado. Se pueden crear de a una o en lote desde Excel." },
      { archivo: "07-ficha-empresa.png", usuario: "ana", ruta: `/empresas/${E.transportes}`, completa: true, texto: "Ficha de la empresa: régimen tributario, PPM, mutual o ISL, caja de compensación, contacto de WhatsApp y correo." },
      { archivo: "08-usuarios-permisos.png", usuario: "ana", ruta: "/estudio/usuarios", completa: true, texto: "Usuarios y permisos: Luis es asistente solo de remuneraciones en 2 empresas; José Pérez es cliente del Almacén (portal)." },
      { archivo: "09-auditoria.png", usuario: "ana", ruta: "/estudio/auditoria", texto: "Auditoría: quién hizo qué, cuándo y desde dónde (IP y navegador). No se puede borrar." },
      { archivo: "10-seguridad.png", usuario: "ana", ruta: "/cuenta/seguridad", texto: "Seguridad de la cuenta: segundo factor con app autenticadora (obligatorio para contadores y asistentes; desactivado solo en el demo)." },
      { archivo: "11-mis-datos.png", usuario: "ana", ruta: "/cuenta/mis-datos", texto: "“Mis datos” (Ley 21.719): exportar los datos personales y pedir su eliminación." },
      { archivo: "12-asistente.png", usuario: "luis", ruta: "/mi-mes", empresa: "transportes", texto: "Luis (asistente) solo ve el menú de Remuneraciones y solo sus 2 empresas. La base de datos lo impide aunque intente entrar por otra dirección." },
      { archivo: "13-demo-solo-lectura.png", ruta: "/demo", antes: async (p) => { await p.waitForURL("**/mi-mes", { timeout: 60_000 }); }, texto: "Botón “Ver demo” de la portada: entra al estudio de ejemplo en solo lectura, con la franja “Crear mi cuenta”." },
      { archivo: "14-privacidad.png", ruta: "/privacidad", texto: "Política de privacidad (BORRADOR, revisar con abogado antes de publicar)." },
      { archivo: "15-terminos.png", ruta: "/terminos", texto: "Términos de uso (BORRADOR): el contador revisa y responde por lo que declara." },
    ],
    video: { usuario: "ana", pasos: [{ ruta: "/mi-mes" }, { accion: async (p) => { await p.keyboard.press("Control+k"); await p.waitForTimeout(500); await p.keyboard.type("cord", { delay: 120 }); await p.waitForTimeout(600); await p.keyboard.press("Enter"); } }, { ruta: "/empresas" }, { ruta: "/estudio/usuarios", bajar: 2 }, { ruta: "/estudio/auditoria", bajar: 2 }] },
    verificar: ["Que los roles calcen con cómo trabaja el estudio (contador, asistente por módulo, cliente)."],
  },
  2: {
    titulo: "Contabilidad base",
    resumen: "Plan de cuentas (plantilla pyme e importación desde Excel), comprobantes con ingreso por teclado y validación debe = haber, libro diario, mayor, balance de 8 columnas, estado de resultados y cierre de periodo.",
    pantallas: [
      { archivo: "01-plan-de-cuentas.png", usuario: "ana", empresa: "almacen", ruta: "/contabilidad/plan-de-cuentas", texto: "Plan de cuentas: plantilla base para pymes chilenas, ajustable por empresa, importable desde Excel y copiable a otra empresa." },
      { archivo: "02-comprobantes.png", usuario: "ana", empresa: "almacen", ruta: "/contabilidad/comprobantes", texto: "Comprobantes del mes con totales siempre visibles, filtros, orden por columna y exportación a Excel." },
      { archivo: "03-comprobante-vacio.png", usuario: "ana", empresa: "almacen", ruta: "/contabilidad/comprobantes/nuevo", texto: "Nuevo comprobante (atajo Alt+N): Enter avanza de celda y la cuenta se busca escribiendo el código o el nombre." },
      { archivo: "04-comprobante-no-cuadra.png", usuario: "ana", empresa: "almacen", ruta: "/contabilidad/comprobantes/nuevo", antes: async (p) => {
          await p.keyboard.type("Venta con teclado"); await p.keyboard.press("Enter");
          await p.keyboard.type("caja"); await p.waitForTimeout(300); await p.keyboard.press("Enter"); await p.keyboard.press("Enter");
          await p.keyboard.type("119000"); await p.keyboard.press("Enter"); await p.keyboard.press("Enter");
          await p.keyboard.type("ventas"); await p.waitForTimeout(300); await p.keyboard.press("Enter"); await p.keyboard.press("Enter"); await p.keyboard.press("Enter");
          await p.keyboard.type("100000"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
        }, texto: "Estado de error: el comprobante no cuadra (falta el IVA). La diferencia se marca en rojo y no deja guardar." },
      { archivo: "05-comprobante-cuadra.png", usuario: "ana", empresa: "almacen", ruta: "/contabilidad/comprobantes/nuevo", antes: async (p) => {
          await p.keyboard.type("Venta con teclado"); await p.keyboard.press("Enter");
          await p.keyboard.type("caja"); await p.waitForTimeout(300); await p.keyboard.press("Enter"); await p.keyboard.press("Enter");
          await p.keyboard.type("119000"); await p.keyboard.press("Enter"); await p.keyboard.press("Enter");
          await p.keyboard.type("ventas"); await p.waitForTimeout(300); await p.keyboard.press("Enter"); await p.keyboard.press("Enter"); await p.keyboard.press("Enter");
          await p.keyboard.type("100000"); await p.keyboard.press("Enter"); await p.keyboard.press("Enter");
          await p.keyboard.type("iva debito"); await p.waitForTimeout(300); await p.keyboard.press("Enter"); await p.keyboard.press("Enter"); await p.keyboard.press("Enter");
          await p.keyboard.press("="); await p.waitForTimeout(400);
        }, texto: "Con la tecla “=” se completa la diferencia en la última línea: ahora cuadra y se guarda con Ctrl+S." },
      { archivo: "06-libro-diario.png", usuario: "ana", empresa: "almacen", ruta: "/contabilidad/libro-diario", texto: "Libro diario del mes, exportable a Excel y PDF." },
      { archivo: "07-libro-mayor.png", usuario: "ana", empresa: "almacen", ruta: "/contabilidad/libro-mayor", texto: "Libro mayor por cuenta con saldo acumulado." },
      { archivo: "08-balance-8-columnas.png", usuario: "ana", empresa: "almacen", ruta: "/contabilidad/balance", completa: true, texto: "Balance de 8 columnas (sumas, saldos, inventario y resultados) con totales que cuadran." },
      { archivo: "09-estado-resultados.png", usuario: "ana", empresa: "almacen", ruta: "/contabilidad/estado-resultados", texto: "Estado de resultados del periodo." },
      { archivo: "10-cierre.png", usuario: "ana", empresa: "almacen", ruta: "/contabilidad/cierre", texto: "Cierre de periodo: bloquea el mes. Reabrirlo exige un motivo, que queda en la auditoría." },
    ],
    video: { usuario: "ana", pasos: [{ ruta: "/contabilidad/comprobantes", empresa: "almacen" }, { ruta: "/contabilidad/comprobantes/nuevo", accion: async (p) => {
      for (const [t, enters] of [["Venta con teclado", 1], ["caja", 2], ["119000", 2], ["ventas", 3], ["100000", 2], ["iva debito", 3]]) { await p.keyboard.type(t, { delay: 60 }); await p.waitForTimeout(300); for (let i = 0; i < enters; i++) await p.keyboard.press("Enter"); }
      await p.keyboard.press("="); } }, { ruta: "/contabilidad/libro-diario" }, { ruta: "/contabilidad/balance", bajar: 3 }, { ruta: "/contabilidad/cierre" }] },
    verificar: ["La plantilla del plan de cuentas (códigos y nombres).", "El balance de 8 columnas y el estado de resultados del Almacén de octubre."],
  },
  3: {
    titulo: "Importar y exportar libros",
    resumen: "RCV del SII con subida múltiple (detecta empresa y periodo de cada archivo), honorarios, asistente de mapeo para Excel de otros softwares, cartolas y conciliación, centralizaciones automáticas y exportaciones (Excel, PDF, CSV del importador del SII y ZIP anual).",
    pantallas: [
      { archivo: "01-importar-vacio.png", usuario: "ana", empresa: "transportes", ruta: "/libros/importar", texto: "Importar del SII: arrastra varios archivos de varias empresas a la vez. RH Software detecta la empresa y el periodo de cada uno." },
      { archivo: "02-importar-revision.png", usuario: "ana", empresa: "transportes", ruta: "/libros/importar", antes: async (p) => {
          await p.setInputFiles("input[type=file]", ["RCV_COMPRA_REGISTRO_77222333-1_202610.csv", "RCV_VENTA_77222333-1_202610.csv", "RCV_COMPRA_REGISTRO_76111222-8_202610.csv"].map((f) => path.join(raiz, "demo/rcv", f)));
          await p.waitForTimeout(2500);
        }, texto: "Vista previa antes de guardar: empresa y periodo detectados, documentos nuevos y duplicados (por tipo, folio y RUT), y RUT inválidos marcados." },
      { archivo: "03-importar-exito.png", usuario: "ana", empresa: "transportes", ruta: "/libros/importar", antes: async (p) => {
          await p.setInputFiles("input[type=file]", ["RCV_COMPRA_REGISTRO_77222333-1_202610.csv", "RCV_VENTA_77222333-1_202610.csv"].map((f) => path.join(raiz, "demo/rcv", f)));
          await p.waitForTimeout(2500); await p.click('button:has-text("documentos nuevos")'); await p.waitForTimeout(3000);
        }, texto: "Éxito: los libros de octubre de Transportes Cordillera quedan importados." },
      { archivo: "04-libro-compras.png", usuario: "ana", empresa: "almacen", ruta: "/libros/compras", texto: "Libro de compras con totales, filtros y exportación (Excel, PDF, CSV y formato del importador del SII)." },
      { archivo: "05-libro-ventas.png", usuario: "ana", empresa: "almacen", ruta: "/libros/ventas", texto: "Libro de ventas (incluye el resumen de boletas del Almacén)." },
      { archivo: "06-honorarios.png", usuario: "ana", empresa: "consultora", ruta: "/libros/honorarios", texto: "Libro de honorarios recibidos de Consultora Andes, con la retención que va al F29." },
      { archivo: "07-mapeo-otros-softwares.png", usuario: "ana", empresa: "almacen", ruta: "/libros/mapeo", texto: "Asistente de mapeo: sube un Excel de otro software y dile qué columna es el folio, el neto… (con sugerencias de IA cuando se active la clave). El mapeo se guarda." },
      { archivo: "08-bancos-conciliacion.png", usuario: "ana", empresa: "almacen", ruta: "/bancos", completa: true, texto: "Cartolas y conciliación: pareos sugeridos automáticamente y diferencias marcadas." },
      { archivo: "09-centralizaciones.png", usuario: "ana", empresa: "almacen", ruta: "/contabilidad/centralizacion", texto: "Centralizaciones automáticas (compras, ventas, honorarios y remuneraciones) con cuentas configuradas una vez por empresa." },
    ],
    archivos: [
      { usuario: "ana", empresa: "almacen", url: "/exportar?que=compras&formato=xlsx", texto: "Libro de compras de octubre en Excel." },
      { usuario: "ana", empresa: "almacen", url: "/exportar?que=compras&formato=pdf", texto: "Libro de compras en PDF." },
      { usuario: "ana", empresa: "almacen", url: "/exportar?que=ventas&formato=sii", texto: "Libro de ventas en el CSV (punto y coma) del importador de libros del SII." },
      { usuario: "ana", empresa: "consultora", url: "/exportar?que=honorarios_recibidas&formato=xlsx", texto: "Libro de honorarios recibidos en Excel." },
      { usuario: "ana", empresa: "almacen", url: "/exportar/zip?anio=2026", texto: "Exportación completa del año en ZIP (respaldo o cambio de contador)." },
    ],
    video: { usuario: "ana", pasos: [{ ruta: "/libros/importar", empresa: "transportes", accion: async (p) => {
      await p.setInputFiles("input[type=file]", ["RCV_COMPRA_REGISTRO_77222333-1_202610.csv", "RCV_VENTA_77222333-1_202610.csv"].map((f) => path.join(raiz, "demo/rcv", f))); await p.waitForTimeout(2500); } },
      { ruta: "/libros/compras", empresa: "almacen", bajar: 2 }, { ruta: "/bancos", bajar: 3 }, { ruta: "/contabilidad/centralizacion" }] },
    verificar: ["Que el CSV del SII de prueba tenga las mismas columnas que los que ella descarga (comparar con un archivo real).", "Las cuentas de las centralizaciones."],
  },
  4: {
    titulo: "Impuestos y panel “Mi mes”",
    resumen: "Propuesta de F29 calculada desde los libros, lado a lado con la del SII y con las diferencias explicadas; calendario de vencimientos; panel “Mi mes” con semáforos y procesos masivos.",
    pantallas: [
      { archivo: "01-mi-mes.png", usuario: "ana", ruta: "/mi-mes", completa: true, texto: "“Mi mes”: todas las empresas con un semáforo por tarea (libros, comprobantes, F29, remuneraciones, Previred, LRE, documentos). Cada celda lleva a la tarea. Avisos útiles abajo." },
      { archivo: "02-mi-mes-masivo.png", usuario: "ana", ruta: "/mi-mes", antes: async (p) => { await p.click("text=Calcular F29 de todas mis empresas"); await p.waitForTimeout(6000); }, completa: true, texto: "Proceso masivo: “Calcular F29 de todas mis empresas” con barra de avance y resumen de errores por empresa." },
      { archivo: "03-f29.png", usuario: "ana", empresa: "almacen", ruta: "/impuestos/f29", completa: true, texto: "F29 del Almacén: IVA débito y crédito, remanente, PPM, retenciones e impuesto único, con “Ver cómo se calculó” y la propuesta del SII al lado." },
      { archivo: "04-f29-sin-libros.png", usuario: "ana", empresa: "transportes", ruta: "/impuestos/f29", texto: "Estado vacío / por revisar: Transportes aún no tiene F29 de octubre calculado." },
      { archivo: "05-calendario.png", usuario: "ana", ruta: "/impuestos/calendario", completa: true, texto: "Calendario tributario y laboral por empresa: F29, Previred, LRE y declaraciones juradas. Las fechas salen de la tabla de parámetros." },
    ],
    video: { usuario: "ana", pasos: [{ ruta: "/mi-mes", bajar: 2 }, { ruta: "/impuestos/f29", empresa: "almacen", bajar: 4 }, { ruta: "/impuestos/calendario", bajar: 2 }] },
    verificar: ["El cálculo del F29 del Almacén y de Consultora Andes de octubre (códigos y montos).", "Los días de vencimiento del F29 (20 con factura electrónica, 12 sin ella) y los feriados."],
  },
  5: {
    titulo: "Remuneraciones I",
    resumen: "Parámetros legales con fuente y vigencia, trabajadores, liquidaciones con “Ver cómo se calculó” en cada línea, proceso masivo con alertas y PDF de la liquidación.",
    pantallas: [
      { archivo: "01-parametros.png", usuario: "ana", empresa: "transportes", ruta: "/remuneraciones/parametros", completa: true, texto: "Parámetros legales: valor, vigencia, fuente oficial y estado (POR VERIFICAR hasta que la socia los revise)." },
      { archivo: "02-trabajadores.png", usuario: "ana", empresa: "transportes", ruta: "/remuneraciones/trabajadores", texto: "Trabajadores de Transportes Cordillera: los 5 casos de prueba (horas extra, licencia, Isapre en UF, plazo fijo, ingreso a mitad de mes)." },
      { archivo: "03-liquidaciones-por-calcular.png", usuario: "ana", empresa: "transportes", periodo: "2026-11", ruta: "/remuneraciones/liquidaciones", texto: "Estado vacío: noviembre aún no se calcula. Un botón calcula todas las liquidaciones de la empresa." },
      { archivo: "04-liquidaciones-calculadas.png", usuario: "ana", empresa: "transportes", periodo: "2026-11", ruta: "/remuneraciones/liquidaciones", antes: async (p) => { await p.click("text=Calcular liquidaciones del mes"); await p.waitForTimeout(6000); }, texto: "Éxito: liquidaciones calculadas con el resumen de alertas (por ejemplo, datos que faltan)." },
      { archivo: "05-liquidacion-detalle.png", usuario: "ana", empresa: "transportes", ruta: "/remuneraciones/liquidaciones", antes: async (p) => { await p.click('a:has-text("Manuel Demo")'); await p.waitForLoadState("networkidle"); await p.click('button:has-text("Impuesto único")'); await p.waitForTimeout(600); }, completa: true, texto: "Liquidación con “Ver cómo se calculó” abierto en el impuesto único: fórmula, parámetros con su vigencia y la fuente." },
      { archivo: "06-ficha-trabajador.png", usuario: "ana", empresa: "transportes", ruta: "/remuneraciones/trabajadores", antes: async (p) => {
          const { data } = await db.from("trabajadores").select("id").eq("empresa_id", E.transportes).eq("nombres", "Carla").single();
          await p.goto(`${BASE}/remuneraciones/trabajadores/${data.id}`);
        }, completa: true, texto: "Ficha del trabajador: AFP, salud, contrato, jornada, sueldo base y cargas." },
    ],
    archivos: [],
    extra: async (salida, archivos) => {
      const { data } = await db.from("liquidaciones").select("id, trabajadores(nombres)").eq("empresa_id", E.transportes).eq("anio", 2026).eq("mes", 10).limit(1).single();
      const r = await descargar(salida, { usuario: "ana", empresa: "transportes", url: `/remuneraciones/liquidaciones/${data.id}/pdf`, nombre: "liquidacion-ejemplo-octubre-2026.pdf" });
      archivos.push({ archivo: r.archivo, texto: "Liquidación de sueldo en PDF, lista para firmar." });
    },
    video: { usuario: "ana", pasos: [{ ruta: "/remuneraciones/liquidaciones", empresa: "transportes", periodo: "2026-10" }, { accion: async (p) => { await p.click('a:has-text("Manuel Demo")'); await p.waitForLoadState("networkidle"); await p.waitForTimeout(800); await p.click('button:has-text("Impuesto único")'); }, bajar: 3 }, { ruta: "/remuneraciones/parametros", bajar: 4 }] },
    verificar: ["Todos los parámetros marcados POR VERIFICAR (UF, UTM, topes, tasas AFP, SIS, Reforma de Pensiones, tabla del impuesto único, asignación familiar).", "Los casos de prueba de docs/remuneraciones/casos-de-prueba.md: cada liquidación debe cuadrar al peso con un cálculo hecho a mano o con un simulador oficial."],
  },
  6: {
    titulo: "Remuneraciones II",
    resumen: "Archivo Previred de 105 campos y LRE para la Dirección del Trabajo (validados campo por campo), centralización, vacaciones y licencias, finiquitos, contratos y certificados.",
    pantallas: [
      { archivo: "01-previred.png", usuario: "ana", empresa: "transportes", ruta: "/remuneraciones/previred", completa: true, texto: "Archivo Previred del mes: validación campo por campo antes de descargar (errores en rojo, avisos en ámbar)." },
      { archivo: "02-lre.png", usuario: "ana", empresa: "transportes", ruta: "/remuneraciones/lre", completa: true, texto: "Libro de Remuneraciones Electrónico para la carga masiva en Mi DT, con los códigos del manual de la DT." },
      { archivo: "03-vacaciones-licencias.png", usuario: "ana", empresa: "transportes", ruta: "/remuneraciones/ausencias", completa: true, texto: "Vacaciones (saldo y feriado progresivo) y licencias médicas." },
      { archivo: "04-finiquito.png", usuario: "ana", empresa: "transportes", ruta: "/remuneraciones/finiquitos", antes: async (p) => {
          await p.selectOption("select[name=trabajador_id]", { label: "Carla Demo" }); await p.waitForTimeout(1200);
          await p.fill("input[name=fecha_termino]", "2026-11-30"); await p.selectOption("select[name=causal]", "18");
          await p.click('button:has-text("Calcular")'); await p.waitForSelector("text=Total finiquito", { timeout: 30_000 });
        }, completa: true, texto: "Finiquito calculado: años de servicio, aviso previo y feriado proporcional según la causal. Siempre lo revisa el contador." },
      { archivo: "05-contratos-certificados.png", usuario: "ana", empresa: "transportes", ruta: "/remuneraciones/documentos", texto: "Contratos, anexos, cartas de aviso y certificados completados con la ficha (revisión del contador obligatoria)." },
    ],
    archivos: [
      { usuario: "ana", empresa: "almacen", url: "/remuneraciones/archivo/previred", texto: "Archivo Previred de octubre del Almacén (105 campos, separado por punto y coma)." },
      { usuario: "ana", empresa: "almacen", url: "/remuneraciones/archivo/lre", texto: "LRE de octubre del Almacén (nombre rutempleador_aaaamm)." },
    ],
    extra: async (salida, archivos) => {
      const { data } = await db.from("archivos_generados").select("tipo, nombre, hash, validacion, version_datos, created_at").eq("empresa_id", E.almacen).in("tipo", ["previred", "lre"]).order("created_at", { ascending: false }).limit(2);
      const lineas = ["# Informe de validación (generado por RH Software)", ""];
      for (const a of data ?? []) {
        const v = a.validacion ?? { errores: [], avisos: [] };
        lineas.push(`## ${a.nombre}`, `- Hash SHA-256: \`${a.hash}\``, `- Errores: ${v.errores?.length ?? 0}`, ...(v.errores ?? []).map((e) => `  - ${e}`), `- Avisos: ${v.avisos?.length ?? 0}`, ...(v.avisos ?? []).map((e) => `  - ${e}`), "");
      }
      lineas.push("Verificar subiendo el archivo en el ambiente de Previred y en Mi DT (carga masiva) antes de usarlo con empresas reales.");
      await writeFile(path.join(salida, "archivos", "informe-validacion.md"), lineas.join("\n"));
      archivos.push({ archivo: "informe-validacion.md", texto: "Informe de validación de ambos archivos (errores, avisos y hash)." });
      const { data: t } = await db.from("trabajadores").select("id").eq("empresa_id", E.transportes).eq("nombres", "Carla").maybeSingle();
      if (t) { const r = await descargar(salida, { usuario: "ana", empresa: "transportes", url: `/remuneraciones/documentos/pdf?tipo=contrato&trabajador=${t.id}`, nombre: "contrato-ejemplo.pdf" }); archivos.push({ archivo: r.archivo, texto: "Contrato de trabajo generado desde la ficha (borrador para revisión)." }); }
    },
    video: { usuario: "ana", pasos: [{ ruta: "/remuneraciones/previred", empresa: "transportes", bajar: 3 }, { ruta: "/remuneraciones/lre", bajar: 2 }, { ruta: "/remuneraciones/ausencias", bajar: 2 }, { ruta: "/remuneraciones/finiquitos" }] },
    verificar: ["El archivo Previred: pedir el PDF del formato vigente (con los campos de la Reforma de Pensiones) y comparar con un archivo real anonimizado.", "El LRE: subirlo en el ambiente de prueba de Mi DT.", "Los finiquitos de ejemplo (indemnizaciones y feriado proporcional)."],
  },
  7: {
    titulo: "Portal del cliente, bandeja de documentos y WhatsApp",
    resumen: "El cliente ve su mes en lenguaje simple desde el celular, sube documentos y responde solicitudes. El contador los revisa en la bandeja (lectura con IA cuando se active la clave), detecta duplicados y los registra con confirmación. Links wa.me prellenados.",
    pantallas: [
      { archivo: "01-portal-celular.png", usuario: "cliente", celular: true, ruta: "/portal", completa: true, texto: "Portal del cliente en el celular (José Pérez, dueño del Almacén): “Tu IVA de octubre está listo: debes pagar … antes del 20”, lo que pide su contador, botón grande para enviar documentos y sus liquidaciones." },
      { archivo: "02-portal-subida.png", usuario: "cliente", celular: true, ruta: "/portal", antes: async (p) => {
          await p.setInputFiles('input[type=file]', path.join(raiz, "demo/bandeja/foto-factura-ferreteria.png")); await p.fill('input[placeholder^="Comentario"]', "Factura de la estantería");
          await p.click('button:has-text("Enviar 1 archivo")'); await p.waitForSelector("text=Tu contador recibió", { timeout: 30_000 });
        }, texto: "Éxito: el cliente subió una foto y recibe la confirmación. Llega a la bandeja de su contador." },
      { archivo: "03-portal-escritorio.png", usuario: "cliente", ruta: "/portal", texto: "El mismo portal en un computador." },
      { archivo: "04-bandeja.png", usuario: "ana", empresa: "almacen", ruta: "/documentos", texto: "Bandeja del contador: vista previa del documento y datos para confirmar (leídos por IA cuando se active la clave; aquí, datos de ejemplo)." },
      { archivo: "05-bandeja-duplicado.png", usuario: "ana", empresa: "almacen", ruta: "/documentos", antes: async (p) => { await p.click('a:has-text("factura-distribuidora-sur.pdf")'); await p.waitForTimeout(1500); }, texto: "Detección de duplicados: esta factura ya vino en el RCV del SII, así que se avisa para descartarla." },
      { archivo: "06-bandeja-registrado.png", usuario: "ana", empresa: "almacen", ruta: "/documentos?ver=todos", antes: async (p) => { await p.click('a:has-text("foto-factura-ferreteria.png") >> nth=-1'); await p.waitForTimeout(800); await p.click('button:has-text("Confirmar y registrar")'); await p.waitForSelector("text=Registrado", { timeout: 30_000 }); }, texto: "Éxito: el contador confirmó los datos y la factura quedó en el libro de compras de noviembre. Nada se contabiliza sin confirmación." },
      { archivo: "07-solicitudes-whatsapp.png", usuario: "ana", empresa: "almacen", ruta: "/documentos", antes: async (p) => { await p.locator("text=Solicitudes al cliente").scrollIntoViewIfNeeded(); }, texto: "Solicitudes al cliente (aparecen en su portal) y botón “Escribir por WhatsApp” con el mensaje prellenado (link wa.me, sin costo)." },
    ],
    video: { usuario: "cliente", celular: true, pasos: [{ ruta: "/portal", bajar: 6 }] },
    verificar: ["Que el lenguaje del portal sea claro para un cliente sin conocimientos contables."],
  },
  8: {
    titulo: "Suscripciones y pagos",
    resumen: "Registro con 30 días gratis, planes por cantidad de empresas (precios en propuesta), pago por transferencia con comprobante, avisos de vencimiento y modo de solo lectura por atraso (nunca se borran datos). Administración para José.",
    pantallas: [
      { archivo: "01-registro.png", ruta: "/registro", texto: "Registro del estudio: 30 días gratis sin tarjeta. Pide RUT (validado), nombre, correo y clave, y la aceptación de términos y privacidad." },
      { archivo: "02-registro-error.png", ruta: "/registro", antes: async (p) => {
          await p.fill("input[name=estudio]", ESTUDIO_NUEVO); await p.fill("input[name=rut]", "14555666-1"); await p.fill("input[name=nombre]", "Marta Ejemplo");
          await p.fill("input[name=correo]", CORREO_MARTA); await p.fill("input[name=clave]", "Prueba1234"); await p.fill("input[name=clave2]", "Prueba1234");
          await p.check("input[name=acepto]"); await p.click("button[type=submit]"); await p.waitForSelector("text=no es válido");
        }, texto: "Estado de error: RUT con dígito verificador equivocado." },
      { archivo: "03-registro-exito.png", ruta: "/registro", antes: async (p) => {
          await p.fill("input[name=estudio]", ESTUDIO_NUEVO); await p.fill("input[name=rut]", USUARIOS.marta.rut); await p.fill("input[name=nombre]", "Marta Ejemplo");
          await p.fill("input[name=correo]", CORREO_MARTA); await p.fill("input[name=clave]", "Prueba1234"); await p.fill("input[name=clave2]", "Prueba1234");
          await p.check("input[name=acepto]"); await p.click("button[type=submit]"); await p.waitForURL("**/ingresar?nuevo=1");
          // Solo para la previsualización local: se omite el segundo factor de este usuario de ejemplo.
          await db.from("usuarios").update({ requiere_2fa: false }).eq("rut", USUARIOS.marta.rut);
        }, texto: "Éxito: estudio creado. Al ingresar, el contador configura su segundo factor (en esta previsualización se omite)." },
      { archivo: "04-prueba-gratis.png", usuario: "marta", ruta: "/mi-mes", texto: "Estudio nuevo en prueba: franja con los días que quedan y “Ver planes”. Estado vacío de “Mi mes” invitando a crear la primera empresa." },
      { archivo: "05-plan-y-pagos.png", usuario: "marta", ruta: "/estudio/suscripcion", texto: "Plan y pagos: plan actual, uso de empresas, planes, datos de transferencia (POR COMPLETAR por José) y formulario para informar el pago." },
      { archivo: "06-pago-informado.png", usuario: "marta", ruta: "/estudio/suscripcion", antes: async (p) => {
          await p.selectOption("select[name=plan]", "estudio"); await p.selectOption("select[name=meses]", "3"); await p.fill("input[name=banco]", "Banco Ficticio");
          await p.setInputFiles("input[name=comprobante]", path.join(raiz, "demo/bandeja/foto-factura-ferreteria.png"));
          await p.click('button:has-text("Informar pago")'); await p.waitForSelector("text=Recibimos tu pago", { timeout: 30_000 });
        }, completa: true, texto: "Éxito: pago informado con su comprobante; queda “En revisión”." },
      { archivo: "07-admin.png", usuario: "superadmin", ruta: "/admin", completa: true, texto: "Administración (solo José): estudios, estado de cada cuenta, pagos por revisar con su comprobante e ingreso mensual. No muestra la contabilidad de los estudios." },
      { archivo: "08-admin-aprobado.png", usuario: "superadmin", ruta: "/admin", antes: async (p) => { p.on("dialog", (d) => d.accept()); await p.click('button:has-text("Aprobar")'); await p.waitForSelector("text=No hay pagos pendientes", { timeout: 30_000 }); }, completa: true, texto: "Éxito: pago aprobado; la suscripción se extiende 3 meses desde el fin de la prueba." },
      { archivo: "09-por-vencer.png", usuario: "marta", ruta: "/mi-mes", antes: async (p) => {
          const { data } = await db.from("estudios").select("id").eq("nombre", ESTUDIO_NUEVO).single();
          const en5 = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
          await db.from("suscripciones").update({ pagado_hasta: en5 }).eq("estudio_id", data.id); await p.reload();
        }, texto: "Aviso “por vencer” 7 días antes del vencimiento." },
      { archivo: "10-solo-lectura.png", usuario: "marta", ruta: "/estudio/suscripcion", antes: async (p) => {
          const { data } = await db.from("estudios").select("id").eq("nombre", ESTUDIO_NUEVO).single();
          await db.from("suscripciones").update({ pagado_hasta: "2026-10-01" }).eq("estudio_id", data.id); await p.reload();
        }, texto: "Atraso mayor a 10 días: la cuenta pasa a solo lectura. Se puede ver y descargar todo, e informar el pago; la base de datos bloquea los cambios. Nunca se borran datos." },
    ],
    video: { usuario: "marta", pasos: [{ ruta: "/estudio/suscripcion", bajar: 2 }, { ruta: "/mi-mes" }] },
    verificar: ["José: precios y cantidad de empresas por plan (hoy son una propuesta).", "José: datos de la cuenta bancaria para las transferencias."],
  },
};

const pedidas = process.argv.slice(2).map(Number).filter(Boolean);
for (const [n, def] of Object.entries(FASES)) if (!pedidas.length || pedidas.includes(Number(n))) await fase(Number(n), def);
await navegador.close();
console.log("Listo: previews/fase-N/index.html");
