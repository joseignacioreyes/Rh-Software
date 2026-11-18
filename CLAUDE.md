# Prompt para construir "RH Software": contabilidad y remuneraciones para contadores en Chile

> Este archivo es la guía del proyecto RH Software. Para empezar, pide: "Empieza por la Fase 0".

**Marca:** RH Software (de Reyes Herrera). Eslogan: "Contabilidad y remuneraciones al día". Es la empresa hermana de RH Stock (app de inventario), así que más adelante ambas podrán conectarse: las compras confirmadas en RH Stock pueden llegar como documentos a RH Software.

### Logo y colores (ya diseñados, úsalos tal cual)

- Archivos en `public/brand/`:
  - `rhsoftware-logo.svg`: logo horizontal con eslogan.
  - `rhsoftware-icono.svg`: ícono cuadrado, un libro contable abierto con líneas, barras de crecimiento y un check verde de "al día".
- Desde el ícono genera el favicon y la imagen para compartir (1200×630, con el logo sobre fondo blanco).
- El texto del logo usa **Poppins** (700 y 400). Cárgala con `next/font`.
- Colores:
  - Azul principal `#1E3A8A`: barra lateral, encabezados y botones principales.
  - Verde `#059669`: "al día", "listo", "cuadra", y el texto "Software" del logo.
  - Celeste `#DBEAFE`: fondos suaves y filas seleccionadas.
  - Rojo `#DC2626`: "atrasado", "no cuadra" o error.
  - Ámbar `#D97706`: "por vencer" o "revisar".
  - Texto `#111827` y `#4B5563`; fondos `#FFFFFF` y `#F9FAFB`.
- Tipografía de la app: Inter para todo el contenido y las tablas, con números tabulares (`font-variant-numeric: tabular-nums`), y Poppins solo para títulos.

---

## 0. Regla número uno: rápido para el contador, claro para todos

RH Software es una **web para el computador** (escritorio), pensada para contadores y estudios contables que llevan **muchas empresas a la vez**. El objetivo es que un contador haga en minutos lo que hoy le toma horas. Aplica estas reglas en todas las fases:

1. **Selector de empresa siempre visible** arriba a la izquierda, con buscador por nombre o RUT, y el atajo `Ctrl+K` para cambiar de empresa en un segundo. El periodo (mes y año) también va siempre visible y se cambia con un clic.
2. **Panel "Mi mes"** como pantalla de inicio: una tabla con **todas las empresas del contador** y un semáforo por tarea del mes:
   - libros importados;
   - comprobantes cuadrados;
   - F29 listo;
   - remuneraciones calculadas;
   - archivo Previred generado;
   - LRE generado;
   - documentos pendientes del cliente.
   Cada celda lleva directo a esa tarea.
3. **Procesos masivos:** botones como "Calcular F29 de todas mis empresas", "Generar liquidaciones de todas" o "Generar archivos Previred del mes", con una barra de avance y un resumen de errores por empresa.
4. **Teclado primero:** atajos para todo lo frecuente (nuevo comprobante, guardar, siguiente línea, buscar cuenta). En el ingreso de comprobantes, `Enter` avanza de celda y la cuenta se busca escribiendo el código o el nombre.
5. **Tablas claras:** densas pero legibles, con totales siempre visibles, filtros, orden por columna y exportación a Excel en cada tabla. Los montos van alineados a la derecha, con separador de miles con punto.
6. **Nada se calcula "en secreto":** cada cálculo (liquidación, F29, impuesto único, cotizaciones) tiene un botón **"Ver cómo se calculó"** que muestra la fórmula, los parámetros usados con su fecha de vigencia y su fuente oficial.
7. **Avisos útiles, no ruido:** "Faltan 3 facturas de compra de enero en Transportes Cordillera" o "El IVA crédito de este mes es 40% mayor que el promedio: revisa".
8. **Lenguaje contable correcto** para el contador, y **lenguaje simple** en el portal del cliente y en los mensajes a trabajadores.
9. **Nada se borra sin preguntar.** Los periodos cerrados no se modifican, salvo reabriéndolos con un motivo que queda registrado.
10. **Pantalla mínima:** se ve bien desde 1366×768. No es necesario diseñar para celular, salvo el portal del cliente y la vista de liquidación del trabajador, que sí deben verse bien en el teléfono.

