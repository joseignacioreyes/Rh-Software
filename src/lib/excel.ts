// Exportación a Excel desde el navegador. ExcelJS se carga solo al exportar (no pesa en la página).

export type ColumnaExcel = { titulo: string; tipo?: "texto" | "monto" | "fecha" | "numero"; ancho?: number };

export async function descargarExcel(
  nombreArchivo: string,
  titulo: string,
  columnas: ColumnaExcel[],
  filas: (string | number | null)[][],
  totales?: (string | number | null)[],
) {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = "RH Software";
  const hoja = libro.addWorksheet(titulo.slice(0, 31));

  hoja.addRow([titulo]).font = { bold: true, size: 13, color: { argb: "FF1E3A8A" } };
  hoja.addRow([]);
  const cabecera = hoja.addRow(columnas.map((c) => c.titulo));
  cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecera.eachCell((celda) => {
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
  });

  for (const fila of filas) hoja.addRow(fila);
  if (totales) {
    const t = hoja.addRow(totales);
    t.font = { bold: true };
    t.eachCell((celda) => {
      celda.border = { top: { style: "thin" } };
    });
  }

  columnas.forEach((c, i) => {
    const col = hoja.getColumn(i + 1);
    col.width = c.ancho ?? (c.tipo === "monto" ? 16 : c.tipo === "fecha" ? 12 : 28);
    // Separador de miles: Excel lo muestra con punto en configuración chilena.
    if (c.tipo === "monto") col.numFmt = "#,##0;-#,##0";
    if (c.tipo === "monto" || c.tipo === "numero") col.alignment = { horizontal: "right" };
  });
  hoja.views = [{ state: "frozen", ySplit: 3 }];

  const contenido = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([contenido], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo.endsWith(".xlsx") ? nombreArchivo : `${nombreArchivo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
