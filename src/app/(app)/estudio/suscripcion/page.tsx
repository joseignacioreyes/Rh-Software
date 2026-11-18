import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerContexto, esContador } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { estadoCuenta, hoyChile, type Suscripcion } from "@/lib/suscripcion";
import { DATOS_TRANSFERENCIA, WHATSAPP_SOPORTE, linkWhatsApp } from "@/lib/config";
import { formatoPesos, formatoFecha } from "@/lib/formato";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { FormularioPago } from "./FormularioPago";

export const metadata: Metadata = { title: "Plan y pagos" };

const ESTADO_PAGO: Record<string, { texto: string; clase: string }> = {
  informado: { texto: "En revisión", clase: "bg-amber-100 text-ambar" },
  aprobado: { texto: "Aprobado", clase: "bg-emerald-100 text-verde" },
  rechazado: { texto: "Rechazado", clase: "bg-red-100 text-rojo" },
};
const COLOR: Record<string, string> = { prueba: "border-azul bg-celeste", al_dia: "border-verde bg-emerald-50", por_vencer: "border-ambar bg-amber-50", atrasada: "border-ambar bg-amber-50", solo_lectura: "border-rojo bg-red-50", cancelada: "border-rojo bg-red-50" };

export default async function PlanYPagos() {
  const ctx = await obtenerContexto();
  if (!ctx.estudio || !esContador(ctx)) redirect("/mi-mes");
  const supabase = await clienteServidor();
  const [{ data: sus }, { data: planes }, { data: pagos }, { count }] = await Promise.all([
    supabase.from("suscripciones").select("plan, estado, pagado_hasta, dias_gracia").eq("estudio_id", ctx.estudio.id).maybeSingle(),
    supabase.from("planes").select("codigo, nombre, max_empresas, precio_mensual, descripcion").eq("activo", true).order("orden"),
    supabase.from("pagos_suscripcion").select("*").eq("estudio_id", ctx.estudio.id).order("created_at", { ascending: false }).limit(24),
    supabase.from("empresas").select("id", { count: "exact", head: true }).eq("estudio_id", ctx.estudio.id).eq("activa", true),
  ]);
  const estado = estadoCuenta(sus as Suscripcion | null);
  const plan = (planes ?? []).find((p) => p.codigo === sus?.plan);
  const t = DATOS_TRANSFERENCIA;
  const falta = <span className="font-semibold text-ambar">POR COMPLETAR</span>;

  return (
    <Pagina>
      <Encabezado titulo="Plan y pagos" descripcion={`${ctx.estudio.nombre} · tu suscripción a RH Software`} />
      {ctx.estudio.es_demo ? (
        <p className="rounded-lg border border-borde bg-white p-4 text-sm">El estudio de ejemplo no tiene suscripción. Crea tu cuenta para probar 30 días gratis.</p>
      ) : (
        <div className="grid grid-cols-[1fr_420px] gap-4">
          <div className="space-y-4">
            <section className={`rounded-lg border-2 p-4 ${COLOR[estado?.codigo ?? "al_dia"]}`}>
              <p className="text-sm text-texto-suave">Plan actual</p>
              <p className="text-xl font-bold text-texto">{plan ? `${plan.nombre} · ${formatoPesos(Number(plan.precio_mensual))} al mes` : "Sin plan"}</p>
              <p className="mt-1 text-sm">Empresas activas: <b>{count ?? 0}</b>{plan ? ` de ${plan.max_empresas}` : ""}</p>
              {estado && <p className="mt-2 font-medium">{estado.mensaje}</p>}
              <p className="mt-2 text-xs text-texto-suave">Si hay atraso, la cuenta pasa a solo lectura: nunca borramos tus datos y siempre puedes descargarlos.</p>
            </section>

            <section className="rounded-lg border border-borde bg-white p-4">
              <h2 className="mb-2 font-bold">Planes</h2>
              <div className="grid grid-cols-4 gap-3">
                {(planes ?? []).map((p) => (
                  <div key={p.codigo} className={`rounded-lg border p-3 ${p.codigo === sus?.plan ? "border-azul bg-celeste" : "border-borde"}`}>
                    <p className="font-bold text-azul">{p.nombre}</p>
                    <p className="numeros text-lg font-bold">{formatoPesos(Number(p.precio_mensual))}<span className="text-xs font-normal text-texto-suave"> /mes</span></p>
                    <p className="text-sm">Hasta {p.max_empresas} empresas</p>
                    <p className="mt-1 text-xs text-texto-suave">{p.descripcion}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-texto-suave">Todos los planes incluyen contabilidad, libros, F29, remuneraciones, Previred, LRE, portal del cliente y usuarios ilimitados. Precios con IVA incluido.</p>
            </section>

            <section className="rounded-lg border border-borde bg-white p-4">
              <h2 className="mb-2 font-bold">Historial de pagos</h2>
              {(pagos ?? []).length === 0 ? <p className="text-sm text-texto-suave">Aún no has informado pagos.</p> : (
                <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2">
                  <thead><tr className="border-b text-left text-texto-suave"><th className="py-1">Informado</th><th>Plan</th><th>Meses</th><th className="text-right">Monto</th><th>Estado</th></tr></thead>
                  <tbody>{pagos!.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-1.5">{formatoFecha(new Date(p.created_at))}</td><td>{p.plan}</td><td>{p.meses}</td>
                      <td className="numeros text-right">{formatoPesos(Number(p.monto))}</td>
                      <td><span className={`rounded px-1.5 py-0.5 text-xs ${ESTADO_PAGO[p.estado].clase}`}>{ESTADO_PAGO[p.estado].texto}</span>{p.motivo_rechazo && <span className="ml-1 text-xs text-rojo">{p.motivo_rechazo}</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-borde bg-white p-4 text-sm">
              <h2 className="mb-2 font-bold">Paga por transferencia</h2>
              <dl className="grid grid-cols-[120px_1fr] gap-y-1">
                <dt className="text-texto-suave">Titular</dt><dd>{t.titular || falta}</dd>
                <dt className="text-texto-suave">RUT</dt><dd>{t.rut || falta}</dd>
                <dt className="text-texto-suave">Banco</dt><dd>{t.banco || falta}</dd>
                <dt className="text-texto-suave">Tipo de cuenta</dt><dd>{t.tipoCuenta || falta}</dd>
                <dt className="text-texto-suave">N° de cuenta</dt><dd className="numeros">{t.numeroCuenta || falta}</dd>
                <dt className="text-texto-suave">Correo</dt><dd>{t.correo || falta}</dd>
              </dl>
              <p className="mt-2 text-xs text-texto-suave">Después de transferir, informa el pago aquí con el comprobante.</p>
            </section>
            <section className="rounded-lg border border-borde bg-white p-4">
              <h2 className="mb-2 font-bold">Informar un pago</h2>
              <FormularioPago planes={(planes ?? []).map((p) => ({ ...p, precio_mensual: Number(p.precio_mensual) }))} planActual={sus?.plan ?? "inicial"} hoy={hoyChile()} />
            </section>
            <a href={linkWhatsApp(WHATSAPP_SOPORTE, `Hola, tengo una consulta sobre el plan de ${ctx.estudio.nombre}.`)} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-verde underline">¿Dudas? Escríbenos por WhatsApp</a>
          </aside>
        </div>
      )}
    </Pagina>
  );
}
