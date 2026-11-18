import type { Metadata } from "next";
import Link from "next/link";
import { contextoModulo } from "@/lib/contexto-contable";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { TablaDatos } from "@/components/ui/TablaDatos";
import { claseBotonPrimario } from "@/components/ui/estilos";

export const metadata: Metadata = { title: "Trabajadores" };

const CONTRATO: Record<string, string> = { indefinido: "Indefinido", plazo_fijo: "Plazo fijo", obra: "Por obra" };

export default async function Trabajadores() {
  const { empresa, puedeEditar, supabase } = await contextoModulo("remuneraciones");
  const [{ data }, { data: inst }] = await Promise.all([
    supabase.from("trabajadores").select("id, rut, nombres, apellido_paterno, apellido_materno, cargo, tipo_contrato, fecha_ingreso, sueldo_base, afp, salud, activo").eq("empresa_id", empresa.id).order("apellido_paterno"),
    supabase.from("instituciones").select("codigo, nombre"),
  ]);
  const nombreInst = new Map((inst ?? []).map((i) => [i.codigo, i.nombre]));
  return (
    <Pagina>
      <Encabezado titulo="Trabajadores" descripcion={`${empresa.razon_social} · ${(data ?? []).filter((t) => t.activo).length} activos`}>
        {puedeEditar && <Link href="/remuneraciones/trabajadores/nuevo" className={claseBotonPrimario}>Nuevo trabajador</Link>}
      </Encabezado>
      <TablaDatos
        nombreArchivo="trabajadores"
        columnas={[
          { clave: "nombre", titulo: "Nombre", enlace: "enlace" },
          { clave: "rut", titulo: "RUT", tipo: "rut", ancho: "120px" },
          { clave: "cargo", titulo: "Cargo" },
          { clave: "contrato", titulo: "Contrato", ancho: "100px" },
          { clave: "ingreso", titulo: "Ingreso", tipo: "fecha", ancho: "100px" },
          { clave: "sueldo", titulo: "Sueldo base", tipo: "monto", total: true },
          { clave: "afp", titulo: "AFP" },
          { clave: "salud", titulo: "Salud" },
          { clave: "estado", titulo: "Estado", ancho: "80px" },
        ]}
        filas={(data ?? []).map((t) => ({
          nombre: `${t.apellido_paterno} ${t.apellido_materno ?? ""}, ${t.nombres}`.replace(" ,", ","),
          enlace: `/remuneraciones/trabajadores/${t.id}`,
          rut: t.rut, cargo: t.cargo, contrato: CONTRATO[t.tipo_contrato], ingreso: t.fecha_ingreso, sueldo: Number(t.sueldo_base),
          afp: t.afp ? nombreInst.get(t.afp) ?? t.afp : "—", salud: nombreInst.get(t.salud) ?? t.salud, estado: t.activo ? "Activo" : "Inactivo",
        }))}
        vacio="Esta empresa aún no tiene trabajadores."
      />
    </Pagina>
  );
}
