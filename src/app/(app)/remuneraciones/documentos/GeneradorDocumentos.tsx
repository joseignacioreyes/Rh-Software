"use client";

import { useState } from "react";
import { claseBotonPrimario, claseInput } from "@/components/ui/estilos";

const TIPOS = [
  { codigo: "contrato", nombre: "Contrato de trabajo", detalle: "Con cargo, jornada, remuneración y duración de la ficha." },
  { codigo: "anexo", nombre: "Anexo de contrato", detalle: "Escribe la modificación acordada." },
  { codigo: "carta_aviso", nombre: "Carta de aviso de término", detalle: "Con la causal del Código del Trabajo." },
  { codigo: "cert_remuneraciones", nombre: "Certificado de remuneraciones", detalle: "Remuneraciones e impuesto del año." },
  { codigo: "cert_cotizaciones", nombre: "Certificado de cotizaciones", detalle: "Cotizaciones declaradas del año." },
];

export function GeneradorDocumentos({ trabajadores, causales, anio }: { trabajadores: { id: string; nombre: string }[]; causales: { codigo: number; texto: string }[]; anio: number }) {
  const [trabajador, setTrabajador] = useState(trabajadores[0]?.id ?? "");
  const [tipo, setTipo] = useState("contrato");
  const [texto, setTexto] = useState("");
  const [causal, setCausal] = useState(String(causales.find((c) => c.codigo === 18)?.codigo ?? causales[0].codigo));
  const [fecha, setFecha] = useState("");
  const [anioCert, setAnioCert] = useState(String(anio));
  const params = new URLSearchParams({ tipo, trabajador });
  if (tipo === "anexo") params.set("texto", texto);
  if (tipo === "carta_aviso") { params.set("causal", causal); if (fecha) params.set("fecha", fecha); }
  if (tipo.startsWith("cert_")) params.set("anio", anioCert);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TIPOS.map((t) => (
          <button
            key={t.codigo}
            type="button"
            onClick={() => setTipo(t.codigo)}
            className={`rounded-lg border p-4 text-left ${tipo === t.codigo ? "border-azul bg-celeste/50 ring-2 ring-azul/20" : "border-borde bg-white hover:bg-fondo-suave"}`}
          >
            <p className="font-semibold text-texto">{t.nombre}</p>
            <p className="mt-1 text-xs text-texto-suave">{t.detalle}</p>
          </button>
        ))}
        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-xs text-texto-suave">Los finiquitos se generan desde la pantalla Finiquitos, con su cálculo.</div>
      </div>
      <div className="space-y-3 rounded-lg border border-borde bg-white p-4">
        <label className="block text-sm">Trabajador
          <select value={trabajador} onChange={(e) => setTrabajador(e.target.value)} className={claseInput}>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        {tipo === "anexo" && <label className="block text-sm">Modificación acordada<textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} className={claseInput} placeholder="Ej.: A contar del 01-12-2026 el sueldo base será de $900.000." /></label>}
        {tipo === "carta_aviso" && (
          <>
            <label className="block text-sm">Causal
              <select value={causal} onChange={(e) => setCausal(e.target.value)} className={claseInput}>{causales.map((c) => <option key={c.codigo} value={c.codigo}>{c.texto}</option>)}</select>
            </label>
            <label className="block text-sm">Fecha de término<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput} /></label>
          </>
        )}
        {tipo.startsWith("cert_") && <label className="block text-sm">Año<input type="number" value={anioCert} onChange={(e) => setAnioCert(e.target.value)} className={claseInput} /></label>}
        <a href={`/remuneraciones/documentos/pdf?${params}`} target="_blank" rel="noopener noreferrer" className={`${claseBotonPrimario} w-full ${trabajador ? "" : "pointer-events-none opacity-50"}`}>
          Generar PDF
        </a>
        <p className="text-xs text-texto-suave">Revisa y completa los campos entre corchetes antes de firmar. Cada documento generado queda registrado.</p>
      </div>
    </div>
  );
}
