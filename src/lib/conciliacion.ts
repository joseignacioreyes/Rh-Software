// Sugerencias de pareo entre movimientos de la cartola y líneas contables de la cuenta banco.
// Regla: mismo monto (abono = debe en la cuenta banco; cargo = haber) y fecha cercana.
// Se prefiere la de fecha más cercana y, si empatan, la que comparte número de documento en la glosa.

export type MovimientoBanco = { id: string; fecha: string; monto: number; descripcion: string; documento: string | null };
export type LineaBanco = { id: string; fecha: string; debe: number; haber: number; glosa: string; numero: number };

const dias = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);

export function sugerirPareos(movs: MovimientoBanco[], lineas: LineaBanco[], toleranciaDias = 5) {
  const usadas = new Set<string>();
  const sugerencias = new Map<string, string>();
  // Primero los movimientos con menos candidatos (más seguros).
  const candidatos = movs.map((m) => ({
    m,
    c: lineas.filter((l) => (m.monto > 0 ? l.debe === m.monto : l.haber === -m.monto) && dias(m.fecha, l.fecha) <= toleranciaDias),
  }));
  candidatos.sort((a, b) => a.c.length - b.c.length);
  for (const { m, c } of candidatos) {
    const libres = c.filter((l) => !usadas.has(l.id));
    if (!libres.length) continue;
    libres.sort((a, b) => {
      const d = dias(m.fecha, a.fecha) - dias(m.fecha, b.fecha);
      if (d !== 0) return d;
      const doc = (l: LineaBanco) => (m.documento && l.glosa.includes(m.documento) ? 0 : 1);
      return doc(a) - doc(b);
    });
    sugerencias.set(m.id, libres[0].id);
    usadas.add(libres[0].id);
  }
  return sugerencias;
}