---

## 1. Tu rol y cómo trabajamos

Eres el desarrollador principal de un SaaS (software por suscripción) de contabilidad y remuneraciones para Chile. El dueño del producto es José, que no es programador experto. Su socia es contadora y validará los cálculos. Por lo tanto:

### Antes de cada fase: "Lo que necesito de ti"

1. Explica en 5 a 10 líneas simples qué vas a construir y qué se podrá probar al final.
2. Entrega una lista numerada **"Lo que necesito de ti"** con todo lo que dependa de José o de su socia:
   - cuentas que crear (con el link exacto y qué plan elegir);
   - claves o variables que debe pegarte (nunca las inventes);
   - archivos de ejemplo (por ejemplo, un CSV del RCV descargado del SII, una cartola, una liquidación hecha a mano para comparar);
   - decisiones que tomar (con tu recomendación marcada).
3. **Detente y espera** a que José responda "ok" o te entregue lo pedido. Si algo de la lista no es indispensable para empezar, dilo, y ofrece avanzar con datos de ejemplo mientras tanto.

### Al terminar cada fase: previsualización y OK

Haz la previsualización de la sección 11 y **espera el "ok" de José** antes de pasar a la siguiente fase. Si pide cambios, hazlos y vuelve a mostrar.

### Reglas generales

- Escribe el código y los comentarios en español. Los nombres de variables y funciones pueden ir en inglés.
- Prefiere soluciones simples y de bajo costo fijo (objetivo: menos de ~$80.000 CLP al mes al partir).
- **Nunca inventes tasas, topes ni tablas legales.** Todo valor legal va en la tabla de parámetros (sección 6) con su fuente y vigencia. Si no puedes verificarlo, déjalo marcado "POR VERIFICAR" y pídelo en "Lo que necesito de ti".

## 2. Qué problema resuelve

Un contador independiente o un estudio pequeño lleva entre 10 y 100 empresas (pymes, almacenes, transportistas, profesionales). Cada mes repite lo mismo para cada una:

- descargar compras y ventas del SII;
- registrar comprobantes;
- calcular el F29;
- hacer las liquidaciones de sueldo;
- armar la planilla de Previred;
- subir el Libro de Remuneraciones Electrónico (LRE) a la Dirección del Trabajo;
- perseguir a los clientes por documentos.

Hoy lo hace con varias herramientas, planillas Excel y WhatsApp.

**La promesa:** "Todas tus empresas en una sola pantalla, con el mes al día y sin digitar dos veces."

## 3. Usuarios y roles

- **Estudio contable (cuenta que paga):** agrupa a sus contadores y a sus empresas cliente.
- **Contador (administrador del estudio):** ve y trabaja todas las empresas del estudio, e invita a asistentes.
- **Asistente:** trabaja solo las empresas que se le asignan, con permisos por módulo (por ejemplo, solo remuneraciones).
- **Cliente (dueño o encargado de la empresa):** entra al **portal del cliente**, donde ve el estado del mes, sube documentos, descarga su F29 y sus liquidaciones, y aprueba lo que el contador le pida. No modifica la contabilidad.
- **Trabajador (fase posterior):** ve y descarga sus propias liquidaciones.
- **Superadministrador (José):** gestiona estudios, planes y pagos de la suscripción, y la tabla de parámetros legales. **No ve la contabilidad de las empresas** salvo autorización registrada para soporte.

**Inicio de sesión:** RUT y contraseña propia de RH Software, para todos los roles.
- El RUT se valida con dígito verificador (módulo 11) y se guarda normalizado (sin puntos, con guion).
- **Segundo factor obligatorio** para contadores y asistentes, por correo o app autenticadora, porque manejan datos de muchas empresas y de trabajadores.
- Un mismo usuario puede pertenecer a varias empresas o estudios, y cambia entre ellos sin volver a entrar.

## 4. Módulos

### 4.1 Empresas

- Ficha de la empresa:
  - RUT, razón social, nombre de fantasía, giro y actividades económicas;
  - dirección, comuna y representante legal;
  - **régimen tributario** (Pro Pyme General 14 D N°3, Pro Pyme Transparente 14 D N°8, Semi integrado 14 A u otro configurable);
  - inicio de actividades;
  - tasa de PPM;
  - si emite factura electrónica;
  - mutual o ISL, caja de compensación y tasa de cotización adicional de la ley 16.744.
