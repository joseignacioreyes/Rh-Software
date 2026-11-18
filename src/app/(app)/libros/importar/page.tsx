import type { Metadata } from "next";
import Link from "next/link";
import { obtenerContexto } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { TablaDatos } from "@/components/ui/TablaDatos";
import { ZonaImportacion } from "./ZonaImportacion";

export const metadata: Metadata = { title: "Importar libros" };

const TIPOS: Record<string, string> = {
  rcv_compras: "RCV compras", rcv_ventas: "RCV ventas", honorarios_recibidas: "Honorarios recibidos",
  honorarios_emitidas: "Honorarios emitidos", cartola: "Cartola", excel_libro: "Excel",
};

export default async function Importar() {
  const ctx = await obtenerContexto();
  const supabase = await clienteServidor();
  const { data: historial } = await supabase
    .from("importaciones")
    .select("id, created_at, tipo, nombre_archivo, empresa_id, anio, mes, filas_nuevas, filas_duplicadas, filas_con_error")
    .eq("estudio_id", ctx.estudio?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(200);
  const empresas = new Map(ctx.empresas.map((e) => [e.id, e.razon_social]));
  const fecha = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <Pagina>
      <Encabezado
        titulo="Importar libros"
        descripcion={
          <>
            Arrastra los archivos que descargaste de sii.cl (Registro de Compras y Ventas, boletas de honorarios) de una o varias
            empresas. Detectamos la empresa y el periodo de cada uno. ¿Viene de otro software o de un Excel propio? Usa el{" "}
            <Link href="/libros/mapeo" className="text-azul underline">asistente de mapeo</Link>.
          </>
        }
      />
      <ZonaImportacion empresaActual={ctx.empresa?.razon_social ?? null} />
      <h2 className="mt-8 mb-2 text-base font-bold text-azul">Historial de importaciones</h2>
      <TablaDatos
        nombreArchivo="historial-importaciones"
        alturaMaxima="420px"
        columnas={[
          { clave: "fecha", titulo: "Fecha", ancho: "140px" },
          { clave: "empresa", titulo: "Empresa" },
          { clave: "tipo", titulo: "Tipo", ancho: "150px" },
          { clave: "periodo", titulo: "Periodo", ancho: "90px" },
          { clave: "archivo", titulo: "Archivo" },
          { clave: "nuevas", titulo: "Nuevas", tipo: "numero", ancho: "80px" },
          { clave: "duplicadas", titulo: "Ya estaban", tipo: "numero", ancho: "90px" },
          { clave: "errores", titulo: "Con error", tipo: "numero", ancho: "90px" },
        ]}
        filas={(historial ?? []).map((h) => ({
          fecha: fecha.format(new Date(h.created_at)).replace(/\//g, "-").replace(",", ""),
          empresa: empresas.get(h.empresa_id) ?? "",
          tipo: TIPOS[h.tipo] ?? h.tipo,
          periodo: h.mes ? `${String(h.mes).padStart(2, "0")}-${h.anio}` : "",
          archivo: h.nombre_archivo,
          nuevas: h.filas_nuevas,
          duplicadas: h.filas_duplicadas,
          errores: h.filas_con_error,
        }))}
        vacio="Aún no has importado archivos."
      />
    </Pagina>
  );
}
