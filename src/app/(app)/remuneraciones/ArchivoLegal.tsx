import Link from "next/link";
import { contextoModulo } from "@/lib/contexto-contable";
import { nombrePeriodo } from "@/lib/sesion";
import { construirArchivo, datosArchivosMes } from "@/lib/servicios/archivos-legales";
import { formatoFecha } from "@/lib/formato";
import { Encabezado, Etiqueta, Pagina, Vacio } from "@/components/ui/Encabezado";
import { claseBotonPrimario } from "@/components/ui/estilos";

const INFO = {
  previred: {
    titulo: "Archivo Previred",
    descripcion: "Nómina en el formato estándar de 105 campos (largo variable, separado por punto y coma). Descárgalo y súbelo en previred.com, donde se declara y paga.",
  },
  lre: {
    titulo: "Libro de Remuneraciones Electrónico",
    descripcion: "Archivo para la carga masiva en Mi DT (CSV separado por punto y coma, nombre rutempleador_aaaamm, con la codificación de conceptos de la Dirección del Trabajo).",
  },
};

/** Pantalla común de Previred y LRE: validación campo por campo, vista previa y descarga. */
export async function ArchivoLegal({ tipo }: { tipo: "previred" | "lre" }) {
  const { ctx, empresa, puedeEditar, supabase } = await contextoModulo("remuneraciones");
  const [r, { data: historial }] = await Promise.all([
    datosArchivosMes(supabase, empresa.id, ctx.periodo),
    supabase.from("archivos_generados").select("nombre_archivo, hash_contenido, created_at").eq("empresa_id", empresa.id).eq("tipo", tipo).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes).order("created_at", { ascending: false }),
  ]);
  const info = INFO[tipo];

  return (
    <Pagina>
      <Encabezado titulo={`${info.titulo} · ${nombrePeriodo(ctx.periodo)}`} descripcion={`${empresa.razon_social} · ${info.descripcion}`} />
      {"error" in r ? (
        <Vacio titulo={r.error}><Link href="/remuneraciones/liquidaciones" className="text-azul underline">Ir a liquidaciones</Link></Vacio>
      ) : (
        (() => {
          const a = construirArchivo(tipo, r.datos);
          const lineas = a.contenido.trim().split("\r\n");
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {a.validacion.errores.length === 0 ? <Etiqueta tono="verde">Validación correcta: {a.filas} {tipo === "previred" ? "líneas" : "trabajadores"}</Etiqueta> : <Etiqueta tono="rojo">{a.validacion.errores.length} errores: corrígelos para descargar</Etiqueta>}
                {r.sinAprobar > 0 && <Etiqueta tono="ambar">{r.sinAprobar} liquidaciones sin aprobar</Etiqueta>}
                {puedeEditar && a.validacion.errores.length === 0 && (
                  <a href={`/remuneraciones/archivo/${tipo}`} className={claseBotonPrimario}>Descargar {a.nombre}</a>
                )}
              </div>
              {a.validacion.errores.length > 0 && (
                <ul className="list-disc space-y-0.5 rounded-lg border border-rojo/30 bg-red-50 py-2 pr-3 pl-8 text-sm text-rojo">{a.validacion.errores.map((e) => <li key={e}>{e}</li>)}</ul>
              )}
              {a.validacion.avisos.length > 0 && (
                <ul className="list-disc space-y-0.5 rounded-lg border border-ambar/30 bg-amber-50 py-2 pr-3 pl-8 text-sm text-texto">{a.validacion.avisos.map((e) => <li key={e}>{e}</li>)}</ul>
              )}
              <div className="rounded-lg border border-borde bg-white">
                <p className="border-b border-borde px-3 py-2 text-xs font-semibold text-texto-suave">Vista previa del archivo ({lineas.length} líneas)</p>
                <pre className="max-h-80 overflow-auto px-3 py-2 font-mono text-[11px] leading-5 whitespace-pre text-texto">{lineas.slice(0, 20).join("\n")}</pre>
              </div>
              <div className="rounded-lg border border-borde bg-white p-4 text-sm">
                <h2 className="mb-2 font-bold text-azul">Archivos generados este mes</h2>
                {(historial ?? []).length === 0 ? <p className="text-texto-suave">Aún no se ha descargado el archivo de este mes.</p> : (
                  <ul className="space-y-1 text-xs">
                    {historial!.map((h) => <li key={h.hash_contenido + h.created_at}><span className="numeros">{formatoFecha(new Date(h.created_at))}</span> · {h.nombre_archivo} · huella <span className="font-mono">{h.hash_contenido.slice(0, 12)}</span></li>)}
                  </ul>
                )}
                <p className="mt-2 text-xs text-texto-suave">Cada archivo queda guardado con su huella (hash) y la versión de los datos y parámetros usados, para poder explicarlo en una fiscalización.</p>
              </div>
            </div>
          );
        })()
      )}
    </Pagina>
  );
}
