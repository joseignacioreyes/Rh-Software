-- =====================================================================
-- Fase 6: Previred, LRE, vacaciones, licencias, finiquitos, documentos.
-- Códigos tomados de:
--  * Previred, "Formato estándar largo variable, por separador", versión 58 (abril 2022).
--  * Dirección del Trabajo, "Libro de Remuneraciones Electrónico: instrucciones de carga", Anexo N°2.
-- =====================================================================

alter table public.instituciones add column codigo_lre text;

update public.instituciones set codigo_previred = v.p, codigo_lre = v.l
from (values
  ('afp_capital', '33', '31'), ('afp_cuprum', '03', '13'), ('afp_habitat', '05', '14'), ('afp_planvital', '29', '11'),
  ('afp_provida', '08', '6'), ('afp_modelo', '34', '103'), ('afp_uno', '35', '19'),
  ('fonasa', '07', '102'), ('isapre_banmedica', '01', '3'), ('isapre_consalud', '02', '9'), ('isapre_vidatres', '03', '12'),
  ('isapre_colmena', '04', '4'), ('isapre_cruzblanca', '05', '1'), ('isapre_nuevamasvida', '10', '43'), ('isapre_esencial', null, '44'),
  ('ccaf_losandes', '01', '1'), ('ccaf_laaraucana', '02', '2'), ('ccaf_losheroes', '03', '3'), ('ccaf_18', '06', '4'),
  ('mutual_achs', '01', '1'), ('mutual_mutual', '02', '2'), ('mutual_ist', '03', '3'), ('isl', '00', '0')
) as v(c, p, l)
where codigo = v.c;

-- Empresa: organismo de la Ley 16.744 y CCAF como institución, y región/comuna para el LRE.
alter table public.empresas
  add column mutual text references public.instituciones(codigo),
  add column ccaf text references public.instituciones(codigo),
  add column region_lre int,
  add column comuna_lre int;

-- Trabajador: años cotizados con otros empleadores (para feriado progresivo) y centro de costo.
alter table public.trabajadores add column anios_previos_cotizados int not null default 0 check (anios_previos_cotizados between 0 and 10);

-- Licencias médicas.
create table public.licencias (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  trabajador_id uuid not null,
  folio text,
  tipo text not null default 'enfermedad' check (tipo in ('enfermedad', 'accidente_trabajo', 'maternal', 'hijo_menor', 'otra')),
  desde date not null,
  hasta date not null,
  rut_pagadora text,
  observaciones text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  foreign key (trabajador_id, empresa_id) references public.trabajadores (id, empresa_id) on delete cascade,
  check (hasta >= desde)
);

-- Vacaciones tomadas (los saldos se calculan desde la fecha de ingreso).
create table public.vacaciones (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  trabajador_id uuid not null,
  desde date not null,
  hasta date not null,
  dias_habiles numeric(5, 1) not null check (dias_habiles > 0),
  observaciones text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  foreign key (trabajador_id, empresa_id) references public.trabajadores (id, empresa_id) on delete cascade,
  check (hasta >= desde)
);

-- Finiquitos (siempre revisados por el contador).
create table public.finiquitos (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  trabajador_id uuid not null,
  fecha_termino date not null,
  causal int not null,                 -- código de la Tabla N°1 del LRE (cód 1104)
  aviso_previo_dado boolean not null default false,
  remuneracion_base bigint not null,
  detalle jsonb not null,
  total bigint not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'revisado', 'firmado', 'anulado')),
  revisado_por uuid references auth.users(id),
  revisado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  foreign key (trabajador_id, empresa_id) references public.trabajadores (id, empresa_id) on delete cascade
);

do $$
declare t text;
begin
  foreach t in array array['licencias', 'vacaciones', 'finiquitos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_ver on public.%1$I for select to authenticated using (app.puede_ver(empresa_id, ''remuneraciones''))', t);
    execute format('create policy %1$s_crear on public.%1$I for insert to authenticated with check (app.puede_editar(empresa_id, ''remuneraciones'') and estudio_id = app.estudio_de(empresa_id))', t);
    execute format('create policy %1$s_editar on public.%1$I for update to authenticated using (app.puede_editar(empresa_id, ''remuneraciones'')) with check (app.puede_editar(empresa_id, ''remuneraciones''))', t);
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function app.auditar()', t);
  end loop;
end $$;
-- Una vacación o licencia mal ingresada se puede eliminar (queda en auditoría).
create policy vacaciones_borrar on public.vacaciones for delete to authenticated using (app.puede_editar(empresa_id, 'remuneraciones'));
create policy licencias_borrar on public.licencias for delete to authenticated using (app.puede_editar(empresa_id, 'remuneraciones'));
grant delete on public.vacaciones, public.licencias to authenticated;
create trigger tocar_updated_at before update on public.finiquitos for each row execute function app.tocar_updated_at();

-- Parámetros de finiquitos y feriado.
insert into public.parametros_legales (codigo, descripcion, valor, unidad, vigente_desde, fuente_nombre, fuente_url, estado, notas) values
  ('FERIADO_DIAS_HABILES', 'Feriado legal anual (art. 67 CT)', 15, 'dias', '2000-01-01', 'Código del Trabajo, artículo 67', 'https://www.dt.gob.cl/legislacion/1624/w3-article-95580.html', 'por_verificar', 'Días hábiles'),
  ('FERIADO_PROGRESIVO_CADA', 'Feriado progresivo: un día adicional por cada 3 años sobre 10 (art. 68 CT)', 3, 'factor', '2000-01-01', 'Código del Trabajo, artículo 68', 'https://www.dt.gob.cl/legislacion/1624/w3-article-95581.html', 'por_verificar', 'Solo 10 años con empleadores anteriores pueden acreditarse'),
  ('INDEMNIZACION_DIAS_POR_ANIO', 'Indemnización por años de servicio: días por año (art. 163 CT)', 30, 'dias', '2000-01-01', 'Código del Trabajo, artículo 163', 'https://www.dt.gob.cl/legislacion/1624/w3-article-95676.html', 'por_verificar', null),
  ('INDEMNIZACION_TOPE_ANIOS', 'Indemnización por años de servicio: tope de años (art. 163 CT)', 11, 'factor', '2000-01-01', 'Código del Trabajo, artículo 163', 'https://www.dt.gob.cl/legislacion/1624/w3-article-95676.html', 'por_verificar', '330 días de remuneración'),
  ('INDEMNIZACION_TOPE_UF', 'Tope de la remuneración base para indemnizaciones (art. 172 CT)', 90, 'UF', '2000-01-01', 'Código del Trabajo, artículo 172', 'https://www.dt.gob.cl/legislacion/1624/w3-article-95685.html', 'por_verificar', null),
  ('PREVIRED_FORMATO_VERSION', 'Versión del formato de archivo Previred usada', 58, 'factor', '2022-04-01', 'Previred, Formato estándar largo variable por separador (v58, abril 2022)', 'https://www.previred.com/documents/80476/80730/FormatoLargoVariablePorSeparador.pdf', 'por_verificar', 'Confirmar si hay una versión posterior con campos de la Reforma de Pensiones');

-- Corrige la fuente del vencimiento del LRE: día 15 del mes siguiente (DT, instrucciones de carga del LRE).
update public.parametros_legales
   set fuente_nombre = 'Dirección del Trabajo, instrucciones de carga del LRE', fuente_url = 'https://www.dt.gob.cl/portal/1626/w3-article-119843.html', notas = 'Hasta el día 15 del mes siguiente al pago'
 where codigo = 'VENC_LRE_DIA';