- Asignación de contador y asistentes, y contacto de WhatsApp y correo del cliente.
- **Crear empresa en lote** importando un Excel con varias empresas.

### 4.2 Contabilidad

- **Plan de cuentas:** plantilla base para pymes chilenas, que cada empresa puede ajustar. Se puede importar desde Excel y copiar el plan de una empresa a otra.
- **Comprobantes** de ingreso, egreso y traspaso:
  - ingreso rápido por teclado;
  - validación de "debe = haber" antes de guardar;
  - adjuntos (foto o PDF del respaldo);
  - glosa y centro de costo opcional.
- **Centralizaciones automáticas** que generan comprobantes desde:
  - el registro de compras y de ventas;
  - las boletas de honorarios;
  - las remuneraciones del mes;
  - la conciliación bancaria.
  Las cuentas de destino se configuran una vez por empresa.
- **Conciliación bancaria:** importar la cartola (Excel o CSV de los bancos chilenos más usados, con un mapeo de columnas que se guarda), sugerir pareos automáticos y marcar diferencias.
- **Informes:** libro diario, libro mayor, balance de 8 columnas, estado de resultados, balance general y análisis de cuentas. Todos se pueden exportar a PDF y Excel.
- **Cierre de periodo:** bloquea el mes; reabrirlo exige un motivo, que queda registrado.

### 4.3 Libros: importar y exportar (prioridad alta)

**Importar:**
- **Registro de Compras y Ventas (RCV)** desde el CSV que el contador descarga del SII. Detecta el formato automáticamente, valida RUT y montos, y evita duplicados por tipo de documento, folio y RUT.
- **Boletas de honorarios** recibidas y emitidas (archivo descargado del SII), con su retención.
- **Libros desde otros softwares o desde Excel:** un asistente de mapeo de columnas ("esta columna es el folio, esta es el neto…"), con sugerencias de IA, vista previa y una validación antes de guardar. El mapeo se guarda para la próxima vez.
- **Comprobantes en lote** desde Excel (por ejemplo, para migrar saldos iniciales).
- **Documentos sueltos** (factura o boleta en papel, en foto o PDF), leídos con IA y siempre confirmados por una persona.

**Exportar:**
- Libro de compras, libro de ventas, libro de honorarios, libro diario, mayor y balance, en **Excel, PDF y CSV**.
- El libro de compras y ventas también en el formato `.csv` separado por punto y coma del **importador de libros del SII**, cuando corresponda (por ejemplo, documentos no electrónicos).
- Exportación completa de una empresa (todos sus libros de un año en un ZIP), para cambio de contador o para respaldo.

### 4.4 Impuestos

- **Propuesta de F29 calculada** por RH Software desde los libros:
  - IVA débito y crédito;
  - remanente;
  - PPM;
  - retención de honorarios;
  - impuesto único de trabajadores.
  Se muestra **lado a lado con la propuesta del SII** (importada o ingresada por el contador), con las diferencias resaltadas y explicadas.
- Resumen listo para declarar en sii.cl y botón "Marcar como declarado y pagado", con adjunto del comprobante.
- **Calendario tributario y laboral por empresa:** vencimientos de F29, Previred, LRE y declaraciones juradas, con recordatorios. Las fechas van en la tabla de parámetros: no las escribas directamente en el código.
- Fase posterior: apoyo a la Operación Renta (F22) y a las declaraciones juradas más comunes (por ejemplo, la DJ 1887 de sueldos y la DJ 1879 de honorarios).

### 4.5 Remuneraciones (prioridad alta, todo legal y verificable)

**Trabajadores:**
- ficha con RUT, datos personales mínimos, AFP, sistema de salud (Fonasa o Isapre con plan en UF o pesos), seguro de cesantía, cargas familiares y tramo;
- tipo de contrato (indefinido, plazo fijo o por obra), jornada en horas semanales, sueldo base y forma de pago;
- cuenta bancaria solo si el cliente la entrega.

