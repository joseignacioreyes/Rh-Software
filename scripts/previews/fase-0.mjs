// Previsualización de la Fase 0: capturas, video del recorrido e index.html.
// Requisito: la app corriendo (npm run build && npm start) en BASE_URL.
// Uso: npm run previews:fase-0
import { chromium } from "playwright";
import { mkdir, rm, rename, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const raiz = path.resolve(import.meta.dirname, "../..");
const salida = path.join(raiz, "previews/fase-0");
await mkdir(salida, { recursive: true });

const navegador = await chromium.launch();
const escritorio = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "es-CL" };

// Cada pantalla: archivo, ruta, frase para José y opciones.
const pantallas = [
  { archivo: "01-portada.png", ruta: "/", texto: "Portada: logo, promesa, vista de ejemplo del panel “Mi mes” y botón de WhatsApp. Revisa que los colores y el logo se vean como la marca." },
  { archivo: "02-portada-completa.png", ruta: "/", completa: true, texto: "Portada completa (toda la página hacia abajo): funciones, confianza y pie con el número de soporte." },
  { archivo: "03-privacidad.png", ruta: "/privacidad", texto: "Política de privacidad: solo el esqueleto, marcado BORRADOR. El texto final va en la Fase 1 y lo revisa un abogado." },
  { archivo: "04-terminos.png", ruta: "/terminos", texto: "Términos de uso: esqueleto marcado BORRADOR. Incluye que el contador revisa y responde por lo que declara." },
  { archivo: "05-pagina-no-existe.png", ruta: "/no-existe", texto: "Estado de error: una dirección que no existe muestra la página 404 (en la Fase 1 le pondremos la marca)." },
  { archivo: "06-portada-celular.png", ruta: "/", celular: true, completa: true, texto: "Portada en celular (390×844): también se ve bien, aunque la app para el contador es de escritorio." },
];

for (const p of pantallas) {
  const ctx = await navegador.newContext(
    p.celular ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-CL" } : escritorio,
  );
  const pagina = await ctx.newPage();
  await pagina.goto(BASE + p.ruta, { waitUntil: "networkidle" });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.screenshot({ path: path.join(salida, p.archivo), fullPage: !!p.completa });
  await ctx.close();
}

// Imagen para compartir y favicon: se copian tal cual.
await copyFile(path.join(raiz, "src/app/opengraph-image.png"), path.join(salida, "07-imagen-para-compartir.png"));
await copyFile(path.join(raiz, "src/app/apple-icon.png"), path.join(salida, "08-icono.png"));
pantallas.push(
  { archivo: "07-imagen-para-compartir.png", texto: "Imagen que aparece al compartir el link por WhatsApp, correo o redes (1200×630)." },
  { archivo: "08-icono.png", texto: "Ícono de la pestaña del navegador y del acceso directo en el teléfono." },
);

// Video del recorrido principal.
const carpetaVideo = path.join(salida, "_video");
const ctxVideo = await navegador.newContext({ ...escritorio, recordVideo: { dir: carpetaVideo, size: { width: 1440, height: 900 } } });
const v = await ctxVideo.newPage();
await v.goto(BASE + "/", { waitUntil: "networkidle" });
await v.waitForTimeout(1500);
await v.locator("table").hover();
await v.waitForTimeout(1200);
for (let y = 0; y <= 1800; y += 300) {
  await v.mouse.wheel(0, 300);
  await v.waitForTimeout(500);
}
await v.waitForTimeout(800);
await v.getByRole("link", { name: "Privacidad", exact: true }).click();
await v.waitForLoadState("networkidle");
await v.waitForTimeout(1500);
await v.goBack();
await v.waitForTimeout(800);
await v.getByRole("link", { name: "Términos", exact: true }).click();
await v.waitForLoadState("networkidle");
await v.waitForTimeout(1500);
const video = v.video();
await ctxVideo.close();
await rm(path.join(salida, "recorrido.webm"), { force: true });
await rename(await video.path(), path.join(salida, "recorrido.webm"));
await rm(carpetaVideo, { recursive: true, force: true });

await navegador.close();

// Página de revisión.
const tarjetas = pantallas
  .map(
    (p, i) => `
  <section>
    <h2>${i + 1}. ${p.archivo}</h2>
    <p>${p.texto}</p>
    <a href="${p.archivo}"><img src="${p.archivo}" alt="${p.texto}" loading="lazy"></a>
  </section>`,
  )
  .join("");

await writeFile(
  path.join(salida, "index.html"),
  `<!doctype html>
<html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revisión Fase 0</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#111827;background:#F9FAFB;margin:0}
  header{background:#1E3A8A;color:#fff;padding:24px 16px}
  header h1{margin:0;font-size:24px} header p{margin:6px 0 0;color:#DBEAFE}
  main{max-width:1100px;margin:0 auto;padding:16px}
  section{background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:16px;margin:16px 0}
  h2{font-size:16px;margin:0 0 6px;color:#1E3A8A} p{color:#4B5563;margin:0 0 12px}
  img,video{max-width:100%;border:1px solid #E5E7EB;border-radius:6px}
</style></head>
<body>
<header><h1>RH Software · Revisión de la Fase 0</h1><p>Preparación: marca, portada, páginas legales en borrador y herramientas de previsualización.</p></header>
<main>
  <section><h2>Video del recorrido</h2><p>Portada, desplazamiento hasta el pie, privacidad y términos.</p>
  <video src="recorrido.webm" controls width="1100"></video></section>
  ${tarjetas}
</main></body></html>
`,
);

console.log(`Listo: ${pantallas.length} capturas, recorrido.webm e index.html en previews/fase-0/`);
