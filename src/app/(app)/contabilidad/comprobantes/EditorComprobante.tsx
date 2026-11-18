"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarComprobante } from "./acciones";
import { TIPOS_COMPROBANTE, leerMonto } from "@/lib/contabilidad";
import { formatoPesos } from "@/lib/formato";
import { claseBotonPrimario, claseBotonSecundario, claseError, claseExito } from "@/components/ui/estilos";

type CuentaOpcion = { id: string; codigo: string; nombre: string };
type CentroCosto = { id: string; codigo: string; nombre: string };

type Linea = {
  clave: number;
  cuenta: CuentaOpcion | null;
  texto: string;
  glosa: string;
  debe: number;
  haber: number;
  cc: string;
};

export type ComprobanteInicial = {
  id: string;
  numero: number;
  tipo: string;
  fecha: string;
  glosa: string;
  lineas: { cuenta_id: string; glosa: string | null; debe: number; haber: number; centro_costo_id: string | null }[];
};

type Props = {
  cuentas: CuentaOpcion[];
  centros: CentroCosto[];
  fechaInicial: string;
  inicial?: ComprobanteInicial;
  mesesCerrados: string[]; // "AAAA-MM"
};

let siguienteClave = 1;
const lineaVacia = (): Linea => ({ clave: siguienteClave++, cuenta: null, texto: "", glosa: "", debe: 0, haber: 0, cc: "" });
const etiqueta = (c: CuentaOpcion) => `${c.codigo} ${c.nombre}`;
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const miles = (n: number) => (n ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "");

/** Busca cuentas por código (con o sin puntos) o por nombre. */
function buscarCuentas(cuentas: CuentaOpcion[], q: string): CuentaOpcion[] {
  const t = sinTildes(q.trim());
  if (!t) return cuentas.slice(0, 8);
  if (/^[\d.]+$/.test(t)) {
    const sinPuntos = t.replace(/\./g, "");
    return cuentas.filter((c) => c.codigo.startsWith(t) || c.codigo.replace(/\./g, "").startsWith(sinPuntos)).slice(0, 8);
  }
  const palabras = t.split(/\s+/);
  return cuentas.filter((c) => palabras.every((p) => sinTildes(`${c.codigo} ${c.nombre}`).includes(p))).slice(0, 8);
}