**Contratos y documentos:** plantillas de contrato, anexo, carta de aviso y finiquito, en Word o PDF, completadas con los datos de la ficha. Revisión del contador obligatoria antes de usarlas.

**Liquidaciones mensuales:**
- **Haberes imponibles y no imponibles** configurables: sueldo base, gratificación legal (artículos 47 y 50 del Código del Trabajo, con su tope), horas extra, comisiones, bonos, colación, movilización, asignación familiar, etc.
- **Descuentos legales:**
  - AFP (10% + comisión de cada AFP);
  - salud (7% Fonasa o el plan de Isapre, con el tope imponible);
  - seguro de cesantía del trabajador;
  - impuesto único de segunda categoría según la tabla mensual vigente.
- **Otros descuentos:** anticipos, préstamos, cuotas sindicales y APV.
- **Aportes del empleador:**
  - seguro de cesantía del empleador;
  - mutual o ISL (ley 16.744);
  - **cotización de cargo del empleador de la Reforma de Pensiones (Ley 21.735)**, con su gradualidad. Desde las remuneraciones de agosto de 2026 es un 3,5% total: 0,1% a la cuenta individual, 0,9% a la Cotización con Rentabilidad Protegida (CRP) y 2,5% al SIS y la compensación por expectativa de vida. Sube cada agosto hasta 2033: modélalo como parámetros por periodo, nunca en el código.
- **Topes imponibles en UF** (AFP y salud; seguro de cesantía) y valor de la UF del último día del mes.
- Días trabajados, licencias médicas, ausencias, vacaciones, ingreso y salida a mitad de mes.
- Jornada según la Ley 40 horas, con su reducción gradual, como parámetro por fecha.
- **"Ver cómo se calculó"** en cada línea de la liquidación.
- **Proceso masivo:** calcular todas las liquidaciones de una empresa o de todas las empresas del contador, con un resumen de alertas (por ejemplo, "sueldo bajo el ingreso mínimo" o "falta la AFP de Juan").
- **Liquidación en PDF** con logo de la empresa cliente, lista para firmar, y envío por correo o WhatsApp al trabajador (con su consentimiento).

**Archivos legales del mes:**
- **Archivo Previred** en el formato estándar de nómina de **105 campos** (largo variable, separado por punto y coma), validado campo por campo antes de descargarlo. El contador lo sube en previred.com.
- **Libro de Remuneraciones Electrónico (LRE)** en el formato de la Dirección del Trabajo:
  - CSV o TXT delimitado por punto y coma;
  - nombre del archivo `rutempleador_aaaamm`;
  - con la codificación de conceptos del manual vigente de la DT.
  El contador lo sube en Mi DT.
- **Centralización contable** de las remuneraciones.

**Otros:**
- Vacaciones (saldo y feriado progresivo).
- **Finiquitos** con cálculo de indemnizaciones (años de servicio, aviso previo y feriado proporcional), con causales del Código del Trabajo, y siempre revisados por el contador.
- **Certificados** de remuneraciones y de cotizaciones.

**Pruebas obligatorias de remuneraciones:** casos de prueba con resultados verificados por la socia contadora y contrastados con simuladores oficiales o con liquidaciones reales anonimizadas. Si un cálculo no cuadra al peso con el caso verificado, la fase no está terminada.

### 4.6 Portal del cliente

- Estado del mes en lenguaje simple: "Tu IVA de enero está listo: debes pagar $245.300 antes del 20".
- Subir documentos (fotos, PDF o Excel) con un botón grande, que llegan a la **bandeja de documentos** del contador.
- Descargar su F29, sus libros y las liquidaciones de sus trabajadores.
- Responder solicitudes del contador ("Envíame las facturas de compra que faltan").

### 4.7 Bandeja de documentos e IA

- Todo lo que llega (portal, WhatsApp o correo) cae en una **bandeja por empresa**.
- La IA (API de Claude, modelo `claude-haiku-5-5` para leer documentos) extrae los datos, sugiere el tipo de documento y la cuenta contable, y detecta duplicados contra el RCV importado.
- **Nada se contabiliza sin confirmación** del contador o asistente.
- **Revisión inteligente del mes** (fase posterior): gastos inusuales, IVA crédito sospechoso, proveedores sin RUT válido, liquidaciones con variaciones grandes respecto del mes anterior.

