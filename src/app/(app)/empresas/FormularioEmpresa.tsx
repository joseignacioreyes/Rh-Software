"use client";

import { useActionState, useEffect, useRef } from "react";
import { guardarEmpresa, type EstadoEmpresa } from "./acciones";
import { REGIMENES } from "@/lib/empresas";
import { formatearRut } from "@/lib/rut";
import { claseBotonPrimario, claseError, claseEtiqueta, claseExito, claseInput } from "@/components/ui/estilos";

export type EmpresaFormulario = {
  id?: string;
  rut?: string;
  razon_social?: string;
  nombre_fantasia?: string | null;
  giro?: string | null;
  actividades_economicas?: string[];
  direccion?: string | null;
  comuna?: string | null;
  representante_legal?: string | null;
  rut_representante?: string | null;
  regimen?: string;
  inicio_actividades?: string | null;
  tasa_ppm?: number | null;
  emite_factura_electronica?: boolean;
  organismo_16744?: string | null;
  tasa_cotizacion_adicional?: number | null;
  caja_compensacion?: string | null;
  contacto_nombre?: string | null;
  contacto_correo?: string | null;
  contacto_whatsapp?: string | null;
};

function Campo({
  nombre, etiqueta, estado, ancho = "", ayuda, ...resto
}: { nombre: string; etiqueta: string; estado: EstadoEmpresa; ancho?: string; ayuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const error = estado?.errores?.[nombre];
  return (
    <div className={ancho}>
      <label htmlFor={nombre} className={claseEtiqueta}>{etiqueta}</label>
      <input id={nombre} name={nombre} className={`${claseInput} ${error ? "border-rojo" : ""}`} aria-invalid={!!error} {...resto} />
      {error ? <p className="mt-1 text-xs text-rojo">{error}</p> : ayuda ? <p className="mt-1 text-xs text-texto-suave">{ayuda}</p> : null}
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-borde bg-white p-5">
      <legend className="px-1 text-sm font-bold text-azul">{titulo}</legend>
      <div className="grid grid-cols-6 gap-4">{children}</div>
    </fieldset>
  );
}

const coma = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

export function FormularioEmpresa({ empresa = {}, soloLectura = false }: { empresa?: EmpresaFormulario; soloLectura?: boolean }) {
  const [estado, accion, enviando] = useActionState(guardarEmpresa, undefined);
  const formulario = useRef<HTMLFormElement>(null);

  // Ctrl+S guarda.
  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!soloLectura) formulario.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [soloLectura]);

  const e = empresa;
  return (
    <form ref={formulario} action={accion} className="space-y-5">
      {e.id && <input type="hidden" name="id" value={e.id} />}
      <fieldset disabled={soloLectura} className="space-y-5">
        <Seccion titulo="Identificación">
          <Campo nombre="rut" etiqueta="RUT" estado={estado} ancho="col-span-2" defaultValue={e.rut ? formatearRut(e.rut) : ""} placeholder="76.123.456-7" required />
          <Campo nombre="razon_social" etiqueta="Razón social" estado={estado} ancho="col-span-4" defaultValue={e.razon_social ?? ""} required />
          <Campo nombre="nombre_fantasia" etiqueta="Nombre de fantasía" estado={estado} ancho="col-span-3" defaultValue={e.nombre_fantasia ?? ""} />
          <Campo nombre="giro" etiqueta="Giro" estado={estado} ancho="col-span-3" defaultValue={e.giro ?? ""} />
          <Campo nombre="actividades_economicas" etiqueta="Códigos de actividad económica" estado={estado} ancho="col-span-3" defaultValue={(e.actividades_economicas ?? []).join(", ")} ayuda="Separados por coma, como aparecen en el SII." />
          <Campo nombre="inicio_actividades" etiqueta="Inicio de actividades" type="date" estado={estado} ancho="col-span-3" defaultValue={e.inicio_actividades ?? ""} />
          <Campo nombre="direccion" etiqueta="Dirección" estado={estado} ancho="col-span-4" defaultValue={e.direccion ?? ""} />
          <Campo nombre="comuna" etiqueta="Comuna" estado={estado} ancho="col-span-2" defaultValue={e.comuna ?? ""} />
          <Campo nombre="representante_legal" etiqueta="Representante legal" estado={estado} ancho="col-span-4" defaultValue={e.representante_legal ?? ""} />
          <Campo nombre="rut_representante" etiqueta="RUT representante" estado={estado} ancho="col-span-2" defaultValue={e.rut_representante ? formatearRut(e.rut_representante) : ""} />
        </Seccion>

        <Seccion titulo="Tributario">
          <div className="col-span-3">
            <label htmlFor="regimen" className={claseEtiqueta}>Régimen tributario</label>
            <select id="regimen" name="regimen" defaultValue={e.regimen ?? "propyme_general"} className={claseInput}>
              {REGIMENES.map((r) => <option key={r.codigo} value={r.codigo}>{r.nombre}</option>)}
            </select>
          </div>
          <Campo nombre="tasa_ppm" etiqueta="Tasa de PPM (%)" estado={estado} ancho="col-span-1" inputMode="decimal" defaultValue={coma(e.tasa_ppm)} placeholder="0,25" />
          <div className="col-span-2 flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="emite_factura_electronica" defaultChecked={e.emite_factura_electronica ?? true} className="h-4 w-4 accent-azul" />
              Emite factura electrónica
            </label>
          </div>
        </Seccion>

        <Seccion titulo="Seguridad laboral y previsión (Ley 16.744)">
          <Campo nombre="organismo_16744" etiqueta="Mutual o ISL" estado={estado} ancho="col-span-2" defaultValue={e.organismo_16744 ?? ""} placeholder="ISL, ACHS, Mutual de Seguridad, IST…" />
          <Campo nombre="tasa_cotizacion_adicional" etiqueta="Cotización adicional (%)" estado={estado} ancho="col-span-2" inputMode="decimal" defaultValue={coma(e.tasa_cotizacion_adicional)} ayuda="Tasa adicional diferenciada; la básica va en parámetros legales." />
          <Campo nombre="caja_compensacion" etiqueta="Caja de compensación" estado={estado} ancho="col-span-2" defaultValue={e.caja_compensacion ?? ""} placeholder="Sin caja" />
        </Seccion>

        <Seccion titulo="Contacto del cliente">
          <Campo nombre="contacto_nombre" etiqueta="Nombre" estado={estado} ancho="col-span-2" defaultValue={e.contacto_nombre ?? ""} />
          <Campo nombre="contacto_correo" etiqueta="Correo" type="email" estado={estado} ancho="col-span-2" defaultValue={e.contacto_correo ?? ""} />
          <Campo nombre="contacto_whatsapp" etiqueta="WhatsApp" estado={estado} ancho="col-span-2" defaultValue={e.contacto_whatsapp ? `+${e.contacto_whatsapp}` : ""} placeholder="+56 9 1234 5678" />
        </Seccion>
      </fieldset>

      {estado?.error && <p role="alert" className={claseError}>{estado.error}</p>}
      {estado?.ok && <p role="status" className={claseExito}>{estado.ok}</p>}
      {!soloLectura && (
        <div className="flex items-center gap-3">
          <button type="submit" disabled={enviando} className={claseBotonPrimario}>
            {enviando ? "Guardando…" : e.id ? "Guardar cambios" : "Crear empresa"}
          </button>
          <span className="text-xs text-texto-suave">Ctrl+S para guardar</span>
        </div>
      )}
    </form>
  );
}
