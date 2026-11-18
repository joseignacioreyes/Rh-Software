-- =====================================================================
-- Parámetros legales: tasas, topes, tablas y vencimientos, con vigencia y fuente.
-- Cada cálculo usa los vigentes en el periodo que se calcula. Nunca se escriben en el código.
-- Estado:
--   'por_verificar'   : cargado desde una fuente; falta que la contadora lo revise.
--   'verificado'      : revisado y aprobado (queda quién y cuándo).
-- Los valores iniciales se tomaron el 18-11-2026 de las fuentes indicadas en cada fila.
-- =====================================================================

create table public.parametros_legales (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  descripcion text not null,
  valor numeric,
  -- Para tablas (impuesto único, tasas por AFP, tramos de asignación familiar...).
  valor_json jsonb,
  unidad text not null, -- '%', 'UF', 'UTM', '$', 'horas', 'dia', 'factor', 'tabla'
  vigente_desde date not null,
  vigente_hasta date,
  fuente_nombre text not null,
  fuente_url text,
  estado text not null default 'por_verificar' check (estado in ('por_verificar', 'verificado')),
  verificado_por text,
  verificado_at date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valor is not null or valor_json is not null),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde),
  unique (codigo, vigente_desde)
);
create index parametros_codigo_fecha on public.parametros_legales (codigo, vigente_desde desc);
create trigger tocar_updated_at before update on public.parametros_legales for each row execute function app.tocar_updated_at();

alter table public.parametros_legales enable row level security;
-- Todos los usuarios con sesión los leen (son públicos y explican los cálculos).
create policy parametros_ver on public.parametros_legales for select to authenticated using (true);
-- Solo el superadministrador los modifica.
create policy parametros_crear on public.parametros_legales for insert to authenticated with check (app.es_superadmin());
create policy parametros_editar on public.parametros_legales for update to authenticated using (app.es_superadmin()) with check (app.es_superadmin());
revoke delete on public.parametros_legales from authenticated, anon;

-- Auditoría de cambios en parámetros (sin estudio).
create trigger auditar after insert or update on public.parametros_legales for each row execute function app.auditar();

-- Valor vigente a una fecha.
create or replace function public.parametro(p_codigo text, p_fecha date)
returns public.parametros_legales
language sql stable security invoker set search_path = '' as $$
  select * from public.parametros_legales
   where codigo = p_codigo and vigente_desde <= p_fecha and (vigente_hasta is null or vigente_hasta >= p_fecha)
   order by vigente_desde desc limit 1;
$$;
grant execute on function public.parametro to authenticated;

