import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerContexto } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { estadoCuenta, type Suscripcion } from "@/lib/suscripcion";
import { formatoPesos, formatoFecha } from "@/lib/formato";
import { Logo } from "@/components/marca/Logo";
import { cerrarSesion } from "@/app/ingresar/acciones";
import { RevisarPago, ExtenderPrueba } from "./Acciones";

export const metadata: Metadata = { title: "Administración" };

const SEMAFORO: Record<string, string> = { prueba: "bg-celeste text-azul", al_dia: "bg-emerald-100 text-verde", por_vencer: "bg-amber-100 text-ambar", atrasada: "bg-amber-100 text-ambar", solo_lectura: "bg-red-100 text-rojo", cancelada: "bg-gray-100 text-texto-suave" };
const NOMBRE: Record<string, string> = { prueba: "Prueba", al_dia: "Al día", por_vencer: "Por vencer", atrasada: "Atrasada", solo_lectura: "Solo lectura", cancelada: "Cancelada" };

type Fila = { estudio_id: string; nombre: string; rut: string | null; es_demo: boolean; creado: string; plan: string | null; estado: string | null; pagado_hasta: string | null; dias_gracia: number | null; empresas_activas: number; usuarios: number; pagos_pendientes: number; contacto: string | null };

/** Administración de RH Software (solo José): estudios, planes y pagos. Nunca muestra la contabilidad de los estudios. */
export default async function Admin() {
  const ctx = await obtenerContexto();
  if (!ctx.usuario.es_superadmin) redirect("/mi-mes");
  const supabase = await clienteServidor();
  const [{ data: estudios }, { data: pagos }, { data: planes }] = await Promise.all([
    supabase.rpc("resumen_estudios"),
    supabase.from("pagos_suscripcion").select("*, estudios(nombre)").eq("estado", "informado").order("created_at"),
    supabase.from("planes").select("*").order("orden"),
  ]);
  const filas = (estudios ?? []) as Fila[];
  const urls = await Promise.all((pagos ?? []).map((p) => p.ruta_comprobante ? supabase.storage.from("suscripciones").createSignedUrl(p.ruta_comprobante, 600) : Promise.resolve({ data: null })));
  const estados = filas.filter((f) => !f.es_demo).map((f) => ({ f, e: f.plan ? estadoCuenta({ plan: f.plan, estado: f.estado as Suscripcion["estado"], pagado_hasta: f.pagado_hasta!, dias_gracia: f.dias_gracia! }) : null }));
  const precio = new Map((planes ?? []).map((p) => [p.codigo, Number(p.precio_mensual)]));
  const mrr = estados.filter(({ e }) => e && ["al_dia", "por_vencer", "atrasada"].includes(e.codigo)).reduce((s, { f }) => s + (precio.get(f.plan!) ?? 0), 0);

  return (
    <div className="min-h-screen bg-fondo-suave">
      <header className="flex items-center justify-between border-b border-borde bg-white px-6 py-3">
        <div className="flex items-center gap-4"><Logo /><span className="rounded bg-azul px-2 py-0.5 text-xs font-semibold text-white">Administración</span></div>
        <div className="flex items-center gap-4 text-sm">
          {ctx.estudio && <Link href="/mi-mes" className="text-azul">Ir a mi estudio</Link>}
          <form action={cerrarSesion}><button type="submit" className="text-texto-suave hover:text-rojo">Salir</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-[1300px] space-y-5 px-6 py-5">
        <div className="grid grid-cols-4 gap-3">
          {[
            ["Estudios", String(estados.length)],
            ["En prueba", String(estados.filter(({ e }) => e?.codigo === "prueba").length)],
            ["Pagando", String(estados.filter(({ e }) => e && ["al_dia", "por_vencer", "atrasada"].includes(e.codigo)).length)],
            ["Ingreso mensual (IVA incl.)", formatoPesos(mrr)],
          ].map(([t, v]) => <div key={t} className="rounded-lg border border-borde bg-white px-4 py-3"><p className="text-xs text-texto-suave">{t}</p><p className="numeros text-xl font-bold">{v}</p></div>)}
        </div>

        <section className="rounded-lg border border-borde bg-white p-4">
          <h2 className="mb-2 text-lg font-bold text-azul">Pagos por revisar</h2>
          {(pagos ?? []).length === 0 ? <p className="text-sm text-texto-suave">No hay pagos pendientes.</p> : (
            <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2">
              <thead><tr className="border-b text-left text-texto-suave"><th className="py-1">Estudio</th><th>Plan</th><th>Meses</th><th className="text-right">Monto</th><th>Transferencia</th><th>Comprobante</th><th /></tr></thead>
              <tbody>{pagos!.map((p, i) => (
                <tr key={p.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 font-medium">{(p.estudios as unknown as { nombre: string })?.nombre}</td><td>{p.plan}</td><td>{p.meses}</td>
                  <td className="numeros text-right">{formatoPesos(Number(p.monto))}</td>
                  <td>{p.fecha_transferencia.split("-").reverse().join("-")}{p.banco_origen ? ` · ${p.banco_origen}` : ""}{p.numero_operacion ? ` · op. ${p.numero_operacion}` : ""}</td>
                  <td>{urls[i]?.data?.signedUrl ? <a href={urls[i].data!.signedUrl} target="_blank" rel="noopener noreferrer" className="text-azul underline">Ver</a> : "—"}</td>
                  <td><RevisarPago id={p.id} /></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-texto-suave">Revisa que el monto haya llegado a la cuenta antes de aprobar.</p>
        </section>

        <section className="rounded-lg border border-borde bg-white p-4">
          <h2 className="mb-2 text-lg font-bold text-azul">Estudios</h2>
          <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2">
            <thead><tr className="border-b text-left text-texto-suave"><th className="py-1">Estudio</th><th>Contacto</th><th>Plan</th><th className="text-right">Empresas</th><th className="text-right">Usuarios</th><th>Estado</th><th>Pagado hasta</th><th>Desde</th></tr></thead>
            <tbody>{filas.map((f) => {
              const e = estados.find((x) => x.f.estudio_id === f.estudio_id)?.e;
              return (
                <tr key={f.estudio_id} className="border-b border-gray-100">
                  <td className="py-1.5 font-medium">{f.nombre}{f.es_demo && <span className="ml-1 text-xs text-texto-suave">(demo)</span>}</td>
                  <td className="text-texto-suave">{f.contacto}</td>
                  <td>{f.plan ?? "—"}</td>
                  <td className="numeros text-right">{f.empresas_activas}</td>
                  <td className="numeros text-right">{f.usuarios}</td>
                  <td>{e ? <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEMAFORO[e.codigo]}`}>{NOMBRE[e.codigo]}</span> : "—"}{f.pagos_pendientes > 0 && <span className="ml-1 text-xs text-ambar">pago por revisar</span>}</td>
                  <td>{f.pagado_hasta ? <>{f.pagado_hasta.split("-").reverse().join("-")} {e && <ExtenderPrueba estudioId={f.estudio_id} hasta={f.pagado_hasta} />}</> : "—"}</td>
                  <td>{formatoFecha(new Date(f.creado))}</td>
                </tr>
              );
            })}</tbody>
          </table>
          <p className="mt-2 text-xs text-texto-suave">Aquí solo ves datos de la cuenta. La contabilidad de los estudios no es visible para el superadministrador (salvo autorización registrada para soporte).</p>
        </section>

        <section className="rounded-lg border border-borde bg-white p-4">
          <h2 className="mb-2 text-lg font-bold text-azul">Planes (propuesta de precios)</h2>
          <div className="grid grid-cols-4 gap-3">
            {(planes ?? []).map((p) => <div key={p.codigo} className="rounded-md border border-borde p-3 text-sm"><p className="font-bold">{p.nombre}</p><p className="numeros">{formatoPesos(Number(p.precio_mensual))}/mes · hasta {p.max_empresas} empresas</p></div>)}
          </div>
          <p className="mt-2 text-xs text-texto-suave">Los precios son una propuesta: cámbialos en la tabla <code>planes</code> antes de publicar.</p>
        </section>
      </main>
    </div>
  );
}
