import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerContexto, esContador } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { TablaDatos } from "@/components/ui/TablaDatos";

export const metadata: Metadata = { title: "Auditoría" };

const ACCIONES: Record<string, string> = {
  insert: "Creó",
  update: "Modificó",
  delete: "Eliminó",
  inicio_sesion: "Inició sesión",
  cierre_sesion: "Cerró sesión",
  segundo_factor_ok: "Verificó segundo factor",
  segundo_factor_configurado: "Configuró segundo factor",
  clave_cambiada: "Cambió su clave",
  exportacion: "Exportó",
};

const TABLAS: Record<string, string> = {
  estudios: "estudio",
  empresas: "empresa",
  membresias: "acceso de usuario",
  periodos: "periodo",
  plan_cuentas: "cuenta contable",
  centros_costo: "centro de costo",
  comprobantes: "comprobante",
  periodo_eventos: "cierre o reapertura",
  accesos_soporte: "acceso de soporte",
};

/** Resumen corto de qué cambió. */
function resumen(detalle: Record<string, unknown> | null, accion: string): string {
  if (!detalle) return "";
  if (accion === "update") {
    return Object.keys(detalle)
      .filter((k) => !["updated_by"].includes(k))
      .map((k) => {
        const d = detalle[k] as { antes: unknown; despues: unknown };
        return `${k}: ${JSON.stringify(d?.antes)} → ${JSON.stringify(d?.despues)}`;
      })
      .join("; ")
      .slice(0, 220);
  }
  const d = detalle as Record<string, unknown>;
  return String(d.glosa ?? d.razon_social ?? d.nombre ?? d.motivo ?? d.codigo ?? "").slice(0, 160);
}

export default async function Auditoria() {
  const ctx = await obtenerContexto();
  if (!esContador(ctx) || !ctx.estudio) redirect("/mi-mes");
  const supabase = await clienteServidor();

  const [{ data: eventos }, { data: membresias }] = await Promise.all([
    supabase
      .from("auditoria")
      .select("id, created_at, usuario_id, accion, tabla, empresa_id, detalle, ip")
      .eq("estudio_id", ctx.estudio.id)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("membresias").select("usuarios(id, nombre)").eq("estudio_id", ctx.estudio.id),
  ]);
  const nombres = new Map<string, string>();
  for (const m of (membresias ?? []) as unknown as { usuarios: { id: string; nombre: string } }[]) {
    nombres.set(m.usuarios.id, m.usuarios.nombre);
  }
  const empresas = new Map(ctx.empresas.map((e) => [e.id, e.razon_social]));
  const fechaHora = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const filas = (eventos ?? []).map((e) => ({
    fecha: fechaHora.format(new Date(e.created_at)).replace(/\//g, "-").replace(",", ""),
    usuario: e.usuario_id ? nombres.get(e.usuario_id) ?? "Usuario externo al estudio" : "Sistema",
    accion: `${ACCIONES[e.accion] ?? e.accion}${e.tabla ? ` ${TABLAS[e.tabla] ?? e.tabla}` : ""}`,
    empresa: e.empresa_id ? empresas.get(e.empresa_id) ?? "" : "",
    detalle: resumen(e.detalle as Record<string, unknown> | null, e.accion),
    ip: e.ip ?? "",
  }));

  return (
    <Pagina>
      <Encabezado titulo="Auditoría" descripcion="Quién hizo qué, cuándo y desde dónde. No se puede modificar ni borrar. Últimos 1.000 eventos." />
      <TablaDatos
        nombreArchivo="auditoria"
        tituloExcel={`Auditoría · ${ctx.estudio.nombre}`}
        columnas={[
          { clave: "fecha", titulo: "Fecha y hora", ancho: "140px" },
          { clave: "usuario", titulo: "Usuario", ancho: "150px" },
          { clave: "accion", titulo: "Acción", ancho: "200px" },
          { clave: "empresa", titulo: "Empresa", ancho: "200px" },
          { clave: "detalle", titulo: "Detalle" },
          { clave: "ip", titulo: "IP", ancho: "110px" },
        ]}
        filas={filas}
        vacio="Aún no hay eventos registrados."
      />
    </Pagina>
  );
}