## 5. Integraciones (SII, Previred, Dirección del Trabajo y WhatsApp)

### 5.1 SII: legal, por canales oficiales

El SII ha señalado que la clave tributaria es personal y no debe compartirse con terceros, que el acceso de terceros a la información de un contribuyente debe hacerse por sus canales formales, y que busca evitar la robotización de consultas a su sitio. En noviembre de 2026 lanzó una API oficial para el Registro de Cesiones y anunció más APIs para sus aplicaciones más consultadas. Por eso:

1. **No guardes claves tributarias de clientes ni automatices el sitio del SII con robots** (Playwright, scraping o similares) usando claves de terceros.
2. **Fase inicial:** el contador entra a sii.cl con su propio acceso (como representante o mandatario autorizado por la empresa), descarga los archivos (RCV, honorarios, propuesta de F29) y los sube a RH Software, idealmente arrastrando varios archivos de varias empresas a la vez. RH Software detecta la empresa y el periodo de cada archivo.
3. **Archivos de salida** en los formatos que el SII acepta para carga (importador de libros en CSV), cuando corresponda.
4. **Conector desacoplado** (`/integraciones/sii`): una interfaz única para que, cuando el SII publique APIs oficiales (por ejemplo, del RCV), se agreguen sin cambiar el resto de la app, usando el mecanismo de autorización formal que el SII defina. Revisa al inicio de esa fase qué APIs oficiales existen y cuáles son sus requisitos (certificado digital, convenio, autorización del contribuyente) y entrégalo en "Lo que necesito de ti".
5. Si el contador tiene certificado digital, que se pueda usar solo de la forma que el SII permita, cifrado y nunca compartido entre empresas.

### 5.2 Previred

- No hay una API pública de carga: **genera el archivo de nómina estándar de 105 campos** (formato de largo variable por separador, versión vigente publicada por Previred) y valídalo antes de descargarlo. El contador lo sube en previred.com y paga desde ahí.
- Importa la planilla o el comprobante de pago para marcar el mes como "Previred pagado".
- Mantén el formato versionado: Previred lo cambia (por ejemplo, con la Reforma de Pensiones se agregaron campos y tasas desde agosto de 2026). Al inicio de la fase de Previred, pide a José el PDF del formato vigente y un archivo real anonimizado.

### 5.3 Dirección del Trabajo (LRE)

- Genera el archivo LRE para la **carga masiva en Mi DT**.
- La DT anunció que su próxima evolución será la carga por servicios web (API). Deja el conector desacoplado igual que con el SII.

### 5.4 WhatsApp

- **Primero (gratis):** botones "Escribir por WhatsApp" con links `wa.me` prellenados (por ejemplo, "Hola, me faltan tus facturas de compra de enero") que abren el WhatsApp del contador.
- **Después:** **WhatsApp Business Cloud API (Meta)** con plantillas aprobadas, para:
  - recordatorios automáticos a clientes (documentos pendientes, F29 listo para pagar);
  - envío de liquidaciones a trabajadores que hayan aceptado recibirlas por WhatsApp;
  - **recepción** de fotos y PDF de documentos que el cliente envía al número del estudio, que caen en la bandeja de documentos de su empresa (identificada por el número de teléfono registrado).
- Requiere una cuenta de Meta Business verificada y un número dedicado, y tiene costo por conversación según la tarifa de Meta. Calcula el costo esperado y pídelo en "Lo que necesito de ti" antes de activarlo.
- Solo mensajes a personas que dieron su consentimiento. Nada de envíos masivos a números que no lo aceptaron.
- **Número de soporte y ventas de RH Software: +56 9 7776 6584** (`https://wa.me/56977766584`). Guárdalo en `NEXT_PUBLIC_WHATSAPP_SOPORTE`.

### 5.5 Bancos e indicadores

- Cartolas por importación de archivos (sección 4.2).
- UF, UTM y otros indicadores: obtenerlos de una fuente oficial con API (por ejemplo, la de la CMF) cuando sea posible, y guardarlos en la tabla de parámetros con su fuente. El superadministrador revisa y aprueba la actualización mensual de los parámetros legales.

## 6. Parámetros legales (la base de que todo sea correcto)

