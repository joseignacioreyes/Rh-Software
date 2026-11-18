import type { Metadata } from "next";
import Link from "next/link";
import { contextoModulo } from "@/lib/contexto-contable";
import { iaDisponible } from "@/lib/ia";
import { formatoFecha } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";
import { Encabezado, Pagina, Vacio } from "@/components/ui/Encabezado";
import { FormularioRegistro, BotonesDocumento, NuevaSolicitud, BotonCerrarSolicitud, SubirEnBandeja } from "./Componentes";

export const metadata: Metadata = { title: "Bandeja de documentos" };

const ORIGEN: Record<string, string> = { portal: "Portal del cliente", whatsapp: "WhatsApp", correo: "Correo", contador: "Estudio" };
const ESTADO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Por revisar", clase: "bg-amber-100 text-ambar" },
  registrado: { texto: "Registrado", clase: "bg-emerald-100 text-verde" },
  descartado: { texto: "Descartado", clase: "bg-gray-100 text-texto-suave" },
};

/** Bandeja de documentos: todo lo que manda el cliente llega aquí; nada se contabiliza sin confirmación. */
export default async function Bandeja({ searchParams }: PageProps<"/documentos">) {
  const { id: elegido, ver } = await searchParams;
  const { empresa, puedeEditar, supabase } = await contextoModulo("documentos");
  const filtro = ver === "todos" ? null : "pendiente";
  let consulta = supabase.from("documentos_bandeja").select("*").eq("empresa_id", empresa.id).order("created_at", { ascending: false }).limit(100);
  if (filtro) consulta = consulta.eq("estado", filtro);
  const [{ data: docs }, { data: solicitudes }, { data: emp }] = await Promise.all([
    consulta,
    supabase.from("solicitudes_cliente").select("*").eq("empresa_id", empresa.id).neq("estado", "cerrada").order("created_at", { ascending: false }),
    supabase.from("empresas").select("contacto_whatsapp").eq("id", empresa.id).single(),
  ]);
  const lista = docs ?? [];
  const doc = lista.find((d) => d.id === elegido) ?? (elegido ? (await supabase.from("documentos_bandeja").select("*").eq("id", elegido).maybeSingle()).data : lista[0]);
  const [vista, duplicado] = doc
    ? await Promise.all([
        supabase.storage.from("archivos").createSignedUrl(doc.ruta_storage, 600),
        doc.duplicado_de ? supabase.from("documentos_rcv").select("libro, anio, mes, folio").eq("id", doc.duplicado_de).maybeSingle() : Promise.resolve({ data: null }),
      ])
    : [null, { data: null }];
  const url = vista?.data?.signedUrl;
  const telefono = emp?.contacto_whatsapp;
  const enlaceWa = (texto: string) => telefono ? `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}` : null;

  return (
    <Pagina>
      <Encabezado titulo="Bandeja de documentos" descripcion={`${empresa.razon_social} · Lo que envía el cliente, listo para revisar y registrar`}>
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
          <Link href="/documentos" className={`px-3 py-2 ${filtro ? "bg-azul text-white" : "bg-white"}`}>Por revisar</Link>
          <Link href="/documentos?ver=todos" className={`px-3 py-2 ${!filtro ? "bg-azul text-white" : "bg-white"}`}>Todos</Link>
        </div>
        {puedeEditar && <SubirEnBandeja />}
      </Encabezado>

      {!iaDisponible() && (
        <p className="mb-3 rounded-md border border-ambar/30 bg-amber-50 px-3 py-2 text-sm text-texto">
          La lectura automática con IA se activa al configurar la clave de la API de Claude. Mientras tanto, los datos se ingresan a mano mirando el documento.
        </p>
      )}

      <div className="grid grid-cols-[320px_1fr] gap-4">
        <aside className="space-y-2">
          {lista.length === 0 && <Vacio titulo={filtro ? "No hay documentos por revisar" : "La bandeja está vacía"}>Lo que el cliente suba en su portal aparecerá aquí.</Vacio>}
          {lista.map((d) => (
            <Link
              key={d.id}
              href={`/documentos?id=${d.id}${filtro ? "" : "&ver=todos"}`}
              className={`block rounded-lg border px-3 py-2 text-sm ${doc?.id === d.id ? "border-azul bg-celeste" : "border-borde bg-white hover:bg-fondo-suave"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{d.nombre_archivo}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${ESTADO[d.estado].clase}`}>{ESTADO[d.estado].texto}</span>
              </div>
              <p className="text-xs text-texto-suave">{ORIGEN[d.origen]} · {formatoFecha(new Date(d.created_at))}{d.duplicado_de ? " · posible duplicado" : ""}</p>
              {d.comentario && <p className="mt-0.5 truncate text-xs italic text-texto-suave">“{d.comentario}”</p>}
            </Link>
          ))}
        </aside>

        {doc ? (
          <section className="grid grid-cols-2 gap-4 rounded-lg border border-borde bg-white p-4">
            <div className="min-h-[520px] overflow-hidden rounded-md border border-borde bg-fondo-suave">
              {url && doc.tipo_mime?.startsWith("image/") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={doc.nombre_archivo} className="h-full max-h-[640px] w-full object-contain" />
              )}
              {url && doc.tipo_mime === "application/pdf" && <iframe src={url} title={doc.nombre_archivo} className="h-[640px] w-full" />}
              {url && !doc.tipo_mime?.startsWith("image/") && doc.tipo_mime !== "application/pdf" && (
                <div className="p-6 text-sm">Vista previa no disponible. <a href={url} className="text-azul underline">Descargar {doc.nombre_archivo}</a></div>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-texto">{doc.nombre_archivo}</h2>
              <p className="text-sm text-texto-suave">
                {ORIGEN[doc.origen]} · {formatoFecha(new Date(doc.created_at))}
                {doc.leido_con === "ia" && " · leído con IA"}
                {doc.leido_con === "ejemplo" && " · datos de ejemplo"}
              </p>
              {doc.comentario && <p className="mt-2 rounded-md bg-fondo-suave px-3 py-2 text-sm">Comentario del cliente: “{doc.comentario}”</p>}
              {duplicado.data && (
                <p className="mt-2 rounded-md border border-rojo/30 bg-red-50 px-3 py-2 text-sm text-rojo">
                  Posible duplicado: el folio {duplicado.data.folio} ya está en el libro de {duplicado.data.libro} de {String(duplicado.data.mes).padStart(2, "0")}-{duplicado.data.anio}.
                </p>
              )}
              {doc.estado === "pendiente" && puedeEditar ? (
                <>
                  <BotonesDocumento id={doc.id} ia={iaDisponible()} />
                  <FormularioRegistro key={`${doc.id}-${doc.updated_at}`} id={doc.id} datos={doc.datos} leidoCon={doc.leido_con} />
                </>
              ) : (
                <div className="mt-4 text-sm">
                  <p className={`inline-block rounded px-2 py-1 font-medium ${ESTADO[doc.estado].clase}`}>{ESTADO[doc.estado].texto}</p>
                  {doc.estado === "registrado" && doc.datos && (
                    <p className="mt-2">Folio {doc.datos.folio} · {doc.datos.rut ? formatearRut(doc.datos.rut) : ""} · registrado en el libro de {doc.datos.libro}.</p>
                  )}
                  {doc.estado === "descartado" && puedeEditar && <BotonesDocumento id={doc.id} ia={false} reabrir />}
                </div>
              )}
            </div>
          </section>
        ) : (
          <div />
        )}
      </div>

      <section className="mt-6 rounded-lg border border-borde bg-white p-4">
        <h2 className="text-lg font-bold text-texto">Solicitudes al cliente</h2>
        <p className="text-sm text-texto-suave">Aparecen en el portal del cliente. También puedes avisarle por WhatsApp desde tu propio teléfono.</p>
        <div className="mt-3 grid grid-cols-[1fr_380px] gap-6">
          <ul className="divide-y divide-gray-100">
            {(solicitudes ?? []).length === 0 && <li className="py-2 text-sm text-texto-suave">No hay solicitudes abiertas.</li>}
            {(solicitudes ?? []).map((s) => {
              const wa = enlaceWa(`Hola, te escribo de tu estudio contable: ${s.titulo}. Puedes enviarlo desde tu portal de RH Software.`);
              return (
                <li key={s.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{s.titulo} <span className={`ml-1 rounded px-1.5 py-0.5 text-xs ${s.estado === "respondida" ? "bg-emerald-100 text-verde" : "bg-amber-100 text-ambar"}`}>{s.estado === "respondida" ? "Respondida" : "Pendiente"}</span></p>
                    {s.detalle && <p className="text-texto-suave">{s.detalle}</p>}
                    {s.respuesta && <p className="mt-1 rounded bg-fondo-suave px-2 py-1">Respuesta: “{s.respuesta}”</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-md border border-verde px-2 py-1 text-xs font-medium text-verde hover:bg-emerald-50">Escribir por WhatsApp</a>}
                    {puedeEditar && <BotonCerrarSolicitud id={s.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
          {puedeEditar && <NuevaSolicitud />}
        </div>
        {!telefono && <p className="mt-2 text-xs text-texto-suave">Para usar los botones de WhatsApp, agrega el WhatsApp del cliente en la ficha de la empresa.</p>}
      </section>
    </Pagina>
  );
}
