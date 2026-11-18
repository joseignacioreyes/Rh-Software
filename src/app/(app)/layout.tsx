import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerContexto, esContador, permiso, soloCliente } from "@/lib/sesion";
import { BarraLateral, type GrupoMenu } from "@/components/app/BarraLateral";
import { SelectorEmpresa } from "@/components/app/SelectorEmpresa";
import { SelectorPeriodo } from "@/components/app/SelectorPeriodo";
import { MenuUsuario } from "@/components/app/MenuUsuario";
import { AtajosGlobales } from "@/components/app/AtajosGlobales";

const NOMBRE_ROL: Record<string, string> = {
  contador: "Contador",
  lector: "Solo lectura",
  asistente: "Asistente",
  cliente: "Cliente",
};

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const ctx = await obtenerContexto();
  // Los clientes de las empresas usan el portal (más simple y apto para celular).
  if (soloCliente(ctx)) redirect("/portal");
  const contador = esContador(ctx);
  const verContabilidad = ctx.empresa ? permiso(ctx, ctx.empresa.id, "contabilidad").ver : false;
  const verLibros = ctx.empresa ? permiso(ctx, ctx.empresa.id, "libros").ver : false;
  const verImpuestos = ctx.empresa ? permiso(ctx, ctx.empresa.id, "impuestos").ver : false;
  const verRemuneraciones = ctx.empresa ? permiso(ctx, ctx.empresa.id, "remuneraciones").ver : false;
  const verDocumentos = ctx.empresa ? permiso(ctx, ctx.empresa.id, "documentos").ver : false;

  const grupos: GrupoMenu[] = [{ items: [
    { href: "/mi-mes", texto: "Mi mes" },
    { href: "/impuestos/calendario", texto: "Calendario" },
    ...(verDocumentos ? [{ href: "/documentos", texto: "Bandeja de documentos" }] : []),
  ] }];
  if (verImpuestos) {
    grupos.push({ titulo: "Impuestos", items: [{ href: "/impuestos/f29", texto: "F29 del mes" }] });
  }
  if (verRemuneraciones) {
    grupos.push({
      titulo: "Remuneraciones",
      items: [
        { href: "/remuneraciones/liquidaciones", texto: "Liquidaciones del mes" },
        { href: "/remuneraciones/previred", texto: "Archivo Previred" },
        { href: "/remuneraciones/lre", texto: "Libro de Remuneraciones (LRE)" },
        { href: "/remuneraciones/trabajadores", texto: "Trabajadores" },
        { href: "/remuneraciones/ausencias", texto: "Vacaciones y licencias" },
        { href: "/remuneraciones/finiquitos", texto: "Finiquitos" },
        { href: "/remuneraciones/documentos", texto: "Contratos y certificados" },
        { href: "/remuneraciones/parametros", texto: "Parámetros legales" },
      ],
    });
  }
  if (verLibros) {
    grupos.push({
      titulo: "Libros",
      items: [
        { href: "/libros/importar", texto: "Importar del SII" },
        { href: "/libros/compras", texto: "Compras" },
        { href: "/libros/ventas", texto: "Ventas" },
        { href: "/libros/honorarios", texto: "Honorarios" },
        { href: "/libros/mapeo", texto: "Otros softwares (Excel)" },
      ],
    });
  }
  if (verContabilidad) {
    grupos.push({
      titulo: "Contabilidad",
      items: [
        { href: "/contabilidad/comprobantes", texto: "Comprobantes" },
        { href: "/contabilidad/plan-de-cuentas", texto: "Plan de cuentas" },
        { href: "/contabilidad/libro-diario", texto: "Libro diario" },
        { href: "/contabilidad/libro-mayor", texto: "Libro mayor" },
        { href: "/contabilidad/balance", texto: "Balance 8 columnas" },
        { href: "/contabilidad/estado-resultados", texto: "Estado de resultados" },
        { href: "/contabilidad/centralizacion", texto: "Centralizaciones" },
        { href: "/bancos", texto: "Bancos y conciliación" },
        { href: "/contabilidad/cierre", texto: "Cierre de periodo" },
      ],
    });
  }
  grupos.push({
    titulo: "Estudio",
    items: [
      { href: "/empresas", texto: "Empresas" },
      ...(contador
        ? [
            { href: "/estudio/usuarios", texto: "Usuarios y permisos" },
            { href: "/estudio/auditoria", texto: "Auditoría" },
          ]
        : []),
    ],
  });

  const rol = ctx.rolEstudio ?? ctx.membresiasEmpresa[0]?.rol ?? "";

  return (
    <div className="flex h-screen overflow-hidden">
      <BarraLateral grupos={grupos} />
      <div className="flex min-w-0 flex-1 flex-col">
        {ctx.estudio?.es_demo && (
          <div className="flex items-center justify-center gap-3 bg-ambar px-4 py-1.5 text-sm font-medium text-white">
            Estás viendo un estudio de ejemplo.
            <Link href="/registro" className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-ambar hover:bg-amber-50">
              Crear mi cuenta
            </Link>
          </div>
        )}
        <header className="flex items-center gap-3 border-b border-borde bg-white px-4 py-2">
          <SelectorEmpresa empresas={ctx.empresas.filter((e) => e.activa)} actual={ctx.empresa} />
          <SelectorPeriodo anio={ctx.periodo.anio} mes={ctx.periodo.mes} />
          <span className="ml-auto hidden truncate text-sm text-texto-suave lg:block">{ctx.estudio?.nombre}</span>
          <MenuUsuario
            nombre={ctx.usuario.nombre}
            rol={NOMBRE_ROL[rol] ?? rol}
            estudios={ctx.estudios}
            estudioActual={ctx.estudio?.id ?? null}
          />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-fondo-suave">{children}</main>
      </div>
      <AtajosGlobales puedeCrearComprobante={verContabilidad && (ctx.empresa ? permiso(ctx, ctx.empresa.id, "contabilidad").editar : false)} />
    </div>
  );
}