Tabla `parametros_legales` con: código, descripción, valor, unidad, **vigente desde**, **vigente hasta**, fuente (URL oficial), fecha de verificación y quién la verificó. Incluye como mínimo:

- UF diaria, UTM mensual, ingreso mínimo mensual;
- topes imponibles (AFP y salud; seguro de cesantía);
- tasas y comisiones de cada AFP;
- tasas del seguro de cesantía por tipo de contrato;
- cotización de cargo del empleador de la Reforma de Pensiones, con su desglose y su gradualidad por periodo;
- SIS;
- tabla del impuesto único de segunda categoría;
- tramos de asignación familiar;
- tope de la gratificación legal;
- retención de boletas de honorarios por año;
- jornada máxima semanal por fecha;
- tasa de IVA;
- vencimientos del calendario.

Cada cálculo usa los parámetros **vigentes en el periodo que se calcula** (recalcular junio de 2026 usa los de junio de 2026). Antes de cada fase de impuestos o remuneraciones, entrega en "Lo que necesito de ti" la lista de parámetros con sus fuentes oficiales (SII, Superintendencia de Pensiones, Previred, Dirección del Trabajo, CMF), para que la socia contadora los verifique.

## 7. Tecnología

- **Frontend y backend:** Next.js (App Router) con TypeScript, desplegado en Vercel (plan Pro, porque el gratis no permite uso comercial).
- **Base de datos, autenticación y archivos:** Supabase (Postgres, Auth y Storage), con **Row Level Security** por estudio y por empresa en todas las tablas, y pruebas automáticas de aislamiento.
- **Montos:** pesos como enteros (sin decimales flotantes); UF y tasas con `numeric` en la base y una librería decimal en el código. Redondeos según la norma de cada concepto, documentados.
- **Interfaz:** Tailwind CSS y una librería de tablas (por ejemplo, TanStack Table) con atajos de teclado.
- **Excel y CSV:** lectura y escritura con una librería mantenida (por ejemplo, ExcelJS), cuidando la codificación (UTF-8 y Latin-1, como los archivos del SII) y el separador punto y coma.
- **PDF:** generación en el servidor para liquidaciones, libros y certificados.
- **Tareas largas:** cola de trabajos para los procesos masivos, con avance visible.
- **IA:** API de Claude (`claude-haiku-5-5`) para leer documentos; respuestas en JSON validadas con Zod.
- **Correos:** proveedor transaccional en su plan gratis al inicio.
- **Formato:** fechas DD-MM-AAAA, zona horaria America/Santiago y separador de miles con punto.
- **Secretos:** solo en variables de entorno, con un `.env.example` documentado.

## 8. Modelo de datos (mínimo)

Todas las tablas de negocio llevan `estudio_id` y, cuando corresponde, `empresa_id`, con RLS. Incluye `created_at`, `updated_at` y `created_by`.

- **Cuentas y permisos:**
  - `estudios`, `usuarios` (RUT, nombre, correo, 2FA);
  - `membresias` (usuario, estudio o empresa, rol, permisos por módulo);
  - `consentimientos`.
- **Empresas:** `empresas` (incluye régimen y configuración de la ley 16.744), `periodos` (empresa, año, mes, estado abierto o cerrado).
- **Contabilidad:**
  - `plan_cuentas`, `comprobantes`, `lineas_comprobante`;
  - `centros_costo`, `config_centralizacion`;
  - `cartolas`, `movimientos_bancarios`, `conciliaciones`.
- **Libros e impuestos:**
  - `documentos_rcv` (tipo, folio, RUT contraparte, fecha, neto, exento, IVA, otros impuestos, total, origen);
  - `honorarios`;
  - `importaciones` (archivo, empresa, periodo, mapeo usado, resultado);
  - `f29_propuestas` (calculada, propuesta del SII, diferencias, estado).
- **Remuneraciones:**
  - `trabajadores`, `contratos`;
  - `instituciones` (AFP, Isapres, cajas, mutuales);
  - `conceptos_remuneracion` (imponible o no, tributable o no, código LRE, campo Previred);
  - `liquidaciones`, `items_liquidacion` (con un JSON del detalle del cálculo y de los parámetros usados);
  - `vacaciones`, `licencias`, `finiquitos`.
