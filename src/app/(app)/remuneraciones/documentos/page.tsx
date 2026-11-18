import type { Metadata } from "next";
import { contextoModulo } from "@/lib/contexto-contable";
import { CAUSALES } from "@/lib/finiquito";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { GeneradorDocumentos } from "./GeneradorDocumentos";

export const metadata: Metadata = { title: "Contratos y certificados" };

export default async function Documentos() {
  const { ctx, empresa, supabase } = await contextoModulo("remuneraciones");
  const { data: trabajadores } = await supabase.from("trabajadores").select("id, nombres, apellido_paterno").eq("empresa_id", empresa.id).order("apellido_paterno");
  return (
    <Pagina>
      <Encabezado
        titulo="Contratos, cartas y certificados"
        descripcion={`${empresa.razon_social} · Documentos completados con los datos de la ficha. Salen como BORRADOR: el contador los revisa antes de usarlos.`}
      />
      <GeneradorDocumentos
        trabajadores={(trabajadores ?? []).map((t) => ({ id: t.id, nombre: `${t.nombres} ${t.apellido_paterno}` }))}
        causales={CAUSALES.map((c) => ({ codigo: c.codigo, texto: c.texto }))}
        anio={ctx.periodo.anio}
      />
    </Pagina>
  );
}