-- ---------------------------------------------------------------------
-- Valores iniciales
-- ---------------------------------------------------------------------
insert into public.parametros_legales (codigo, descripcion, valor, valor_json, unidad, vigente_desde, vigente_hasta, fuente_nombre, fuente_url, estado, notas) values
-- Impuestos
('IVA_TASA', 'Tasa del Impuesto al Valor Agregado', 19, null, '%', '2003-10-01', null, 'DL 825, artículo 14', 'https://www.bcn.cl/leychile/navegar?idNorma=6369', 'por_verificar', null),
('RETENCION_HONORARIOS', 'Retención de boletas de honorarios (art. 74 N°2 LIR, Ley 21.133)', 14.5, null, '%', '2025-01-01', '2025-12-31', 'SII, boletas de honorarios', 'https://www.sii.cl/destacados/boletas_honorarios/index.html', 'por_verificar', null),
('RETENCION_HONORARIOS', 'Retención de boletas de honorarios (art. 74 N°2 LIR, Ley 21.133)', 15.25, null, '%', '2026-01-01', '2026-12-31', 'SII (anuncio 26-12-2025, informado por Emol)', 'https://www.emol.com/noticias/Economia/2025/12/26/1186902/sii-retencion-boletas-honorarios.html', 'por_verificar', 'Confirmar en sii.cl'),
('RETENCION_HONORARIOS', 'Retención de boletas de honorarios (art. 74 N°2 LIR, Ley 21.133)', 16, null, '%', '2027-01-01', '2027-12-31', 'Ley 21.133 (calendario gradual)', 'https://www.sii.cl/destacados/boletas_honorarios/index.html', 'por_verificar', null),
('RETENCION_HONORARIOS', 'Retención de boletas de honorarios (art. 74 N°2 LIR, Ley 21.133)', 17, null, '%', '2028-01-01', null, 'Ley 21.133 (calendario gradual)', 'https://www.sii.cl/destacados/boletas_honorarios/index.html', 'por_verificar', null),
('UTM', 'Unidad Tributaria Mensual', 71649, null, '$', '2026-07-01', '2026-07-31', 'SII, Circular 39 de 2026', 'https://www.sii.cl/normativa_legislacion/circulares/2026/circu39.pdf', 'por_verificar', null),
('UTM', 'Unidad Tributaria Mensual', 71649, null, '$', '2026-08-01', '2026-08-31', 'SII, Circular 39 de 2026', 'https://www.sii.cl/normativa_legislacion/circulares/2026/circu39.pdf', 'por_verificar', null),
('UTM', 'Unidad Tributaria Mensual', 72151, null, '$', '2026-10-01', '2026-10-31', 'SII, Circular 39 de 2026 / Previred octubre 2026', 'https://www.sii.cl/valores_y_fechas/utm/utm2026.htm', 'por_verificar', null),
('UTM', 'Unidad Tributaria Mensual', 72440, null, '$', '2026-11-01', '2026-11-30', 'SII, Circular 39 de 2026 / Previred noviembre 2026', 'https://www.sii.cl/valores_y_fechas/utm/utm2026.htm', 'por_verificar', null),
('IMPUESTO_UNICO_TABLA', 'Impuesto único de segunda categoría, tabla mensual en UTM (art. 43 LIR)', null,
  '[{"desde":0,"hasta":13.5,"factor":0,"rebaja":0},{"desde":13.5,"hasta":30,"factor":0.04,"rebaja":0.54},{"desde":30,"hasta":50,"factor":0.08,"rebaja":1.74},{"desde":50,"hasta":70,"factor":0.135,"rebaja":4.49},{"desde":70,"hasta":90,"factor":0.23,"rebaja":11.14},{"desde":90,"hasta":120,"factor":0.304,"rebaja":17.8},{"desde":120,"hasta":310,"factor":0.35,"rebaja":23.32},{"desde":310,"hasta":null,"factor":0.4,"rebaja":38.82}]',
  'tabla', '2023-01-01', null, 'SII, tabla de impuesto único 2026 (comprobada al peso con octubre y noviembre 2026)', 'https://www.sii.cl/valores_y_fechas/impuesto_2da_categoria/impuesto2026.htm', 'por_verificar', 'Montos en UTM; el SII publica la misma tabla en pesos cada mes'),
