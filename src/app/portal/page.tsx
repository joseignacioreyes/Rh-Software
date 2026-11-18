import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerContexto, esCliente, nombrePeriodo, NOMBRES_MES } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Parametros } from "@/lib/parametros";
import { vencimiento } from "@/lib/f29";
import { formatoPesos, formatoFecha } from "@/lib/formato";
import { Logo } from "@/components/marca/Logo";
import { cerrarSesion } from "@/app/ingresar/acciones";
import { SubirDocumentos } from "./SubirDocumentos";
import { Solicitud } from "./Solicitud";

export const metadata: Metadata = { title: "Mi empresa" };

const ESTADO_ENVIO: Record<string, string> = { pendiente: "Recibido, por revisar", registrado: "Registrado por tu contador", descartado: "Revisado" };

/** Portal del cliente: estado del mes en lenguaje simple, subir documentos, responder y descargar. */
export default async function Portal() {
  const ctx = await obtenerContexto();
  const empresa = ctx.empresa;
  if (!empresa || !esCliente(ctx, empresa.id)) redirect("/mi-mes");
  const supabase = await clienteServidor();
  const p = ctx.periodo;
  const mes = NOMBRES_MES[p.mes - 1].toLowerCase();
  const [{ data: f29 }, { data: liqs }, { data: solicitudes }, { data: envios }, { data: emp }, { data: feriados }, params] = await Promise.all([
    supabase.from("f29_propuestas").select("estado, total_a_pagar").eq("empresa_id", empresa.id).eq("anio", p.anio).eq("mes", p.mes).maybeSingle(),
    supabase.from("liquidaciones").select("id, liquido, trabajadores(nombres, apellido_paterno)").eq("empresa_id", empresa.id).eq("anio", p.anio).eq("mes", p.mes),
    supabase.from("solicitudes_cliente").select("id, titulo, detalle, estado, respuesta, created_at").eq("empresa_id", empresa.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("documentos_bandeja").select("id, nombre_archivo, estado, created_at").eq("empresa_id", empresa.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("empresas").select("emite_factura_electronica").eq("id", empresa.id).single(),
    supabase.from("feriados").select("fecha"),
    Parametros.cargar(supabase),
  ]);
  const dia = params.buscar(emp?.emite_factura_electronica ? "VENC_F29_DIA_ELECTRONICO" : "VENC_F29_DIA", `${p.anio}-${String(p.mes).padStart(2, "0")}-01`)?.valor;
  const vence = dia ? vencimiento(p.anio, p.mes, dia, new Set((feriados ?? []).map((x) => x.fecha))) : null;
  const pendientes = (solicitudes ?? []).filter((s) => s.estado === "pendiente");
  const venceTexto = vence ? `el ${Number(vence.slice(8, 10))} de ${NOMBRES_MES[Number(vence.slice(5, 7)) - 1].toLowerCase()}` : "";

  let iva: { titulo: string; texto: string; tono: "verde" | "azul" | "gris" };
  if (f29?.estado === "pagado" || f29?.estado === "declarado") iva = { titulo: `Tu IVA de ${mes} está pagado`, texto: `Se declararon y pagaron ${formatoPesos(Number(f29.total_a_pagar))}. No tienes que hacer nada más.`, tono: "verde" };
  else if (f29?.estado === "revisado") iva = { titulo: `Tu IVA de ${mes} está listo`, texto: Number(f29.total_a_pagar) > 0 ? `Debes pagar ${formatoPesos(Number(f29.total_a_pagar))} antes ${venceTexto ? `del ${venceTexto.slice(3)}` : "del vencimiento"}.` : "Este mes no tienes impuesto que pagar.", tono: "azul" };
  else iva = { titulo: `Estamos preparando tu IVA de ${mes}`, texto: "Te avisaremos cuando esté listo para pagar.", tono: "gris" };
  const colores = { verde: "border-verde bg-emerald-50", azul: "border-azul bg-celeste", gris: "border-borde bg-white" };

  return (
    <div className="min-h-screen bg-fondo-suave">
      <header className="flex items-center justify-between border-b border-borde bg-white px-4 py-3">
        <Logo />
        <form action={cerrarSesion}><button type="submit" className="text-sm text-texto-suave hover:text-rojo">Salir</button></form>
      </header>
      <main className="mx-auto max-w-lg space-y-4 px-4 py-5">
        <div>
          <p className="text-sm text-texto-suave">Hola, {ctx.usuario.nombre.split(" ")[0]}</p>
          <h1 className="text-xl font-bold text-azul">{empresa.razon_social}</h1>
          <p className="text-sm text-texto-suave">Resumen de {nombrePeriodo(p).toLowerCase()}</p>
        </div>

        <section className={`rounded-xl border-2 p-4 ${colores[iva.tono]}`}>
          <h2 className="text-lg font-bold text-texto">{iva.titulo}</h2>
          <p className="mt-1 text-texto">{iva.texto}</p>
        </section>

        {pendientes.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-bold text-texto">Tu contador te pide</h2>
            {pendientes.map((s) => <Solicitud key={s.id} id={s.id} titulo={s.titulo} detalle={s.detalle} />)}
          </section>
        )}

        <SubirDocumentos />

        {(liqs ?? []).length > 0 && (
          <section className="rounded-xl border border-borde bg-white p-4">
            <h2 className="font-bold text-texto">Liquidaciones de sueldo de {mes}</h2>
            <ul className="mt-2 divide-y divide-gray-100">
              {liqs!.map((l) => {
                const t = l.trabajadores as unknown as { nombres: string; apellido_paterno: string };
                return (
                  <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{t.nombres} {t.apellido_paterno} · <span className="numeros">{formatoPesos(Number(l.liquido))}</span></span>
                    <a href={`/remuneraciones/liquidaciones/${l.id}/pdf`} className="font-medium text-azul">Descargar</a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-borde bg-white p-4">
          <h2 className="font-bold text-texto">Descargas</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <a href="/exportar?que=compras&formato=pdf" className="rounded-lg border border-borde px-3 py-3 text-center font-medium text-azul">Libro de compras</a>
            <a href="/exportar?que=ventas&formato=pdf" className="rounded-lg border border-borde px-3 py-3 text-center font-medium text-azul">Libro de ventas</a>
          </div>
        </section>

        {(envios ?? []).length > 0 && (
          <section className="rounded-xl border border-borde bg-white p-4">
            <h2 className="font-bold text-texto">Lo que enviaste</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {envios!.map((d) => <li key={d.id} className="flex justify-between gap-2"><span className="truncate">{d.nombre_archivo}</span><span className="shrink-0 text-xs text-texto-suave">{formatoFecha(new Date(d.created_at))} · {ESTADO_ENVIO[d.estado]}</span></li>)}
            </ul>
          </section>
        )}
        <p className="pb-6 text-center text-xs text-texto-suave">Tu contabilidad la lleva tu contador con RH Software. Tus datos están protegidos.</p>
      </main>
    </div>
  );
}
