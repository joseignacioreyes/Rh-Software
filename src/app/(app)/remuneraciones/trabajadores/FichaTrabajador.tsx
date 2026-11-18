"use client";

import { useActionState, useState } from "react";
import { guardarTrabajador } from "./acciones";
import { claseBotonPrimario, claseError, claseExito, claseInput } from "@/components/ui/estilos";
import { formatearRut } from "@/lib/rut";

export type Trabajador = Record<string, string | number | boolean | null>;
type Institucion = { codigo: string; nombre: string; tipo: string };

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-borde bg-white p-5">
      <legend className="px-1 text-sm font-bold text-azul">{titulo}</legend>
      <div className="grid grid-cols-6 gap-3">{children}</div>
    </fieldset>
  );
}

function C({ n, e, t, ancho = "col-span-2", ...resto }: { n: string; e: string; t?: Trabajador; ancho?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const valor = t?.[n];
  return (
    <label className={`${ancho} text-sm`}>
      {e}
      <input name={n} defaultValue={valor === null || valor === undefined ? "" : String(valor)} className={claseInput} {...resto} />
    </label>
  );
}

export function FichaTrabajador({ t, instituciones, soloLectura }: { t?: Trabajador; instituciones: Institucion[]; soloLectura: boolean }) {
  const [estado, accion, enviando] = useActionState(guardarTrabajador, undefined);
  const [salud, setSalud] = useState(String(t?.salud ?? "fonasa"));
  const [contrato, setContrato] = useState(String(t?.tipo_contrato ?? "indefinido"));
  const afps = instituciones.filter((i) => i.tipo === "afp");
  const saludes = instituciones.filter((i) => i.tipo === "fonasa" || i.tipo === "isapre");
  const miles = (v: unknown) => (v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("es-CL"));

  return (
    <form action={accion} className="space-y-4">
      {t?.id && <input type="hidden" name="id" value={String(t.id)} />}
      <fieldset disabled={soloLectura} className="space-y-4">
        <Seccion titulo="Datos personales">
          <label className="col-span-2 text-sm">RUT<input name="rut" defaultValue={t?.rut ? formatearRut(String(t.rut)) : ""} className={claseInput} required /></label>
          <C n="nombres" e="Nombres" t={t} required />
          <C n="apellido_paterno" e="Apellido paterno" t={t} required />
          <C n="apellido_materno" e="Apellido materno" t={t} />
          <C n="fecha_nacimiento" e="Fecha de nacimiento" t={t} type="date" />
          <label className="col-span-1 text-sm">Sexo
            <select name="sexo" defaultValue={String(t?.sexo ?? "")} className={claseInput}><option value="">—</option><option value="F">F</option><option value="M">M</option><option value="X">Otro</option></select>
          </label>
          <C n="nacionalidad" e="Nacionalidad" t={t} ancho="col-span-1" />
          <C n="direccion" e="Dirección" t={t} ancho="col-span-3" />
          <C n="comuna" e="Comuna" t={t} ancho="col-span-1" />
          <C n="correo" e="Correo" t={t} type="email" />
          <C n="telefono" e="Celular" t={t} />
          <label className="col-span-2 flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="consentimiento_whatsapp" defaultChecked={!!t?.consentimiento_whatsapp} className="h-4 w-4 accent-azul" />Aceptó recibir su liquidación por WhatsApp</label>
        </Seccion>

        <Seccion titulo="Contrato">
          <C n="cargo" e="Cargo" t={t} />
          <label className="col-span-2 text-sm">Tipo de contrato
            <select name="tipo_contrato" value={contrato} onChange={(e) => setContrato(e.target.value)} className={claseInput}>
              <option value="indefinido">Indefinido</option><option value="plazo_fijo">Plazo fijo</option><option value="obra">Por obra o faena</option>
            </select>
          </label>
          <C n="jornada_horas" e="Jornada (horas semanales)" t={t} inputMode="decimal" ancho="col-span-2" required />
          <C n="fecha_ingreso" e="Fecha de ingreso" t={t} type="date" required />
          <C n="fecha_termino" e={contrato === "indefinido" ? "Fecha de término (si terminó)" : "Fecha de término del contrato"} t={t} type="date" />
          <label className="col-span-2 text-sm">Trabajo pesado
            <select name="trabajo_pesado" defaultValue={String(t?.trabajo_pesado ?? "no")} className={claseInput}><option value="no">No</option><option value="pesado">Pesado</option><option value="menos_pesado">Menos pesado</option></select>
          </label>
        </Seccion>

        <Seccion titulo="Remuneración">
          <label className="col-span-2 text-sm">Sueldo base mensual<input name="sueldo_base" defaultValue={miles(t?.sueldo_base)} inputMode="numeric" className={`${claseInput} numeros`} required /></label>
          <label className="col-span-2 text-sm">Gratificación
            <select name="gratificacion" defaultValue={String(t?.gratificacion ?? "art50_mensual")} className={claseInput}><option value="art50_mensual">Art. 50 mensual (25% con tope)</option><option value="sin">Sin gratificación mensual</option></select>
          </label>
          <label className="col-span-1 text-sm">Colación<input name="colacion" defaultValue={miles(t?.colacion)} inputMode="numeric" className={`${claseInput} numeros`} /></label>
          <label className="col-span-1 text-sm">Movilización<input name="movilizacion" defaultValue={miles(t?.movilizacion)} inputMode="numeric" className={`${claseInput} numeros`} /></label>
          <label className="col-span-2 text-sm">Forma de pago
            <select name="forma_pago" defaultValue={String(t?.forma_pago ?? "transferencia")} className={claseInput}><option value="transferencia">Transferencia</option><option value="cheque">Cheque</option><option value="efectivo">Efectivo</option></select>
          </label>
          <C n="banco" e="Banco (si el cliente lo entrega)" t={t} />
          <C n="cuenta_bancaria" e="N° de cuenta" t={t} />
        </Seccion>

        <Seccion titulo="Previsión y salud">
          <label className="col-span-2 text-sm">AFP
            <select name="afp" defaultValue={String(t?.afp ?? "")} className={claseInput}>
              <option value="">— No cotiza en AFP —</option>
              {afps.map((a) => <option key={a.codigo} value={a.codigo}>{a.nombre}</option>)}
            </select>
          </label>
          <label className="col-span-2 flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="pensionado" defaultChecked={!!t?.pensionado} className="h-4 w-4 accent-azul" />Pensionado</label>
          <label className="col-span-2 flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="seguro_cesantia" defaultChecked={t ? !!t.seguro_cesantia : true} className="h-4 w-4 accent-azul" />Cotiza seguro de cesantía</label>
          <label className="col-span-2 text-sm">Salud
            <select name="salud" value={salud} onChange={(e) => setSalud(e.target.value)} className={claseInput}>
              {saludes.map((s) => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}
            </select>
          </label>
          {salud.startsWith("isapre") && (
            <>
              <C n="plan_isapre_uf" e="Plan Isapre (UF)" t={t} inputMode="decimal" ancho="col-span-1" />
              <C n="plan_isapre_pesos" e="o plan en pesos" t={t} inputMode="numeric" ancho="col-span-1" />
            </>
          )}
          <C n="cargas_familiares" e="Cargas familiares" t={t} type="number" min={0} ancho="col-span-2" />
        </Seccion>
      </fieldset>
      {estado?.error && <p className={claseError}>{estado.error}</p>}
      {estado?.ok && <p className={claseExito}>{estado.ok}</p>}
      {!soloLectura && <button type="submit" disabled={enviando} className={claseBotonPrimario}>{enviando ? "Guardando…" : t?.id ? "Guardar ficha" : "Crear trabajador"}</button>}
    </form>
  );
}
