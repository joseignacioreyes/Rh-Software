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

Otros comandos:

- `npm run build` y `npm start`: versión de producción en local.
- `npm run lint` y `npm run typecheck`: revisiones de código.
- `npm run marca`: regenera el favicon, el ícono para iPhone y la imagen para compartir desde `public/brand/`.
- `npm run previews:fase-0`: con la app corriendo, genera las capturas, el video y `previews/fase-0/index.html`.

## Estructura

- `src/app/`: páginas (portada, `/privacidad`, `/terminos`) e íconos.
- `src/components/marca/`: logo, botón de WhatsApp y pie de página.
- `src/components/legal/`: plantilla de páginas legales en borrador.
- `src/lib/`: configuración y formatos chilenos (pesos y fechas).
- `scripts/`: generación de marca y previsualizaciones por fase.
- `previews/fase-N/`: revisión de cada fase.

## Marca

- Logo: `public/brand/rhsoftware-logo.svg`
- Ícono: `public/brand/rhsoftware-icono.svg`
- Colores: azul `#1E3A8A`, verde `#059669`, celeste `#DBEAFE`
- Soporte y ventas por WhatsApp: +56 9 7776 6584
