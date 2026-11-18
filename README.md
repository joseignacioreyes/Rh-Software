# RH Software

**Contabilidad y remuneraciones al día.** Web de contabilidad, libros, impuestos y remuneraciones para contadores y estudios contables en Chile, con varias empresas por usuario.

- Todas tus empresas en una pantalla ("Mi mes"), con semáforo por tarea.
- Importa y exporta libros (RCV del SII, honorarios, Excel de otros softwares).
- Remuneraciones con cálculo explicado, archivo Previred y Libro de Remuneraciones Electrónico.
- Portal del cliente y WhatsApp para pedir y recibir documentos.

## Cómo se construye

Este proyecto se construye con Claude Code siguiendo `CLAUDE.md`, por fases. Cada fase parte con una lista de "Lo que necesito de ti" y termina con una previsualización y la aprobación de José.
Para empezar, abre el proyecto en Claude Code y escribe: **"Empieza por la Fase 0"**.

## Para trabajar en el computador

Requiere Node.js 20.9 o superior.

```bash
npm install
cp .env.example .env.local   # y completa los valores
npm run dev                  # abre http://localhost:3000
```

Base de datos local (Supabase en Docker):

```bash
npx supabase start          # levanta Postgres, Auth y Storage y aplica supabase/migrations
npm run seed:demo           # carga el Estudio Contable Demo (se puede repetir)
npm test                    # 82 pruebas, incluidas las de aislamiento entre estudios (RLS)
```

Usuarios del demo (clave `Demo1234`, sin 2FA solo en el demo):

| Quién | RUT | Qué ve |
|---|---|---|
| Ana Demo, contadora | 15.111.222-6 | Todo el estudio |
| Luis Demo, asistente | 16.222.333-K | Solo remuneraciones de 2 empresas |
| José Pérez Demo, cliente | 13.444.555-6 | Portal del cliente del Almacén |

Otros comandos:

- `npm run build` y `npm start`: versión de producción en local.
- `npm run crear:superadmin -- --rut … --nombre "…" --correo …`: crea el superadministrador (una vez por ambiente).
- `npm run previews`: con la app corriendo (`BASE_URL`), regenera capturas, videos y archivos de ejemplo de las fases 1 a 8.
- `npm run lint` y `npm run typecheck`: revisiones de código.
- `npm run marca`: regenera el favicon, el ícono para iPhone y la imagen para compartir desde `public/brand/`.
- `npm run previews:fase-0`: previsualización de la Fase 0.

## Estructura

- `src/app/(app)/`: la app del contador (Mi mes, contabilidad, libros, impuestos, remuneraciones, bandeja, estudio).
- `src/app/portal/`: portal del cliente (pensado para el celular).
- `src/app/admin/`: administración de RH Software (superadministrador; nunca ve la contabilidad).
- `src/lib/`: cálculos (F29, liquidaciones, finiquitos, Previred, LRE), importadores, exportadores y parámetros legales.
- `supabase/migrations/`: base de datos con Row Level Security por estudio y empresa.
- `tests/` y `src/lib/*.test.ts`: pruebas automáticas.
- `docs/`: borradores legales, casos de prueba de remuneraciones y nota de costos de WhatsApp.
- `demo/`: archivos ficticios con el formato del SII, cartolas y documentos para la bandeja.
- `previews/`: revisión de cada fase (abre `previews/index.html`).

## Marca

- Logo: `public/brand/rhsoftware-logo.svg`
- Ícono: `public/brand/rhsoftware-icono.svg`
- Colores: azul `#1E3A8A`, verde `#059669`, celeste `#DBEAFE`
- Soporte y ventas por WhatsApp: +56 9 7776 6584