- **Parámetros y archivos:** `parametros_legales`, `archivos_generados` (Previred, LRE, libros; con un hash del contenido y quién lo generó).
- **Bandeja y comunicación:** `documentos_bandeja`, `solicitudes_cliente`, `mensajes_whatsapp`, `tareas_mes`, `notificaciones`.
- **Seguridad y cobro:** `auditoria` (quién hizo qué, cuándo y desde dónde), `suscripciones`, `pagos_suscripcion`.

## 9. Requisitos legales y de seguridad

1. **Ley 21.719 de protección de datos personales** (vigente desde el 1 de diciembre de 2026):
   - Las liquidaciones contienen **datos sensibles** (salud, licencias médicas, sindicato), así que deben ir con acceso restringido, cifrado en reposo y registro de accesos.
   - Política de privacidad y términos en `/privacidad` y `/terminos` (borradores marcados "BORRADOR: revisar antes de publicar").
   - Contrato de **encargo de tratamiento de datos** entre RH Software y cada estudio (borrador).
   - Página "Mis datos" para exportar y pedir la eliminación de los datos.
   - Procedimiento documentado ante una filtración.
2. **Código del Trabajo:**
   - liquidaciones con el detalle de haberes y descuentos (artículo 54);
   - libro de remuneraciones (artículo 62) mediante el LRE;
   - plazos y causales de término en los finiquitos.
3. **Responsabilidad:** RH Software asiste al contador. El contador revisa y responde por lo que declara. Muéstralo en los términos y en cada proceso de declaración ("Revisado por: …").
4. **Trazabilidad:** todo archivo generado (F29, Previred, LRE) queda guardado con la versión de los datos y de los parámetros usados, para poder explicarlo en una fiscalización.
5. **Respaldo:** respaldo diario de la base, y exportación completa por empresa en cualquier momento.
6. **Contraseñas** gestionadas por Supabase Auth, límite de intentos, 2FA para contadores y HTTPS en todo.

## 10. Perfil de ejemplo (créalo en la Fase 1 y complétalo en cada fase)

Todo es ficticio: ningún RUT, nombre ni teléfono real. Genéralo con `npm run seed:demo`, y que se pueda volver a correr dejando siempre lo mismo.

**Estudio:** Estudio Contable Demo
- Contadora: Ana Demo, RUT 15.111.222-6, clave `Demo1234` (2FA desactivado solo en el demo).
- Asistente: Luis Demo, RUT 16.222.333-K, con acceso solo a remuneraciones.

**Empresas cliente (con RUT de dígito verificador válido):**

| Empresa | RUT | Régimen | Trabajadores | Para probar |
|---|---|---|---|---|
| Almacén Don Pepe SpA | 76.111.222-8 | Pro Pyme Transparente | 2 (sueldo cercano al mínimo) | IVA con mucho crédito, boletas de venta |
| Transportes Cordillera Ltda. | 77.222.333-1 | Pro Pyme General | 5 (uno con horas extra, uno con licencia médica, uno con Isapre en UF, uno a plazo fijo, uno que entra a mitad de mes) | Remuneraciones completas, Previred y LRE |
| Consultora Andes SpA | 76.333.444-9 | Pro Pyme General | 0 | Honorarios con retención, servicios exentos |

**Datos de ejemplo:**
- 3 meses de RCV de compras y ventas por empresa en archivos CSV ficticios con el mismo formato que los del SII, que también sirven para probar la importación.
- Cartolas de ejemplo de un banco ficticio.
- 1 mes de liquidaciones ya calculadas y 1 mes por calcular.
- Algunas tareas del mes en rojo y en ámbar, para que el panel "Mi mes" muestre todos los estados.
- 2 documentos en la bandeja: una foto de factura de ejemplo **generada por ti** y un PDF.

**Botón "Ver demo" en la portada:** entra al Estudio Contable Demo en modo de solo lectura (o reiniciado cada noche), con una franja: "Estás viendo un estudio de ejemplo. [Crear mi cuenta]".

## 11. Previsualización obligatoria al final de CADA fase

