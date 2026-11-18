// Genera los archivos de marca desde public/brand/:
//   src/app/favicon.ico          (16, 32 y 48 px)
//   src/app/apple-icon.png       (180 px, para iPhone)
//   src/app/opengraph-image.png  (1200×630, logo sobre fondo blanco, para compartir links)
// Uso: npm run marca
// Usa Playwright (Chromium) para dibujar los SVG con la fuente Poppins.
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const icono = await readFile(path.join(raiz, "public/brand/rhsoftware-icono.svg"), "utf8");
const logo = await readFile(path.join(raiz, "public/brand/rhsoftware-logo.svg"), "utf8");

const fuentes =
  '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=block" rel="stylesheet">';

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

/** Dibuja un HTML y devuelve un PNG del tamaño pedido. */
async function png(html, ancho, alto) {
  await pagina.setViewportSize({ width: ancho, height: alto });
  await pagina.setContent(
    `<!doctype html><html><head>${fuentes}<style>html,body{margin:0;padding:0;background:transparent}</style></head><body>${html}</body></html>`,
    { waitUntil: "networkidle" },
  );
  await pagina.evaluate(() => document.fonts.ready);
  return pagina.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: ancho, height: alto } });
}

const iconoEn = (px) => icono.replace(/width="512" height="512"/, `width="${px}" height="${px}" style="display:block"`);

// Favicon .ico: contenedor con varias imágenes PNG adentro.
const tamanos = [16, 32, 48];
const imagenes = [];
for (const t of tamanos) imagenes.push(await png(iconoEn(t), t, t));
const cabecera = Buffer.alloc(6 + 16 * imagenes.length);
cabecera.writeUInt16LE(0, 0); // reservado
cabecera.writeUInt16LE(1, 2); // tipo: ícono
cabecera.writeUInt16LE(imagenes.length, 4);
let desplazamiento = cabecera.length;
imagenes.forEach((img, i) => {
  const base = 6 + 16 * i;
  cabecera.writeUInt8(tamanos[i], base); // ancho
  cabecera.writeUInt8(tamanos[i], base + 1); // alto
  cabecera.writeUInt8(0, base + 2); // paleta
  cabecera.writeUInt8(0, base + 3); // reservado
  cabecera.writeUInt16LE(1, base + 4); // planos
  cabecera.writeUInt16LE(32, base + 6); // bits por píxel
  cabecera.writeUInt32LE(img.length, base + 8);
  cabecera.writeUInt32LE(desplazamiento, base + 12);
  desplazamiento += img.length;
});
await writeFile(path.join(raiz, "src/app/favicon.ico"), Buffer.concat([cabecera, ...imagenes]));

// Ícono para iPhone (sin transparencia: iOS pone fondo negro si hay).
await writeFile(
  path.join(raiz, "src/app/apple-icon.png"),
  await png(`<div style="background:#1E3A8A;width:180px;height:180px">${iconoEn(180)}</div>`, 180, 180),
);

// Imagen para compartir: logo centrado sobre fondo blanco, con una franja azul abajo.
const og = `
<div style="width:1200px;height:630px;background:#FFFFFF;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;font-family:Poppins,sans-serif">
  <div style="width:1000px">${logo.replace(/width="980" height="240"/, 'width="1000" height="245" style="display:block"')}</div>
  <div style="margin-top:36px;font-size:30px;color:#4B5563">Todas tus empresas en una sola pantalla, con el mes al día.</div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:18px;background:#1E3A8A"></div>
  <div style="position:absolute;left:0;bottom:18px;height:6px;width:100%;background:#059669"></div>
</div>`;
await writeFile(path.join(raiz, "src/app/opengraph-image.png"), await png(og, 1200, 630));

await navegador.close();
console.log("Listo: favicon.ico, apple-icon.png y opengraph-image.png en src/app/");
