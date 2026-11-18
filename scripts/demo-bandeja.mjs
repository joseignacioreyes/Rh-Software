// Genera los 2 documentos de ejemplo de la bandeja (una "foto" de factura en PNG y un PDF).
// Todo es ficticio y lleva la marca "DOCUMENTO DE EJEMPLO - SIN VALOR TRIBUTARIO".
// Uso: node scripts/demo-bandeja.mjs   (deja los archivos en demo/bandeja/)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const miles = (n) => n.toLocaleString("es-CL");

function factura({ emisor, rut, giro, direccion, folio, fecha, items, neto, iva, total, foto }) {
  const filas = items.map(([d, c, p]) => `<tr><td>${d}</td><td class="n">${c}</td><td class="n">$${miles(p)}</td><td class="n">$${miles(c * p)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,Helvetica,sans-serif;margin:0;background:${foto ? "#d6d3cc" : "#fff"};}
    .hoja{width:720px;margin:${foto ? "40px auto" : "0 auto"};background:#fff;padding:36px;position:relative;
      ${foto ? "transform:rotate(-1.6deg);box-shadow:0 10px 30px rgba(0,0,0,.35);" : ""}}
    .top{display:flex;justify-content:space-between;gap:20px}
    .caja{border:3px solid #c0262d;color:#c0262d;text-align:center;padding:12px 18px;font-weight:bold;font-size:15px;line-height:1.5}
    h1{font-size:20px;margin:0 0 4px} p{margin:2px 0;font-size:13px;color:#333}
    table{width:100%;border-collapse:collapse;margin-top:22px;font-size:13px}
    th,td{border-bottom:1px solid #ddd;padding:7px;text-align:left} th{background:#f2f2f2}
    .n{text-align:right} .tot{margin-left:auto;width:260px;margin-top:16px;font-size:14px}
    .tot div{display:flex;justify-content:space-between;padding:3px 0} .tot .g{font-weight:bold;border-top:2px solid #333;margin-top:4px;padding-top:6px}
    .marca{position:absolute;top:45%;left:0;right:0;text-align:center;font-size:30px;font-weight:bold;color:rgba(220,38,38,.18);transform:rotate(-18deg)}
    .rec{margin-top:18px;font-size:12px;color:#444;border:1px dashed #999;padding:8px}
  </style></head><body><div class="hoja">
    <div class="top">
      <div><h1>${emisor}</h1><p>${giro}</p><p>${direccion}</p></div>
      <div class="caja">R.U.T.: ${rut}<br>FACTURA ELECTRÓNICA<br>N° ${folio}<br><span style="font-size:11px">S.I.I. - SANTIAGO</span></div>
    </div>
    <div class="rec"><b>Señor(es):</b> Almacén Don Pepe SpA &nbsp; <b>RUT:</b> 76.111.222-8 &nbsp; <b>Fecha:</b> ${fecha}<br><b>Giro:</b> Venta al por menor en almacenes de barrio &nbsp; <b>Dirección:</b> Av. Ficticia 123, Maipú</div>
    <table><tr><th>Descripción</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Total</th></tr>${filas}</table>
    <div class="tot"><div><span>Monto neto</span><span>$${miles(neto)}</span></div><div><span>IVA 19%</span><span>$${miles(iva)}</span></div><div class="g"><span>TOTAL</span><span>$${miles(total)}</span></div></div>
    <div class="marca">DOCUMENTO DE EJEMPLO<br>SIN VALOR TRIBUTARIO</div>
  </div></body></html>`;
}

mkdirSync("demo/bandeja", { recursive: true });
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 800, height: 560 }, deviceScaleFactor: 1 });

// 1) "Foto" de una factura de compra que NO está en el RCV (para registrar a mano).
await pagina.setContent(factura({
  emisor: "Ferretería El Clavo Demo Ltda.", rut: "76.555.666-K", giro: "Venta de artículos de ferretería", direccion: "Pasaje Ejemplo 45, Maipú",
  folio: "4521", fecha: "06-11-2026", foto: true,
  items: [["Estantería metálica 5 niveles", 2, 32000], ["Kit de fijaciones", 4, 5000]], neto: 84000, iva: 15960, total: 99960,
}));
await pagina.screenshot({ path: "demo/bandeja/foto-factura-ferreteria.png", fullPage: true });

// 2) PDF de una factura que YA vino en el RCV de octubre (para mostrar la detección de duplicados).
await pagina.setContent(factura({
  emisor: "Distribuidora Sur Demo SpA", rut: "76.543.210-3", giro: "Distribución de abarrotes", direccion: "Av. Imaginaria 900, San Bernardo",
  folio: "110007", fecha: "11-10-2026", foto: false,
  items: [["Abarrotes surtidos (pedido semanal)", 1, 324760]], neto: 324760, iva: 61704, total: 386464,
}));
await pagina.pdf({ path: "demo/bandeja/factura-distribuidora-sur.pdf", format: "Letter", printBackground: true });
await navegador.close();
console.log("Listo: demo/bandeja/");