1. Levanta la app en local con el perfil de ejemplo cargado.
2. Toma **capturas con Playwright en escritorio (1440×900)** de todas las pantallas nuevas o cambiadas, más las del portal del cliente en celular (390×844) cuando corresponda. Guárdalas en `previews/fase-N/` numeradas en el orden de uso (`01-mi-mes.png`, `02-importar-rcv.png`…), incluyendo los estados de vacío, cargando, éxito y error.
3. Arma `previews/fase-N/index.html` con las capturas en orden y una frase simple por pantalla: qué hace y qué debe probar José.
4. Graba un **video corto** (Playwright) del recorrido principal de la fase y guárdalo en `previews/fase-N/recorrido.webm`.
5. Si la fase genera archivos (Previred, LRE, libros, F29), guarda **ejemplos generados** en `previews/fase-N/archivos/` y un informe de validación.
6. Publica una **versión de prueba en Vercel** (preview, no producción) y entrega el link.
7. Entrega un **resumen en lenguaje simple**:
   - qué hice;
   - qué puedes probar (pasos numerados);
   - qué debe verificar la socia contadora;
   - qué necesito de ti para la siguiente fase.
8. **Espera el "ok" de José.** Sin capturas, página de revisión y link de prueba, la fase no está terminada.

## 12. Plan de trabajo por fases

Antes de **cada** fase: "Lo que necesito de ti" y esperar el ok. Al final de **cada** fase: previsualización y esperar el ok.

- **Fase 0. Preparación:** lista de cuentas (Vercel, Supabase, API de Claude, correo, dominio rhsoftware.cl o el que elija José), estructura del proyecto, `.env.example`, marca (logo, colores, tipografías), Playwright para las capturas, y una portada simple publicada con el logo.
- **Fase 1. Cuentas, multiempresa y seguridad:** inicio de sesión con RUT y clave, 2FA, estudios, empresas, roles y permisos, selector de empresa y periodo (`Ctrl+K`), RLS con pruebas, auditoría, páginas legales (borradores), perfil de ejemplo y botón "Ver demo".
- **Fase 2. Contabilidad base:** plan de cuentas (plantilla e importación), comprobantes con ingreso por teclado, libro diario, mayor, balance de 8 columnas, estado de resultados y cierre de periodo.
- **Fase 3. Importar y exportar libros:** RCV del SII (subida múltiple con detección de empresa y periodo), honorarios, asistente de mapeo para Excel y otros softwares, cartolas y conciliación, centralizaciones automáticas, y exportaciones a Excel, PDF y CSV del SII, más el ZIP anual.
- **Fase 4. Impuestos y panel "Mi mes":** propuesta de F29 versus la del SII, calendario de vencimientos, panel "Mi mes" con semáforos y procesos masivos.
- **Fase 5. Remuneraciones I:** parámetros legales (verificados por la socia), instituciones, trabajadores, conceptos, liquidaciones con "Ver cómo se calculó", proceso masivo y PDF. Casos de prueba que cuadren al peso.
- **Fase 6. Remuneraciones II:** archivo Previred de 105 campos, LRE para la DT, centralización, vacaciones, licencias, finiquitos, contratos y certificados.
- **Fase 7. Portal del cliente, bandeja de documentos y WhatsApp:** portal, bandeja con lectura por IA, links `wa.me`, y luego WhatsApp Business Cloud API (si José aprueba el costo).
- **Fase 8. Suscripciones y pagos:** planes por cantidad de empresas, pago por transferencia con comprobante, recordatorios y modo de solo lectura por atraso (sin borrar datos nunca).
- **Fase 9. Piloto:** probar con el estudio de la socia contadora con 3 a 5 empresas reales durante un mes, en paralelo con su sistema actual, y medir el tiempo ahorrado y las diferencias de cálculo.
- **Fase 10. Después del piloto:** conectores oficiales con SII y DT a medida que existan, revisión inteligente con IA, portal del trabajador, F22 y declaraciones juradas, e integración con RH Stock.

## 13. Costos objetivo (referencia)

- Fijo al partir: Vercel Pro (~US$20 al mes) + Supabase Pro (~US$25 al mes) + dominio .cl (~$11.800 al año).
- Variable: lectura de documentos con IA (fracciones de peso por documento) y, si se activa, las conversaciones de WhatsApp Business según la tarifa de Meta.
- Si una decisión técnica sube el costo fijo por sobre ~$80.000 CLP al mes, avísame antes.
