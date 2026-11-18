"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claseBotonPrimario, claseBotonSecundario, claseEtiqueta, claseError, claseExito, claseInput } from "@/components/ui/estilos";
import { leerConIA, registrarEnLibro, descartar, reabrir, crearSolicitud, cerrarSolicitud, subirDesdeEstudio } from "./acciones";

type Resultado = { ok?: string; error?: string } | null;

// Tipos de documento más comunes (código SII).
const TIPOS = [
  [33, "Factura electrónica (33)"], [34, "Factura exenta (34)"], [30, "Factura papel (30)"], [46, "Factura de compra (46)"],
  [56, "Nota de débito (56)"], [61, "Nota de crédito (61)"], [39, "Boleta (39)"],
] as const;
const DESDE_IA: Record<string, number> = { factura: 33, factura_exenta: 34, boleta: 39, nota_credito: 61, nota_debito: 56 };

type Datos = Record<string, unknown> | null;

/** Formulario para confirmar los datos (leídos por IA o a mano) y registrarlos en el libro. */
export function FormularioRegistro({ id, datos, leidoCon }: { id: string; datos: Datos; leidoCon: string | null }) {
  const [estado, accion, pendiente] = useActionState(registrarEnLibro, null as Resultado);
  const d = datos ?? {};
  const n = (k: string) => (d[k] == null ? "" : String(d[k]));
  const [neto, setNeto] = useState(n("monto_neto") || n("neto"));
  const [exento, setExento] = useState(n("monto_exento") || n("exento") || "0");
  const [iva, setIva] = useState(n("monto_iva") || n("iva"));
  const [total, setTotal] = useState(n("monto_total") || n("total"));
  const suma = (Number(neto) || 0) + (Number(exento) || 0) + (Number(iva) || 0);
  const cuadra = total !== "" && suma === Number(total);
  const tipo = Number(d.codigo_sii ?? d.tipo_doc ?? DESDE_IA[String(d.tipo_documento)] ?? 33);

  return (
    <form action={accion} className="mt-4 space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="leido_con" value={leidoCon ?? ""} />
      {leidoCon === "ia" && d.confianza != null && (
        <p className={`rounded-md px-3 py-2 text-sm ${d.confianza === "alta" ? "bg-emerald-50 text-verde" : "bg-amber-50 text-ambar"}`}>
          La IA leyó este documento con confianza <b>{String(d.confianza)}</b>. Revisa cada dato antes de registrar.
          {d.cuenta_sugerida ? <> Cuenta sugerida: <b>{String(d.cuenta_sugerida)}</b>.</> : null}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label><span className={claseEtiqueta}>Libro</span>
          <select name="libro" defaultValue={n("libro") || "compras"} className={claseInput}><option value="compras">Compras</option><option value="ventas">Ventas</option></select>
        </label>
        <label><span className={claseEtiqueta}>Tipo de documento</span>
          <select name="tipo_doc" defaultValue={tipo} className={claseInput}>{TIPOS.map(([c, t]) => <option key={c} value={c}>{t}</option>)}</select>
        </label>
        <label><span className={claseEtiqueta}>Folio</span><input name="folio" defaultValue={n("folio")} className={claseInput} required /></label>
        <label><span className={claseEtiqueta}>Fecha</span><input type="date" name="fecha" defaultValue={n("fecha")} className={claseInput} required /></label>
        <label><span className={claseEtiqueta}>RUT del emisor</span><input name="rut" defaultValue={n("rut_emisor") || n("rut")} placeholder="76.123.456-7" className={claseInput} required /></label>
        <label><span className={claseEtiqueta}>Razón social</span><input name="razon_social" defaultValue={n("razon_social_emisor") || n("razon_social")} className={claseInput} /></label>
        <label><span className={claseEtiqueta}>Neto</span><input name="neto" inputMode="numeric" value={neto} onChange={(e) => setNeto(e.target.value.replace(/\D/g, ""))} className={`${claseInput} numeros text-right`} /></label>
        <label><span className={claseEtiqueta}>Exento</span><input name="exento" inputMode="numeric" value={exento} onChange={(e) => setExento(e.target.value.replace(/\D/g, ""))} className={`${claseInput} numeros text-right`} /></label>
        <label><span className={claseEtiqueta}>IVA</span><input name="iva" inputMode="numeric" value={iva} onChange={(e) => setIva(e.target.value.replace(/\D/g, ""))} className={`${claseInput} numeros text-right`} /></label>
        <label><span className={claseEtiqueta}>Total</span><input name="total" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} className={`${claseInput} numeros text-right`} /></label>
      </div>
      <p className={`text-sm ${cuadra ? "text-verde" : "text-ambar"}`}>
        {cuadra ? "✓ Neto + exento + IVA = total: cuadra." : `Neto + exento + IVA = ${suma.toLocaleString("es-CL")}. Debe ser igual al total.`}
      </p>
      {estado?.error && <p className={claseError}>{estado.error}</p>}
      {estado?.ok && <p className={claseExito}>{estado.ok}</p>}
      <button type="submit" disabled={pendiente || !cuadra} className={claseBotonPrimario}>{pendiente ? "Registrando…" : "Confirmar y registrar en el libro"}</button>
    </form>
  );
}

export function BotonesDocumento({ id, ia, reabrir: esReabrir }: { id: string; ia: boolean; reabrir?: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<Resultado>(null);
  if (esReabrir) {
    return <button type="button" className={`${claseBotonSecundario} mt-2`} disabled={pendiente} onClick={() => iniciar(async () => { await reabrir(id); router.refresh(); })}>Volver a revisar</button>;
  }
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        <button type="button" disabled={pendiente || !ia} title={ia ? "" : "Requiere la clave de la API de Claude"} className={claseBotonSecundario}
          onClick={() => iniciar(async () => { const r = await leerConIA(id); setMensaje(r); router.refresh(); })}>
          {pendiente ? "Leyendo…" : "Leer con IA"}
        </button>
        <button type="button" disabled={pendiente} className={claseBotonSecundario}
          onClick={() => { if (confirm("¿Descartar este documento? No se borra: queda en la bandeja como descartado.")) iniciar(async () => { await descartar(id); router.refresh(); }); }}>
          Descartar
        </button>
      </div>
      {mensaje?.error && <p className={claseError}>{mensaje.error}</p>}
      {mensaje?.ok && <p className={claseExito}>{mensaje.ok}</p>}
    </div>
  );
}

export function NuevaSolicitud() {
  const [estado, accion, pendiente] = useActionState(crearSolicitud, null as Resultado);
  return (
    <form action={accion} className="space-y-2 rounded-md bg-fondo-suave p-3">
      <p className="text-sm font-semibold">Pedir algo al cliente</p>
      <input name="titulo" placeholder="Ej.: Envíame las facturas de compra de octubre" className={claseInput} required />
      <textarea name="detalle" rows={2} placeholder="Detalle (opcional)" className={claseInput} />
      {estado?.error && <p className={claseError}>{estado.error}</p>}
      {estado?.ok && <p className={claseExito}>{estado.ok}</p>}
      <button type="submit" disabled={pendiente} className={claseBotonPrimario}>Enviar al portal</button>
    </form>
  );
}

export function BotonCerrarSolicitud({ id }: { id: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return <button type="button" disabled={pendiente} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-fondo-suave" onClick={() => iniciar(async () => { await cerrarSolicitud(id); router.refresh(); })}>Cerrar</button>;
}

export function SubirEnBandeja() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <>
      <button type="button" disabled={pendiente} className={claseBotonSecundario} onClick={() => entrada.current?.click()}>{pendiente ? "Subiendo…" : "Agregar documentos"}</button>
      <input ref={entrada} type="file" multiple accept="image/*,application/pdf,.xlsx,.xls,.csv" className="hidden"
        onChange={(e) => {
          const fd = new FormData();
          Array.from(e.target.files ?? []).forEach((a) => fd.append("archivos", a));
          iniciar(async () => { const r = await subirDesdeEstudio(fd); if (r.error) alert(r.error); router.refresh(); });
        }} />
    </>
  );
}