// Columnas navegables con Enter: 0 cuenta, 1 glosa, 2 debe, 3 haber, 4 centro de costo.
export function EditorComprobante({ cuentas, centros, fechaInicial, inicial, mesesCerrados }: Props) {
  const router = useRouter();
  const porId = useMemo(() => new Map(cuentas.map((c) => [c.id, c])), [cuentas]);
  const [tipo, setTipo] = useState(inicial?.tipo ?? "traspaso");
  const [fecha, setFecha] = useState(inicial?.fecha ?? fechaInicial);
  const [glosa, setGlosa] = useState(inicial?.glosa ?? "");
  const [lineas, setLineas] = useState<Linea[]>(() =>
    inicial
      ? inicial.lineas.map((l) => {
          const c = porId.get(l.cuenta_id) ?? null;
          return { clave: siguienteClave++, cuenta: c, texto: c ? etiqueta(c) : "", glosa: l.glosa ?? "", debe: l.debe, haber: l.haber, cc: l.centro_costo_id ?? "" };
        })
      : [lineaVacia(), lineaVacia()],
  );
  const [lista, setLista] = useState<{ fila: number; opciones: CuentaOpcion[]; indice: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<{ numero?: number; id?: string } | null>(null);
  const [guardando, iniciar] = useTransition();
  // Celdas navegables (no es un ref de React: un Map estable para toda la vida del editor).
  const [celdas] = useState(() => new Map<string, HTMLElement>());
  const refGlosa = useRef<HTMLInputElement>(null);
  const columnas = centros.length > 0 ? 5 : 4;

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);
  const diferencia = totalDebe - totalHaber;
  const conMonto = lineas.filter((l) => l.debe > 0 || l.haber > 0);
  const sinCuenta = conMonto.filter((l) => !l.cuenta).length;
  const cuadra = diferencia === 0 && totalDebe > 0 && sinCuenta === 0 && conMonto.length >= 2;
  const mesCerrado = mesesCerrados.includes(fecha.slice(0, 7));

  const enfocar = useCallback((fila: number, col: number) => {
    const poner = () => {
      const el = celdas.get(`${fila}-${col}`);
      if (!el) return false;
      el.focus();
      if (el instanceof HTMLInputElement) el.select();
      return true;
    };
    // Si la celda ya existe, el foco cambia de inmediato (para no perder teclas escritas rápido);
    // si es una fila nueva, se espera a que aparezca.
    if (!poner()) requestAnimationFrame(() => { if (!poner()) setTimeout(poner, 50); });
  }, [celdas]);

  function actualizar(i: number, cambios: Partial<Linea>) {
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambios } : l)));
  }

  function siguiente(fila: number, col: number) {
    const l = lineas[fila];
    // Si puso monto en el debe, salta el haber.
    let destino = col === 2 && l.debe > 0 ? (columnas === 5 ? 4 : 99) : col + 1;
    if (destino >= columnas) {
      if (fila === lineas.length - 1) {
        // En la última línea: si ya cuadra, no agrega más; si no, agrega una nueva.
        if (diferencia === 0 && totalDebe > 0) {
          celdas.get("guardar")?.focus();
          return;
        }
        setLineas((ls) => [...ls, lineaVacia()]);
      }
      destino = 0;
      enfocar(fila + 1, destino);
      return;
    }
    enfocar(fila, destino);
  }

  function elegirCuenta(fila: number, c: CuentaOpcion) {
    actualizar(fila, { cuenta: c, texto: etiqueta(c) });
    setLista(null);
    enfocar(fila, 1);
  }

  function alTeclearCelda(e: React.KeyboardEvent, fila: number, col: number) {
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (e.shiftKey) {
        if (col > 0) enfocar(fila, col - 1);
        else if (fila > 0) enfocar(fila - 1, columnas - 1);
        return;
      }
      siguiente(fila, col);
    } else if (e.key === "Delete" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      quitarLinea(fila);
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && col !== 0) {
      e.preventDefault();
      const f = fila + (e.key === "ArrowDown" ? 1 : -1);
      if (f >= 0 && f < lineas.length) enfocar(f, col);
    }
  }

  function alTeclearCuenta(e: React.KeyboardEvent, fila: number) {
    const abierta = lista?.fila === fila && lista.opciones.length > 0;
    if (abierta && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setLista((l) => l && { ...l, indice: Math.max(0, Math.min(l.opciones.length - 1, l.indice + (e.key === "ArrowDown" ? 1 : -1))) });
      return;
    }
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      // Solo elige de la lista si el usuario escribió algo (evita elegir la primera cuenta por accidente).
      if (abierta && lineas[fila].texto.trim() && !lineas[fila].cuenta) return elegirCuenta(fila, lista!.opciones[lista!.indice]);
      if (lineas[fila].cuenta) return siguiente(fila, 0);
      // Línea vacía al final: Enter salta a guardar.
      if (!lineas[fila].texto && fila === lineas.length - 1 && fila >= 2) return celdas.get("guardar")?.focus();
      return;
    }
    if (e.key === "Escape") {
      setLista(null);
      const c = lineas[fila].cuenta;
      actualizar(fila, { texto: c ? etiqueta(c) : "" });
      return;
    }
    alTeclearCelda(e, fila, 0);
  }

  function alTeclearMonto(e: React.KeyboardEvent, fila: number, col: 2 | 3) {
    // "=" completa con lo que falta para cuadrar.
    if (e.key === "=") {
      e.preventDefault();
      const l = lineas[fila];
      const sinEsta = diferencia - l.debe + l.haber;
      if (col === 2 && sinEsta < 0) actualizar(fila, { debe: -sinEsta, haber: 0 });
      if (col === 3 && sinEsta > 0) actualizar(fila, { haber: sinEsta, debe: 0 });
      return;
    }
    alTeclearCelda(e, fila, col);
  }

  function quitarLinea(fila: number) {
    setLineas((ls) => (ls.length <= 2 ? ls.map((l, j) => (j === fila ? lineaVacia() : l)) : ls.filter((_, j) => j !== fila)));
    enfocar(Math.max(0, fila - 1), 0);
  }

  const guardar = useCallback(() => {
    setError(null);
    if (!cuadra) {
      setError(sinCuenta > 0 ? "Hay líneas con monto pero sin cuenta." : diferencia !== 0 ? `No cuadra: diferencia de ${formatoPesos(diferencia)}.` : "Agrega al menos dos líneas con monto.");
      return;
    }
    iniciar(async () => {
      const r = await guardarComprobante({
        id: inicial?.id ?? null,
        tipo: tipo as "ingreso",
        fecha,
        glosa,
        lineas: conMonto.map((l) => ({ cuenta_id: l.cuenta!.id, glosa: l.glosa, debe: l.debe, haber: l.haber, centro_costo_id: l.cc || null })),
      });
      if (r.error) return setError(r.error);
      if (inicial) {
        router.push(`/contabilidad/comprobantes/${inicial.id}?guardado=1`);
        return;
      }
      // Listo para el siguiente: mismo tipo y fecha, líneas en blanco.
      setExito({ numero: r.numero, id: r.id });
      setGlosa("");
      setLineas([lineaVacia(), lineaVacia()]);
      requestAnimationFrame(() => refGlosa.current?.focus());
      router.refresh();
    });
  }, [cuadra, sinCuenta, diferencia, inicial, tipo, fecha, glosa, conMonto, router]);

  // Ctrl+S o Ctrl+Enter guardan desde cualquier campo.
  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "s" || e.key === "Enter")) {
        e.preventDefault();
        guardar();
      }
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [guardar]);

  const registrar = (k: string) => (el: HTMLElement | null) => {
    if (el) celdas.set(k, el);
    else celdas.delete(k);
  };
  const claseCelda = "w-full border-0 bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-celeste/60 focus:ring-2 focus:ring-azul/40 focus:ring-inset";

  return (
    <div className="space-y-3">
      {exito && (
        <p className={claseExito} role="status">
          Comprobante N° {exito.numero} guardado.{" "}
          <Link href={`/contabilidad/comprobantes/${exito.id}`} className="underline">Verlo</Link>. Puedes seguir con el siguiente.
        </p>
      )}

      <div className="grid grid-cols-[160px_170px_1fr] gap-3 rounded-lg border border-borde bg-white p-4">
        <div>
          <label htmlFor="c-tipo" className="mb-1 block text-xs font-semibold text-texto-suave">Tipo</label>
          <select id="c-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            {TIPOS_COMPROBANTE.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="c-fecha" className="mb-1 block text-xs font-semibold text-texto-suave">Fecha</label>
          <input id="c-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`numeros w-full rounded-md border px-2 py-1.5 text-sm ${mesCerrado ? "border-rojo" : "border-gray-300"}`} />
        </div>
        <div>
          <label htmlFor="c-glosa" className="mb-1 block text-xs font-semibold text-texto-suave">Glosa</label>
          <input
            id="c-glosa"
            ref={refGlosa}
            autoFocus
            value={glosa}
            onChange={(e) => setGlosa(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.ctrlKey) {
                e.preventDefault();
                enfocar(0, 0);
              }
            }}
            placeholder="Ej.: Compra de mercaderías factura 1234"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        {mesCerrado && <p className="col-span-3 text-sm text-rojo">El mes de esa fecha está cerrado. Para registrar en él, reábrelo en “Cierre de periodo”.</p>}
      </div>

      <div className="rounded-lg border border-borde bg-white">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-[34%]" />
            <col />
            <col className="w-40" />
            <col className="w-40" />
            {columnas === 5 && <col className="w-36" />}
            <col className="w-10" />
          </colgroup>
          <thead className="bg-fondo-suave text-xs text-texto-suave">
            <tr>
              <th className="px-2 py-2 text-right font-semibold">#</th>
              <th className="px-2 py-2 text-left font-semibold">Cuenta (código o nombre)</th>
              <th className="px-2 py-2 text-left font-semibold">Glosa de la línea</th>
              <th className="px-2 py-2 text-right font-semibold">Debe</th>
              <th className="px-2 py-2 text-right font-semibold">Haber</th>
              {columnas === 5 && <th className="px-2 py-2 text-left font-semibold">Centro de costo</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={l.clave} className="border-t border-gray-100">
                <td className="numeros px-2 text-right text-xs text-texto-suave">{i + 1}</td>
                <td className="relative">
                  <input
                    ref={registrar(`${i}-0`)}
                    value={l.texto}
                    aria-label={`Cuenta de la línea ${i + 1}`}
                    role="combobox"
                    aria-expanded={lista?.fila === i}
                    aria-controls={`cuentas-${l.clave}`}
                    aria-autocomplete="list"
                    onChange={(e) => {
                      const texto = e.target.value;
                      actualizar(i, { texto, cuenta: null });
                      setLista({ fila: i, opciones: buscarCuentas(cuentas, texto), indice: 0 });
                    }}
                    onFocus={() => setLista({ fila: i, opciones: buscarCuentas(cuentas, l.cuenta ? "" : l.texto), indice: 0 })}
                    onBlur={() => setTimeout(() => setLista((x) => (x?.fila === i ? null : x)), 150)}
                    onKeyDown={(e) => alTeclearCuenta(e, i)}
                    className={`${claseCelda} ${l.texto && !l.cuenta ? "text-rojo" : ""}`}
                    placeholder={i === 0 ? "Escribe 1101 o “caja”" : ""}
                  />
                  {lista?.fila === i && lista.opciones.length > 0 && (
                    <ul id={`cuentas-${l.clave}`} role="listbox" className="absolute top-full left-0 z-30 mt-0.5 w-[460px] overflow-hidden rounded-md border border-borde bg-white shadow-lg">
                      {lista.opciones.map((c, k) => (
                        <li
                          key={c.id}
                          role="option"
                          aria-selected={k === lista.indice}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            elegirCuenta(i, c);
                          }}
                          className={`flex cursor-pointer gap-3 px-3 py-1.5 text-sm ${k === lista.indice ? "bg-celeste" : ""}`}
                        >
                          <span className="numeros w-24 shrink-0 text-texto-suave">{c.codigo}</span>
                          <span className="truncate">{c.nombre}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>
                  <input
                    ref={registrar(`${i}-1`)}
                    value={l.glosa}
                    placeholder={glosa}
                    aria-label={`Glosa de la línea ${i + 1}`}
                    onChange={(e) => actualizar(i, { glosa: e.target.value })}
                    onKeyDown={(e) => alTeclearCelda(e, i, 1)}
                    className={`${claseCelda} placeholder:text-gray-300`}
                  />
                </td>
                <td>
                  <input
                    ref={registrar(`${i}-2`)}
                    inputMode="numeric"
                    value={miles(l.debe)}
                    aria-label={`Debe de la línea ${i + 1}`}
                    onChange={(e) => {
                      const v = Math.abs(leerMonto(e.target.value));
                      actualizar(i, { debe: v, haber: v > 0 ? 0 : l.haber });
                    }}
                    onKeyDown={(e) => alTeclearMonto(e, i, 2)}
                    className={`${claseCelda} numeros text-right`}
                  />
                </td>
                <td>
                  <input
                    ref={registrar(`${i}-3`)}
                    inputMode="numeric"
                    value={miles(l.haber)}
                    aria-label={`Haber de la línea ${i + 1}`}
                    onChange={(e) => {
                      const v = Math.abs(leerMonto(e.target.value));
                      actualizar(i, { haber: v, debe: v > 0 ? 0 : l.debe });
                    }}
                    onKeyDown={(e) => alTeclearMonto(e, i, 3)}
                    className={`${claseCelda} numeros text-right`}
                  />
                </td>
                {columnas === 5 && (
                  <td>
                    <select
                      ref={registrar(`${i}-4`)}
                      value={l.cc}
                      aria-label={`Centro de costo de la línea ${i + 1}`}
                      onChange={(e) => actualizar(i, { cc: e.target.value })}
                      onKeyDown={(e) => alTeclearCelda(e, i, 4)}
                      className={`${claseCelda} text-texto-suave`}
                    >
                      <option value="">—</option>
                      {centros.map((c) => <option key={c.id} value={c.id}>{c.codigo} {c.nombre}</option>)}
                    </select>
                  </td>
                )}
                <td className="text-center">
                  <button type="button" tabIndex={-1} onClick={() => quitarLinea(i)} className="text-gray-300 hover:text-rojo" aria-label={`Quitar línea ${i + 1}`} title="Quitar línea (Ctrl+Supr)">×</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-borde bg-fondo-suave">
            <tr className="font-semibold">
              <td />
              <td className="px-2 py-2">
                <button type="button" onClick={() => { setLineas((ls) => [...ls, lineaVacia()]); enfocar(lineas.length, 0); }} className="text-xs font-medium text-azul hover:underline">
                  + Agregar línea
                </button>
              </td>
              <td className="px-2 py-2 text-right text-xs text-texto-suave">Totales</td>
              <td className="numeros px-2 py-2 text-right">{formatoPesos(totalDebe)}</td>
              <td className="numeros px-2 py-2 text-right">{formatoPesos(totalHaber)}</td>
              {columnas === 5 && <td />}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span
          role="status"
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${cuadra ? "bg-emerald-50 text-verde" : totalDebe + totalHaber === 0 ? "bg-gray-100 text-texto-suave" : "bg-red-50 text-rojo"}`}
        >
          {totalDebe + totalHaber === 0 ? "Sin montos" : diferencia === 0 ? (sinCuenta ? "Falta la cuenta en una línea" : "Cuadra") : `No cuadra: diferencia ${formatoPesos(Math.abs(diferencia))} ${diferencia > 0 ? "al debe" : "al haber"}`}
        </span>
        {error && <span className={claseError} role="alert">{error}</span>}
        <div className="ml-auto flex items-center gap-2">
          <Link href={inicial ? `/contabilidad/comprobantes/${inicial.id}` : "/contabilidad/comprobantes"} className={claseBotonSecundario}>
            {inicial ? "Cancelar" : "Volver"}
          </Link>
          <button ref={registrar("guardar")} type="button" onClick={guardar} disabled={guardando || mesCerrado} className={claseBotonPrimario}>
            {guardando ? "Guardando…" : inicial ? `Guardar N° ${inicial.numero}` : "Guardar"}
            <kbd className="rounded bg-white/20 px-1 font-mono text-[10px]">Ctrl S</kbd>
          </button>
        </div>
      </div>

      <p className="text-xs text-texto-suave">
        <kbd className="font-mono">Enter</kbd> siguiente celda · <kbd className="font-mono">Shift+Enter</kbd> anterior ·{" "}
        <kbd className="font-mono">=</kbd> en debe o haber completa la diferencia · <kbd className="font-mono">Ctrl+Supr</kbd> quita la línea ·{" "}
        <kbd className="font-mono">Ctrl+S</kbd> guarda
      </p>
    </div>
  );
}
