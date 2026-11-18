import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoModulo } from "@/lib/contexto-contable";
import { formatearRut } from "@/lib/rut";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";
import { claseExito } from "@/components/ui/estilos";
import { FichaTrabajador, type Trabajador } from "../FichaTrabajador";

export const metadata: Metadata = { title: "Ficha del trabajador" };

export default async function Ficha({ params, searchParams }: PageProps<"/remuneraciones/trabajadores/[id]">) {
  const { id } = await params;
  const { creado } = await searchParams;
  const { empresa, puedeEditar, supabase } = await contextoModulo("remuneraciones");
  const [{ data: t }, { data: inst }] = await Promise.all([
    supabase.from("trabajadores").select("*").eq("id", id).eq("empresa_id", empresa.id).maybeSingle(),
    supabase.from("instituciones").select("codigo, nombre, tipo").eq("activa", true).order("nombre"),
  ]);
  if (!t) notFound();
  // Registro de acceso a datos sensibles.
  await supabase.rpc("registrar_evento", { p_accion: "ver_ficha_trabajador", p_estudio: t.estudio_id, p_empresa: empresa.id, p_detalle: { trabajador: t.id } });
  return (
    <Pagina>
      <div className="max-w-5xl">
        <Encabezado
          titulo={`${t.nombres} ${t.apellido_paterno} ${t.apellido_materno ?? ""}`}
          descripcion={<span className="flex items-center gap-2"><span className="numeros">{formatearRut(t.rut)}</span>{t.activo ? <Etiqueta tono="verde">Activo</Etiqueta> : <Etiqueta tono="gris">Inactivo</Etiqueta>}</span>}
        />
        {creado && <p className={`${claseExito} mb-3`}>Trabajador creado.</p>}
        <FichaTrabajador t={t as Trabajador} instituciones={inst ?? []} soloLectura={!puedeEditar} />
      </div>
    </Pagina>
  );
}
