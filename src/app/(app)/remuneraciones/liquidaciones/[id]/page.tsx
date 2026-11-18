import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoModulo } from "@/lib/contexto-contable";
import { NOMBRES_MES } from "@/lib/sesion";
import { formatearRut } from "@/lib/rut";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { linkWhatsApp } from "@/lib/config";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";
import { claseBotonSecundario } from "@/components/ui/estilos";
import { LineasLiquidacion, type Linea } from "./LineasLiquidacion";
import { AccionesLiquidacion } from "./AccionesLiquidacion";

export const metadata: Metadata = { title: "Liquidación" };

export default async function VerLiquidacion({ params }: PageProps<"/remuneraciones/liquidaciones/[id]">) {
  const { id } = await params;
  const { empresa, puedeEditar, supabase } = await contextoModulo("remuneraciones");
  const { data: l } = await supabase.from("liquidaciones").select("*, trabajadores(nombres, apellido_paterno, apellido_materno, rut, cargo, telefono, consentimiento_whatsapp, fecha_ingreso)").eq("id", id).eq("empresa_id", empresa.id).maybeSingle();
  if (!l) notFound();
  const { data: items } = await supabase.from("items_liquidacion").select("codigo, nombre, tipo, monto, detalle").eq("liquidacion_id", id).order("orden");
  // Registro de acceso a datos sensibles (salud, licencias).
  await supabase.rpc("registrar_evento", { p_accion: "ver_liquidacion", p_estudio: l.estudio_id, p_empresa: empresa.id, p_detalle: { liquidacion: id } });

  const t = l.trabajadores as { nombres: string; apellido_paterno: string; apellido_materno: string | null; rut: string; cargo: string | null; telefono: string | null; consentimiento_whatsapp: boolean; fecha_ingreso: string };
  const periodo = `${NOMBRES_MES[l.mes - 1]} ${l.anio}`;
  const lineas = (items ?? []) as Linea[];
  const grupo = (tipo: string) => lineas.filter((i) => i.tipo === tipo);
  const alertas = ((l.detalle as { alertas?: { tono: string; texto: string }[] }).alertas ?? []);
  const telefono = t.telefono?.replace(/\D/g, "");

  return (
    <Pagina>
      <div className="mx-auto max-w-3xl">
        <Encabezado
          titulo={`Liquidación de ${periodo}`}
          descripcion={
            <span className="flex flex-wrap items-center gap-2">
              {t.nombres} {t.apellido_paterno} {t.apellido_materno ?? ""} · <span className="numeros">{formatearRut(t.rut)}</span>
              {l.estado === "aprobada" ? <Etiqueta tono="verde">Aprobada</Etiqueta> : l.estado === "anulada" ? <Etiqueta tono="gris">Anulada</Etiqueta> : <Etiqueta tono="azul">Calculada</Etiqueta>}
            </span>
          }
        >
          <Link href="/remuneraciones/liquidaciones" className={claseBotonSecundario}>Volver</Link>
          <a href={`/remuneraciones/liquidaciones/${id}/pdf`} className={claseBotonSecundario}>Descargar PDF</a>
          {t.consentimiento_whatsapp && telefono && (
            <a
              href={linkWhatsApp(telefono.length === 9 ? `56${telefono}` : telefono, `Hola ${t.nombres}, tu liquidación de sueldo de ${periodo.toLowerCase()} de ${empresa.razon_social} está lista. Líquido a pagar: ${formatoPesos(Number(l.liquido))}.`)}
              target="_blank" rel="noopener noreferrer" className={claseBotonSecundario}
            >
              Enviar aviso por WhatsApp
            </a>
          )}
          {puedeEditar && <AccionesLiquidacion id={id} estado={l.estado} />}
        </Encabezado>

        {alertas.length > 0 && (
          <ul className="mb-3 space-y-1">{alertas.map((a) => <li key={a.texto} className={`rounded-md px-3 py-1.5 text-sm ${a.tono === "rojo" ? "bg-red-50 text-rojo" : "bg-amber-50 text-ambar"}`}>{a.texto}</li>)}</ul>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Días trabajados", String(l.dias_trabajados)], ["Total haberes", formatoPesos(Number(l.total_haberes))], ["Total descuentos", formatoPesos(Number(l.total_descuentos))], ["Líquido a pagar", formatoPesos(Number(l.liquido))]].map(([n, v], i) => (
            <div key={n} className={`rounded-lg border px-3 py-2 ${i === 3 ? "border-verde bg-emerald-50" : "border-borde bg-white"}`}>
              <p className="text-xs text-texto-suave">{n}</p>
              <p className={`numeros font-bold ${i === 3 ? "text-xl text-verde" : "text-lg"}`}>{v}</p>
            </div>
          ))}
        </div>

        <LineasLiquidacion titulo="Haberes imponibles" lineas={grupo("haber_imponible")} total={Number(l.total_imponible)} />
        <LineasLiquidacion titulo="Haberes no imponibles" lineas={grupo("haber_no_imponible")} total={Number(l.total_no_imponible)} />
        <LineasLiquidacion titulo="Descuentos legales" lineas={grupo("descuento_legal")} />
        <LineasLiquidacion titulo="Otros descuentos" lineas={grupo("descuento_otro")} />
        <LineasLiquidacion titulo="Información del cálculo" lineas={grupo("informativo")} informativo />
        <LineasLiquidacion titulo="Aportes del empleador (no se descuentan al trabajador)" lineas={grupo("aporte_empleador")} total={Number(l.aportes_empleador)} />
        <p className="mt-2 text-right text-sm text-texto-suave">Costo total para la empresa: <strong className="numeros text-texto">{formatoPesos(Number(l.costo_empresa))}</strong></p>
        <p className="mt-4 text-xs text-texto-suave">
          Calculada el {formatoFecha(new Date(l.updated_at))} con los parámetros legales vigentes para {periodo.toLowerCase()} (versión de datos {l.version_datos}).
          Toca “?” en cada línea para ver la fórmula, los valores y la fuente oficial. RH Software asiste al contador, que revisa y responde por la liquidación.
        </p>
      </div>
    </Pagina>
  );
}