-- Remuneraciones: indicadores Previred
('UF_FIN_MES', 'UF del último día del mes (para topes imponibles)', 41057.20, null, '$', '2026-09-01', '2026-09-30', 'Previred, indicadores octubre 2026', 'https://www.previred.com/wp-content/uploads/2026/10/Indicadores-Previsionales-Previred-Octubre-2026.pdf', 'por_verificar', null),
('UF_FIN_MES', 'UF del último día del mes (para topes imponibles)', 41247.63, null, '$', '2026-10-01', '2026-10-31', 'Previred, indicadores octubre 2026', 'https://www.previred.com/wp-content/uploads/2026/10/Indicadores-Previsionales-Previred-Octubre-2026.pdf', 'por_verificar', null),
('UF_FIN_MES', 'UF del último día del mes (para topes imponibles)', 41439.89, null, '$', '2026-11-01', '2026-11-30', 'Previred, indicadores noviembre 2026', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', null),
('INGRESO_MINIMO', 'Ingreso mínimo mensual (18 a 65 años)', 539000, null, '$', '2026-01-01', '2026-04-30', 'Ley 21.751', 'https://www.diariooficial.interior.gob.cl/publicaciones/2025/12/16/44325/01/2738483.pdf', 'por_verificar', null),
('INGRESO_MINIMO', 'Ingreso mínimo mensual (18 a 65 años)', 553553, null, '$', '2026-05-01', null, 'Ley 21.830 / Previred noviembre 2026', 'https://www.bcn.cl/leychile/navegar?idLey=21830', 'por_verificar', null),
('INGRESO_MINIMO_MENORES_MAYORES', 'Ingreso mínimo menores de 18 y mayores de 65', 412938, null, '$', '2026-05-01', null, 'Previred noviembre 2026', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', null),
('TOPE_IMPONIBLE_AFP', 'Tope imponible AFP y salud', 90, null, 'UF', '2026-02-01', null, 'Previred (octubre y noviembre 2026)', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', 'Confirmar desde qué mes rige'),
('TOPE_IMPONIBLE_AFC', 'Tope imponible seguro de cesantía', 135.2, null, 'UF', '2026-02-01', null, 'Previred (octubre y noviembre 2026)', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', 'Confirmar desde qué mes rige'),
('AFP_TASA_TRABAJADOR', 'Cotización obligatoria de cargo del trabajador por AFP (10% + comisión)', null,
  '{"capital":11.44,"cuprum":11.44,"habitat":11.27,"planvital":11.16,"provida":11.45,"modelo":10.58,"uno":10.46}',
  'tabla', '2026-10-01', null, 'Previred, indicadores octubre y noviembre 2026', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', null),
('EMPLEADOR_CUENTA_INDIVIDUAL', 'Reforma de pensiones (Ley 21.735): cotización del empleador a la cuenta individual', 0.1, null, '%', '2026-08-01', null, 'Previred, indicadores octubre y noviembre 2026', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', 'Sube cada agosto hasta 2033: cargar el nuevo valor con su vigencia'),
('EMPLEADOR_RENTABILIDAD_PROTEGIDA', 'Reforma de pensiones (Ley 21.735): Cotización con Rentabilidad Protegida (Seguro Social)', 0.9, null, '%', '2026-08-01', null, 'Previred, indicadores octubre y noviembre 2026', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', null),
('EMPLEADOR_EXPECTATIVA_VIDA', 'Reforma de pensiones (Ley 21.735): compensación por expectativa de vida (Seguro Social)', 0.72, null, '%', '2026-08-01', '2026-10-31', 'Previred, indicadores octubre 2026', 'https://www.previred.com/wp-content/uploads/2026/10/Indicadores-Previsionales-Previred-Octubre-2026.pdf', 'por_verificar', null),
('EMPLEADOR_EXPECTATIVA_VIDA', 'Reforma de pensiones (Ley 21.735): compensación por expectativa de vida (Seguro Social)', 0.71, null, '%', '2026-11-01', null, 'Previred, indicadores noviembre 2026', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', null),
('SIS_TASA', 'Seguro de Invalidez y Sobrevivencia (cargo del empleador)', 1.78, null, '%', '2026-08-01', '2026-10-31', 'Previred, indicadores octubre 2026', 'https://www.previred.com/wp-content/uploads/2026/10/Indicadores-Previsionales-Previred-Octubre-2026.pdf', 'por_verificar', null),
('SIS_TASA', 'Seguro de Invalidez y Sobrevivencia (cargo del empleador)', 1.79, null, '%', '2026-11-01', null, 'Previred, indicadores noviembre 2026', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', null),
('AFC_TASAS', 'Seguro de cesantía por tipo de contrato (% de la remuneración imponible)', null,
  '{"indefinido":{"empleador":2.4,"trabajador":0.6},"plazo_fijo":{"empleador":3.0,"trabajador":0},"obra":{"empleador":3.0,"trabajador":0},"indefinido_11_anios":{"empleador":0.8,"trabajador":0},"casa_particular":{"empleador":3.0,"trabajador":0}}',
  'tabla', '2026-01-01', null, 'Previred, indicadores noviembre 2026', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', 'Contrato por obra: se asimila a plazo fijo (confirmar)'),
('SALUD_TASA', 'Cotización legal de salud', 7, null, '%', '2000-01-01', null, 'DL 3.500 / Ley 18.469 (Previred)', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', null),
('SALUD_DISTRIBUCION_CCAF', 'Distribución del 7% de salud para empleadores afiliados a CCAF', null, '{"ccaf":4.2,"fonasa":2.8}', 'tabla', '2026-01-01', null, 'Previred, indicadores noviembre 2026', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', null),
('ASIGNACION_FAMILIAR_TRAMOS', 'Asignación familiar: monto por carga según renta', null,
  '[{"tramo":"A","hasta":649039,"monto":22601},{"tramo":"B","hasta":947990,"monto":13870},{"tramo":"C","hasta":1478539,"monto":4382},{"tramo":"D","hasta":null,"monto":0}]',
  'tabla', '2026-05-01', null, 'Previred (octubre y noviembre 2026) / Ley 21.830', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', 'Confirmar fecha de inicio de los tramos'),
('APV_TOPE_MENSUAL', 'Tope mensual de APV con beneficio tributario', 50, null, 'UF', '2026-01-01', null, 'Previred, indicadores noviembre 2026', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', null),
('TRABAJO_PESADO', 'Cotización trabajo pesado (empleador / trabajador)', null, '{"pesado":{"empleador":2,"trabajador":2},"menos_pesado":{"empleador":1,"trabajador":1}}', 'tabla', '2026-01-01', null, 'Previred, indicadores noviembre 2026', 'https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf', 'por_verificar', null),
('GRATIFICACION_PORCENTAJE', 'Gratificación art. 50: porcentaje de la remuneración mensual', 25, null, '%', '2000-01-01', null, 'Código del Trabajo, artículo 50', 'https://www.dt.gob.cl/legislacion/1624/w3-article-95561.html', 'por_verificar', null),
('GRATIFICACION_TOPE_IMM', 'Gratificación art. 50: tope anual en ingresos mínimos mensuales', 4.75, null, 'factor', '2000-01-01', null, 'Código del Trabajo, artículo 50', 'https://www.dt.gob.cl/legislacion/1624/w3-article-95561.html', 'por_verificar', 'Mensual = 4,75 × IMM / 12'),
('HORAS_EXTRA_RECARGO', 'Recargo de horas extraordinarias', 50, null, '%', '2000-01-01', null, 'Código del Trabajo, artículo 32', 'https://www.dt.gob.cl/legislacion/1624/w3-article-95555.html', 'por_verificar', null),
('JORNADA_MAXIMA', 'Jornada ordinaria máxima semanal (Ley 21.561)', 44, null, 'horas', '2024-04-26', '2026-04-25', 'Dirección del Trabajo, Ley 40 horas', 'https://dt.gob.cl/portal/1626/w3-propertyname-2556.html', 'por_verificar', null),
('JORNADA_MAXIMA', 'Jornada ordinaria máxima semanal (Ley 21.561)', 42, null, 'horas', '2026-04-26', '2028-04-25', 'Dirección del Trabajo, Ley 40 horas', 'https://dt.gob.cl/portal/1626/w3-propertyname-2556.html', 'por_verificar', null),
('JORNADA_MAXIMA', 'Jornada ordinaria máxima semanal (Ley 21.561)', 40, null, 'horas', '2028-04-26', null, 'Dirección del Trabajo, Ley 40 horas', 'https://dt.gob.cl/portal/1626/w3-propertyname-2556.html', 'por_verificar', null),
-- Calendario
('VENC_F29_DIA', 'F29: día de vencimiento general (mes siguiente)', 12, null, 'dia', '2000-01-01', null, 'SII', 'https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_4485.htm', 'por_verificar', 'Si es inhábil, pasa al siguiente día hábil'),
('VENC_F29_DIA_ELECTRONICO', 'F29: día de vencimiento para facturadores electrónicos que declaran y pagan por internet', 20, null, 'dia', '2000-01-01', null, 'SII, preguntas frecuentes', 'https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_4485.htm', 'por_verificar', 'Si es inhábil, pasa al siguiente día hábil'),
('VENC_PREVIRED_DIA', 'Cotizaciones: día de pago presencial (mes siguiente)', 10, null, 'dia', '2000-01-01', null, 'Superintendencia de Pensiones', 'https://www.spensiones.cl/portal/institucional/594/w3-article-2728.html', 'por_verificar', null),
('VENC_PREVIRED_DIA_ELECTRONICO', 'Cotizaciones: día de pago electrónico (mes siguiente)', 13, null, 'dia', '2000-01-01', null, 'Superintendencia de Pensiones', 'https://www.spensiones.cl/portal/institucional/594/w3-article-2728.html', 'por_verificar', 'Rige aunque sea inhábil'),
('VENC_LRE_DIA', 'Libro de Remuneraciones Electrónico: día de carga en Mi DT (mes siguiente)', 15, null, 'dia', '2000-01-01', null, 'Dirección del Trabajo (POR VERIFICAR)', 'https://www.dt.gob.cl', 'por_verificar', 'No se encontró fuente oficial al cargar: verificar');
