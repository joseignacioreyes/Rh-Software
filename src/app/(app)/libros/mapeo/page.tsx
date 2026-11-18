import type { Metadata } from "next";
import { contextoModulo } from "@/lib/contexto-contable";
import { iaDisponible } from "@/lib/ia";
import { CAMPOS } from "@/lib/importar/mapeo";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { AsistenteMapeo } from "./AsistenteMapeo";

export const metadata: Metadata = { title: "Asistente de mapeo" };

export default async function Mapeo() {
  const { ctx, empresa } = await contextoModulo("libros");
  return (
    <Pagina>
      <Encabezado
        titulo="Asistente de mapeo de columnas"
        descripcion={`Para libros de otros softwares o planillas propias. Importa a ${empresa.razon_social}. Primero ves una vista previa y nada se guarda sin tu confirmación.`}
      />
      <AsistenteMapeo
        campos={{ libro_compras: CAMPOS.libro_compras, libro_ventas: CAMPOS.libro_ventas }}
        anio={ctx.periodo.anio}
        mes={ctx.periodo.mes}
        ia={iaDisponible()}
      />
    </Pagina>
  );
}
