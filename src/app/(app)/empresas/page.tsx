import type { Metadata } from "next";
import Link from "next/link";
import { obtenerContexto, esContador } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { nombreRegimen } from "@/lib/empresas";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { TablaDatos } from "@/components/ui/TablaDatos";
import { claseBotonPrimario } from "@/components/ui/estilos";

export const metadata: Metadata = { title: "Empresas" };

export default async function Empresas() {
  const ctx = await obtenerContexto();
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("empresas")
    .select("id, rut, razon_social, nombre_fantasia, regimen, comuna, contacto_nombre, activa")
    .eq("estudio_id", ctx.estudio?.id ?? "")
    .order("razon_social");

  const filas = (data ?? []).map((e) => ({
    razon_social: e.razon_social,
    enlace: `/empresas/${e.id}`,
    rut: e.rut,
    regimen: nombreRegimen(e.regimen),
    comuna: e.comuna,
    contacto: e.contacto_nombre,
    estado: e.activa ? "Activa" : "Inactiva",
  }));

  return (
    <Pagina>
      <Encabezado titulo="Empresas" descripcion={`${filas.length} empresas en ${ctx.estudio?.nombre ?? "el estudio"}`}>
        {esContador(ctx) && (
          <Link href="/empresas/nueva" className={claseBotonPrimario}>Nueva empresa</Link>
        )}
      </Encabezado>
      <TablaDatos
        nombreArchivo="empresas"
        tituloExcel={`Empresas · ${ctx.estudio?.nombre ?? ""}`}
        columnas={[
          { clave: "razon_social", titulo: "Razón social", enlace: "enlace" },
          { clave: "rut", titulo: "RUT", tipo: "rut", ancho: "130px" },
          { clave: "regimen", titulo: "Régimen" },
          { clave: "comuna", titulo: "Comuna" },
          { clave: "contacto", titulo: "Contacto" },
          { clave: "estado", titulo: "Estado", ancho: "90px" },
        ]}
        filas={filas}
        vacio="Aún no hay empresas. Crea la primera con “Nueva empresa”."
      />
    </Pagina>
  );
}
