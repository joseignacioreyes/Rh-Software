import Link from "next/link";
import { Logo } from "@/components/marca/Logo";
import { PiePagina } from "@/components/marca/PiePagina";
import { BotonWhatsApp } from "@/components/marca/BotonWhatsApp";

// Portada pública de RH Software (Fase 0).
// La tabla "Mi mes" de esta página es solo ilustrativa, con empresas ficticias.

type Estado = "listo" | "revisar" | "atrasado" | "na";

const TAREAS = ["Libros", "Comprobantes", "F29", "Sueldos", "Previred", "LRE", "Documentos"];

const EJEMPLO: { empresa: string; rut: string; estados: Estado[] }[] = [
  {
    empresa: "Almacén Don Pepe SpA",
    rut: "76.111.222-8",
    estados: ["listo", "listo", "revisar", "listo", "listo", "listo", "revisar"],
  },
  {
    empresa: "Transportes Cordillera Ltda.",
    rut: "77.222.333-1",
    estados: ["atrasado", "revisar", "atrasado", "listo", "revisar", "revisar", "atrasado"],
  },
  {
    empresa: "Consultora Andes SpA",
    rut: "76.333.444-9",
    estados: ["listo", "listo", "listo", "na", "na", "na", "listo"],
  },
];

const ESTILO_ESTADO: Record<Estado, { clase: string; texto: string }> = {
  listo: { clase: "bg-verde", texto: "Al día" },
  revisar: { clase: "bg-ambar", texto: "Revisar" },
  atrasado: { clase: "bg-rojo", texto: "Atrasado" },
  na: { clase: "bg-gray-300", texto: "No aplica" },
};

const FUNCIONES = [
  {
    titulo: "Panel “Mi mes”",
    texto:
      "Todas tus empresas en una tabla, con un semáforo por tarea: libros, F29, sueldos, Previred y LRE. Un clic y estás en la tarea.",
  },
  {
    titulo: "Libros sin digitar",
    texto:
      "Arrastra los archivos del Registro de Compras y Ventas de varias empresas a la vez. RH Software detecta la empresa y el periodo.",
  },
  {
    titulo: "F29 lado a lado",
    texto:
      "La propuesta calculada desde tus libros junto a la del SII, con las diferencias resaltadas y explicadas.",
  },
  {
    titulo: "Remuneraciones verificables",
    texto:
      "Liquidaciones con “Ver cómo se calculó” en cada línea, archivo Previred y Libro de Remuneraciones Electrónico.",
  },
  {
    titulo: "Procesos masivos",
    texto:
      "Calcula el F29 o las liquidaciones de todas tus empresas con un botón, y revisa solo las alertas.",
  },
  {
    titulo: "Portal del cliente",
    texto:
      "Tus clientes suben sus documentos y ven el estado del mes en lenguaje simple. Menos persecución por WhatsApp.",
  },
];

