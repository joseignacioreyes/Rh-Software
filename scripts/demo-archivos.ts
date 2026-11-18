// Genera archivos de ejemplo FICTICIOS con el mismo formato que los del SII y de un banco:
//  - RCV de compras y ventas (CSV separado por punto y coma, Latin-1) por empresa y mes;
//  - informe de boletas de honorarios recibidas;
//  - cartolas de un banco ficticio ("Banco Demo").
// Determinístico: siempre genera lo mismo. Uso: importado por el seed, o `npx tsx scripts/demo-archivos.ts`.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { digitoVerificador } from "../src/lib/rut";

// Generador pseudoaleatorio con semilla (para que el demo sea siempre igual).
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0;
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
}

const rut = (cuerpo: number) => `${cuerpo}-${digitoVerificador(String(cuerpo))}`;
// Tasa usada SOLO para inventar montos coherentes de ejemplo.
const IVA = 0.19;

const PROVEEDORES: Record<string, { rut: string; nombre: string; tipo: string }[]> = {
  almacen: [
    { rut: rut(76543210), nombre: "Distribuidora Sur Demo SpA", tipo: "Del Giro" },
    { rut: rut(77654321), nombre: "Lácteos del Valle Demo Ltda.", tipo: "Del Giro" },
    { rut: rut(78765432), nombre: "Bebidas Andinas Demo S.A.", tipo: "Del Giro" },
    { rut: rut(76987654), nombre: "Panificadora La Espiga Demo", tipo: "Del Giro" },
    { rut: rut(96111222), nombre: "Compañía Eléctrica Demo S.A.", tipo: "Del Giro" },
  ],
  transportes: [
    { rut: rut(96222333), nombre: "Combustibles del Norte Demo S.A.", tipo: "Del Giro" },
    { rut: rut(76222111), nombre: "Neumáticos Ruta Demo SpA", tipo: "Del Giro" },
    { rut: rut(77333222), nombre: "Taller Mecánico Los Andes Demo", tipo: "Del Giro" },
    { rut: rut(96333444), nombre: "Autopistas Demo S.A.", tipo: "Del Giro" },
  ],
  consultora: [
    { rut: rut(76444555), nombre: "Arriendos Oficina Demo SpA", tipo: "Del Giro" },
    { rut: rut(96444555), nombre: "Telefonía Demo S.A.", tipo: "Del Giro" },
    { rut: rut(76555666), nombre: "Computación Demo Ltda.", tipo: "Activo Fijo" },
  ],
};

const CLIENTES: Record<string, { rut: string; nombre: string }[]> = {
  almacen: [{ rut: rut(76666777), nombre: "Junta de Vecinos Demo" }],
  transportes: [
    { rut: rut(96555666), nombre: "Supermercados Demo S.A." },
    { rut: rut(76777888), nombre: "Agrícola del Maule Demo SpA" },
    { rut: rut(77888999), nombre: "Constructora Cumbre Demo Ltda." },
  ],
  consultora: [
    { rut: rut(96666777), nombre: "Municipalidad Ficticia Demo" },
    { rut: rut(76888999), nombre: "Exportadora Pacífico Demo SpA" },
  ],
};

const ENC_COMPRAS = [
  "Nro", "Tipo Doc", "Tipo Compra", "RUT Proveedor", "Razon Social", "Folio", "Fecha Docto", "Fecha Recepcion", "Fecha Acuse",
  "Monto Exento", "Monto Neto", "Monto IVA Recuperable", "Monto Iva No Recuperable", "Codigo IVA No Rec.", "Monto Total",
  "Monto Neto Activo Fijo", "IVA Activo Fijo", "IVA uso Comun", "Impto. Sin Derecho a Credito", "IVA No Retenido",
  "Tabacos Puros", "Tabacos Cigarrillos", "Tabacos Elaborados", "NCE o NDE sobre Fact. de Compra", "Codigo Otro Impuesto",
  "Valor Otro Impuesto", "Tasa Otro Impuesto",
];
const ENC_VENTAS = [
  "Nro", "Tipo Doc", "Tipo Venta", "Rut cliente", "Razon Social", "Folio", "Fecha Docto", "Fecha Recepcion", "Fecha Acuse Recibo",
  "Fecha Reclamo", "Monto Exento", "Monto Neto", "Monto IVA", "Monto total", "IVA Retenido Total", "IVA Retenido Parcial",
  "IVA no retenido", "IVA propio", "IVA Terceros", "RUT Emisor Liquid. Factura", "Neto Comision Liquid. Factura",
  "Exento Comision Liquid. Factura", "IVA Comision Liquid. Factura", "IVA fuera de plazo", "Tipo Docto. Referencia",
  "Folio Docto. Referencia", "Num. Ident. Receptor Extranjero", "Nacionalidad Receptor Extranjero", "Credito empresa constructora",
  "Impto. Zona Franca (Ley 18211)", "Garantia Dep. Envases", "Indicador Venta sin Costo", "Indicador Servicio Periodico",
  "Monto No facturable", "Total Monto Periodo", "Venta Pasajes Transporte Nacional", "Venta Pasajes Transporte Internacional",
  "Numero Interno", "Codigo Sucursal", "NCE o NDE sobre Fact. de Compra", "Codigo Otro Imp.", "Valor Otro Imp.", "Tasa Otro Imp.",
];

