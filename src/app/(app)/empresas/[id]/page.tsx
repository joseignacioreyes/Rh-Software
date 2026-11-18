import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { obtenerContexto, esContador } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatearRut } from "@/lib/rut";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";
import { claseExito } from "@/components/ui/estilos";
import { FormularioEmpresa } from "../FormularioEmpresa";
import { BotonEstadoEmpresa } from "./BotonEstadoEmpresa";
import { BotonWhatsApp } from "@/components/marca/BotonWhatsApp";

export const metadata: Metadata = { title: "Ficha de empresa" };

export default async function FichaEmpresa({ params, searchParams }: PageProps<"/empresas/[id]">) {
  const { id } = await params;
  const { creada } = await searchParams;
  const ctx = await obtenerContexto();
  const supabase = await clienteServidor();
  const { data: empresa } = await supabase.from("empresas").select("*").eq("id", id).maybeSingle();
  if (!empresa) notFound();
  const contador = esContador(ctx);

  return (
    <Pagina>
      <div className="max-w-4xl">
        <Encabezado
          titulo={empresa.razon_social}
          descripcion={
            <span className="flex items-center gap-2">
              <span className="numeros">{formatearRut(empresa.rut)}</span>
              {empresa.activa ? <Etiqueta tono="verde">Activa</Etiqueta> : <Etiqueta tono="gris">Inactiva</Etiqueta>}
            </span>
          }
        >
          {empresa.contacto_whatsapp && (
            <BotonWhatsApp
              numero={empresa.contacto_whatsapp}
              texto="Escribir al cliente"
              mensaje={`Hola ${empresa.contacto_nombre ?? ""}, te escribo de ${ctx.estudio?.nombre ?? "tu estudio contable"}.`}
            />
          )}
          {contador && <BotonEstadoEmpresa id={empresa.id} activa={empresa.activa} />}
        </Encabezado>
        {creada && <p className={`${claseExito} mb-4`}>Empresa creada con el plan de cuentas base.</p>}
        <FormularioEmpresa empresa={empresa} soloLectura={!contador} />
      </div>
    </Pagina>
  );
}