export default function Portada() {
  return (
    <>
      <header className="border-b border-borde bg-fondo">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/ingresar"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-azul hover:bg-celeste sm:inline"
            >
              Ingresar
            </Link>
            <form action="/demo" method="post">
              <button
                type="submit"
                className="whitespace-nowrap rounded-md bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro"
              >
                Ver demo
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Presentación */}
        <section className="bg-gradient-to-b from-celeste/60 to-fondo">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:py-20">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-verde ring-1 ring-verde/30">
                <span className="h-2 w-2 rounded-full bg-verde" aria-hidden="true" />
                Para contadores y estudios contables en Chile
              </p>
              <h1 className="text-4xl leading-tight font-bold tracking-tight text-azul sm:text-5xl">
                Todas tus empresas en una sola pantalla.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-texto-suave">
                Contabilidad, libros, F29 y remuneraciones con el mes al día y{" "}
                <strong className="font-semibold text-texto">sin digitar dos veces</strong>. Lo que hoy te
                toma horas, en minutos.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <BotonWhatsApp
                  mensaje="Hola, quiero saber más de RH Software para mi estudio contable."
                  texto="Conversemos por WhatsApp"
                />
                <form action="/demo" method="post"><button type="submit" className="rounded-md border border-azul px-5 py-3 text-sm font-semibold text-azul hover:bg-celeste">Ver el estudio de ejemplo</button></form>
              </div>
            </div>

            {/* Vista ilustrativa del panel "Mi mes" */}
            <figure className="overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5">
              <div className="flex items-center justify-between bg-azul px-4 py-2.5 text-white">
                <span className="font-titulo text-sm font-bold">Mi mes · Octubre 2026</span>
                <span className="text-xs text-blue-100">3 empresas</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-fondo-suave text-texto-suave">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Empresa</th>
                      {TAREAS.map((t) => (
                        <th key={t} className="px-1.5 py-2 text-center font-semibold">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {EJEMPLO.map((fila) => (
                      <tr key={fila.rut} className="border-t border-borde">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-texto">{fila.empresa}</div>
                          <div className="text-texto-suave">{fila.rut}</div>
                        </td>
                        {fila.estados.map((estado, i) => (
                          <td key={TAREAS[i]} className="px-1.5 py-2.5 text-center">
                            <span
                              className={`inline-block h-3.5 w-3.5 rounded-full ${ESTILO_ESTADO[estado].clase}`}
                              title={`${TAREAS[i]}: ${ESTILO_ESTADO[estado].texto}`}
                            />
                            <span className="sr-only">
                              {TAREAS[i]}: {ESTILO_ESTADO[estado].texto}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <figcaption className="flex flex-wrap gap-x-4 gap-y-1 border-t border-borde bg-fondo-suave px-4 py-2.5 text-xs text-texto-suave">
                {(["listo", "revisar", "atrasado"] as Estado[]).map((e) => (
                  <span key={e} className="inline-flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${ESTILO_ESTADO[e].clase}`} aria-hidden="true" />
                    {ESTILO_ESTADO[e].texto}
                  </span>
                ))}
                <span className="ml-auto italic">Ejemplo con empresas ficticias</span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Funciones */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold text-azul sm:text-3xl">Hecho para el mes del contador</h2>
          <p className="mt-2 max-w-2xl text-texto-suave">
            Cada tarea que repites en cada empresa, en un solo lugar y con atajos de teclado.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCIONES.map((f) => (
              <article key={f.titulo} className="rounded-lg border border-borde bg-white p-5">
                <h3 className="text-base font-bold text-texto">{f.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-texto-suave">{f.texto}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Confianza */}
        <section className="bg-fondo-suave">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
            <div>
              <h3 className="font-bold text-azul">Nada se calcula en secreto</h3>
              <p className="mt-2 text-sm leading-relaxed text-texto-suave">
                Cada cálculo muestra su fórmula, los parámetros legales usados, su vigencia y la fuente oficial.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-azul">Por los canales oficiales</h3>
              <p className="mt-2 text-sm leading-relaxed text-texto-suave">
                No pedimos ni guardamos claves tributarias de tus clientes. Trabajamos con los archivos que
                descargas del SII y con sus APIs oficiales a medida que existan.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-azul">Datos protegidos</h3>
              <p className="mt-2 text-sm leading-relaxed text-texto-suave">
                Cada estudio ve solo sus empresas. Segundo factor de acceso para contadores y registro de quién
                hizo qué, según la Ley 21.719.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-azul">¿Llevas muchas empresas?</h2>
          <p className="mx-auto mt-2 max-w-xl text-texto-suave">
            Cuéntanos cómo trabajas hoy y te avisamos cuando puedas probar RH Software con tu estudio.
          </p>
          <div className="mt-6 flex justify-center">
            <BotonWhatsApp mensaje="Hola, quiero probar RH Software cuando esté disponible." texto="Escríbenos por WhatsApp" />
          </div>
          <p className="mt-4 text-sm text-texto-suave">
            o revisa nuestra <Link href="/privacidad" className="text-azul underline">política de privacidad</Link>.
          </p>
        </section>
      </main>

      <PiePagina />
    </>
  );
}