const fechaSii = (a: number, m: number, d: number) => `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;

export type ArchivoDemo = { nombre: string; contenido: Buffer; empresa: string; tipo: string; anio: number; mes: number };

export const RUT_EMPRESAS: Record<string, string> = { almacen: "76111222-8", transportes: "77222333-1", consultora: "76333444-9" };

/** Genera todos los archivos de ejemplo de agosto a octubre de 2026. */
export function generarArchivosDemo(): ArchivoDemo[] {
  const archivos: ArchivoDemo[] = [];
  const anio = 2026;
  for (const [clave, rutEmpresa] of Object.entries(RUT_EMPRESAS)) {
    for (const mes of [8, 9, 10]) {
      const r = azar(clave.length * 1000 + mes);
      const dias = new Date(anio, mes, 0).getDate();

      // --- Compras ---
      const compras: string[][] = [];
      const cantidadCompras = clave === "almacen" ? 14 : clave === "transportes" ? 10 : 5;
      // Octubre en Transportes: faltan 3 facturas (para el aviso "faltan facturas").
      const n = clave === "transportes" && mes === 10 ? cantidadCompras - 3 : cantidadCompras;
      for (let i = 0; i < n; i++) {
        const p = PROVEEDORES[clave][i % PROVEEDORES[clave].length];
        const base = clave === "almacen" ? 280_000 + r() * 520_000 : clave === "transportes" ? 150_000 + r() * 900_000 : 80_000 + r() * 400_000;
        const neto = Math.round(base / 10) * 10;
        const esNc = i === 3 && clave !== "consultora";
        const tipo = esNc ? 61 : 33;
        const af = p.tipo === "Activo Fijo";
        const iva = Math.round(neto * IVA);
        const d = 1 + Math.floor(r() * (dias - 1));
        compras.push([
          String(i + 1), String(tipo), p.tipo, p.rut, p.nombre, String(100_000 + mes * 1000 + i * 7 + clave.length), fechaSii(anio, mes, d),
          `${fechaSii(anio, mes, Math.min(dias, d + 1))} 10:15:00`, "", "0", String(neto), String(iva), "0", "", String(neto + iva),
          af ? String(neto) : "0", af ? String(iva) : "0", "0", "0", "0", "", "", "", "0", "", "", "",
        ]);
      }
      archivos.push({
        nombre: `RCV_COMPRA_REGISTRO_${rutEmpresa}_${anio}${String(mes).padStart(2, "0")}.csv`,
        contenido: Buffer.from([ENC_COMPRAS, ...compras].map((f) => f.join(";")).join("\r\n") + "\r\n", "latin1"),
        empresa: clave, tipo: "rcv_compras", anio, mes,
      });

      // --- Ventas (el almacén vende con boletas: va en el resumen de boletas, no en el detalle) ---
      const ventas: string[][] = [];
      const cantidadVentas = clave === "almacen" ? 1 : clave === "transportes" ? 8 : 6;
      for (let i = 0; i < cantidadVentas; i++) {
        const c = CLIENTES[clave][i % CLIENTES[clave].length];
        const exenta = clave === "consultora" && i % 2 === 0;
        const base = clave === "transportes" ? 900_000 + r() * 2_400_000 : clave === "consultora" ? 400_000 + r() * 1_200_000 : 120_000 + r() * 60_000;
        const neto = Math.round(base / 10) * 10;
        const tipo = exenta ? 34 : 33;
        const iva = exenta ? 0 : Math.round(neto * IVA);
        const d = 1 + Math.floor(r() * (dias - 1));
        const fila = new Array(ENC_VENTAS.length).fill("");
        Object.assign(fila, {
          0: String(i + 1), 1: String(tipo), 2: "Del Giro", 3: c.rut, 4: c.nombre, 5: String(5000 + mes * 100 + i),
          6: fechaSii(anio, mes, d), 7: `${fechaSii(anio, mes, d)} 12:00:00`, 10: exenta ? String(neto) : "0",
          11: exenta ? "0" : String(neto), 12: String(iva), 13: String(neto + iva),
        });
        ventas.push(fila);
      }
      archivos.push({
        nombre: `RCV_VENTA_${rutEmpresa}_${anio}${String(mes).padStart(2, "0")}.csv`,
        contenido: Buffer.from([ENC_VENTAS, ...ventas].map((f) => f.join(";")).join("\r\n") + "\r\n", "latin1"),
        empresa: clave, tipo: "rcv_ventas", anio, mes,
      });

      // --- Honorarios recibidos (Consultora) ---
      if (clave === "consultora") {
        const enc = ["N°", "Estado", "Fecha", "Fecha Anulación", "Rut Emisor", "Nombre o Razón Social Emisor", "Soc. Prof.", "Monto Bruto", "Monto Retenido", "Monto Pagado"];
        const filas = [["INFORME DE BOLETAS DE HONORARIOS ELECTRÓNICAS RECIBIDAS (EJEMPLO FICTICIO)"], [], enc];
        const prestadores = [[rut(15333444), "Camila Ríos Demo"], [rut(16444555), "Diego Mora Demo"], [rut(17555666), "Fernanda Lagos Demo"]];
        // Tasa de retención SOLO para inventar el ejemplo; la real está en parámetros legales.
        const tasa = 0.1525;
        prestadores.forEach(([rp, nombre], i) => {
          const bruto = Math.round((300_000 + r() * 500_000) / 1000) * 1000;
          const ret = Math.round(bruto * tasa);
          filas.push([String(200 + mes * 10 + i), "VIGENTE", fechaSii(anio, mes, 5 + i * 7), "", rp, nombre, "NO", String(bruto), String(ret), String(bruto - ret)]);
        });
        archivos.push({
          nombre: `BHE_RECIBIDAS_${rutEmpresa}_${anio}${String(mes).padStart(2, "0")}.csv`,
          contenido: Buffer.from(filas.map((f) => f.join(";")).join("\r\n") + "\r\n", "latin1"),
          empresa: clave, tipo: "honorarios_recibidos", anio, mes,
        });
      }

      // --- Cartola de Banco Demo (formato propio del banco ficticio) ---
      const mov: string[][] = [["Fecha", "Descripción", "N° Documento", "Cargos", "Abonos", "Saldo"]];
      let saldo = clave === "transportes" ? 12_500_000 : clave === "almacen" ? 4_800_000 : 7_400_000;
      const lineas: [number, string, string, number, number][] = [];
      for (let i = 0; i < 12; i++) {
        const d = 1 + Math.floor(r() * (dias - 1));
        const esAbono = r() < 0.4;
        const monto = Math.round((50_000 + r() * 1_500_000) / 10) * 10;
        lineas.push([d, esAbono ? `DEPOSITO ${["EFECTIVO", "TRANSFERENCIA DE CLIENTE", "CHEQUE"][i % 3]}` : `${["PAGO PROVEEDOR", "TRANSF A TERCEROS", "PAC SERVICIOS", "COMISION MANTENCION"][i % 4]}`, String(800000 + i), esAbono ? 0 : monto, esAbono ? monto : 0]);
      }
      lineas.sort((a, b) => a[0] - b[0]);
      for (const [d, desc, doc, cargo, abono] of lineas) {
        saldo += abono - cargo;
        mov.push([fechaSii(anio, mes, d), desc, doc, cargo ? String(cargo) : "", abono ? String(abono) : "", String(saldo)]);
      }
      archivos.push({
        nombre: `CARTOLA_BANCODEMO_${rutEmpresa}_${anio}${String(mes).padStart(2, "0")}.csv`,
        contenido: Buffer.from(mov.map((f) => f.join(";")).join("\r\n") + "\r\n", "utf8"),
        empresa: clave, tipo: "cartola", anio, mes,
      });
    }
  }
  return archivos;
}

// Si se ejecuta directo, escribe los archivos en demo/.
if (process.argv[1]?.endsWith("demo-archivos.ts")) {
  const raiz = path.resolve(import.meta.dirname, "..", "demo");
  for (const a of generarArchivosDemo()) {
    const carpeta = path.join(raiz, a.tipo.startsWith("rcv") ? "rcv" : a.tipo === "cartola" ? "cartolas" : "honorarios");
    mkdirSync(carpeta, { recursive: true });
    writeFileSync(path.join(carpeta, a.nombre), a.contenido);
  }
  console.log(`Archivos de ejemplo escritos en ${raiz}`);
}
