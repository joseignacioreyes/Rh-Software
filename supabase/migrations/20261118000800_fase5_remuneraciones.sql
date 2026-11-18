-- =====================================================================
-- Fase 5: remuneraciones (trabajadores, instituciones, novedades del mes, liquidaciones).
-- Datos sensibles (salud, licencias): acceso restringido por módulo y registro de accesos.
-- =====================================================================

-- Instituciones previsionales (catálogo común).
create table public.instituciones (
  codigo text primary key,           -- 'afp_capital', 'isapre_banmedica', 'fonasa', ...
  tipo text not null check (tipo in ('afp', 'isapre', 'fonasa', 'ccaf', 'mutual', 'isl')),
  nombre text not null,
  codigo_previred text,              -- POR VERIFICAR con el formato vigente de Previred
  activa boolean not null default true
);
alter table public.instituciones enable row level security;
create policy instituciones_ver on public.instituciones for select to authenticated using (true);
create policy instituciones_editar on public.instituciones for all to authenticated using (app.es_superadmin()) with check (app.es_superadmin());

insert into public.instituciones (codigo, tipo, nombre, codigo_previred) values
  ('afp_capital', 'afp', 'AFP Capital', '33'),
  ('afp_cuprum', 'afp', 'AFP Cuprum', '03'),
  ('afp_habitat', 'afp', 'AFP Habitat', '05'),
  ('afp_planvital', 'afp', 'AFP PlanVital', '29'),
  ('afp_provida', 'afp', 'AFP ProVida', '08'),
  ('afp_modelo', 'afp', 'AFP Modelo', '34'),
  ('afp_uno', 'afp', 'AFP Uno', '35'),
  ('fonasa', 'fonasa', 'Fonasa', null),
  ('isapre_banmedica', 'isapre', 'Isapre Banmédica', null),
  ('isapre_colmena', 'isapre', 'Isapre Colmena', null),
  ('isapre_consalud', 'isapre', 'Isapre Consalud', null),
  ('isapre_cruzblanca', 'isapre', 'Isapre Cruz Blanca', null),
  ('isapre_nuevamasvida', 'isapre', 'Isapre Nueva Masvida', null),
  ('isapre_vidatres', 'isapre', 'Isapre Vida Tres', null),
  ('isapre_esencial', 'isapre', 'Isapre Esencial', null),
  ('ccaf_losandes', 'ccaf', 'Caja Los Andes', null),
  ('ccaf_laaraucana', 'ccaf', 'Caja La Araucana', null),
  ('ccaf_18', 'ccaf', 'Caja 18 de Septiembre', null),
  ('ccaf_losheroes', 'ccaf', 'Caja Los Héroes', null),
  ('mutual_achs', 'mutual', 'ACHS', null),
  ('mutual_ist', 'mutual', 'IST', null),
  ('mutual_mutual', 'mutual', 'Mutual de Seguridad CChC', null),
  ('isl', 'isl', 'Instituto de Seguridad Laboral (ISL)', null);

create table public.trabajadores (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  rut text not null check (app.rut_valido(rut)),
  nombres text not null,
  apellido_paterno text not null,
  apellido_materno text,
  fecha_nacimiento date,
  sexo text check (sexo in ('F', 'M', 'X')),
  nacionalidad text default 'Chilena',
  direccion text,
  comuna text,
  correo text,
  telefono text,
  cargo text,
  fecha_ingreso date not null,
  fecha_termino date,
  tipo_contrato text not null check (tipo_contrato in ('indefinido', 'plazo_fijo', 'obra')),
  jornada_horas numeric(4, 1) not null,
  sueldo_base bigint not null check (sueldo_base >= 0),
  -- Gratificación: art. 50 pagada mensualmente con tope, o sin gratificación mensual (art. 47 anual u otra).
  gratificacion text not null default 'art50_mensual' check (gratificacion in ('art50_mensual', 'sin')),
  colacion bigint not null default 0,
  movilizacion bigint not null default 0,
  afp text references public.instituciones(codigo),        -- null: no cotiza en AFP (pensionado u otro)
  pensionado boolean not null default false,
  salud text not null default 'fonasa' references public.instituciones(codigo),
  plan_isapre_uf numeric(8, 4),
  plan_isapre_pesos bigint,
  seguro_cesantia boolean not null default true,
  trabajo_pesado text not null default 'no' check (trabajo_pesado in ('no', 'pesado', 'menos_pesado')),
  cargas_familiares int not null default 0 check (cargas_familiares >= 0),
  forma_pago text not null default 'transferencia' check (forma_pago in ('transferencia', 'cheque', 'efectivo')),
  banco text,
  cuenta_bancaria text,
  consentimiento_whatsapp boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  unique (empresa_id, rut),
  unique (id, empresa_id)
);

-- Novedades del mes por trabajador: horas extra, licencias, ausencias, bonos y descuentos variables.
create table public.novedades (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  trabajador_id uuid not null,
  anio int not null,
  mes int not null check (mes between 1 and 12),
  horas_extra numeric(6, 2) not null default 0,
  dias_licencia int not null default 0 check (dias_licencia between 0 and 31),
  dias_ausencia int not null default 0 check (dias_ausencia between 0 and 31),
  bono_imponible bigint not null default 0,
  comisiones bigint not null default 0,
  bono_no_imponible bigint not null default 0,
  anticipo bigint not null default 0,
  prestamo bigint not null default 0,
  cuota_sindical bigint not null default 0,
  apv bigint not null default 0,
  otros_descuentos bigint not null default 0,
  observaciones text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  foreign key (trabajador_id, empresa_id) references public.trabajadores (id, empresa_id) on delete cascade,
  unique (trabajador_id, anio, mes)
);

create table public.liquidaciones (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  trabajador_id uuid not null,
  anio int not null,
  mes int not null check (mes between 1 and 12),
  estado text not null default 'calculada' check (estado in ('calculada', 'aprobada', 'anulada')),
  dias_trabajados int not null,
  total_imponible bigint not null,
  total_no_imponible bigint not null,
  total_haberes bigint not null,
  renta_imponible_afp bigint not null,
  renta_imponible_afc bigint not null,
  base_tributable bigint not null,
  cotizacion_afp bigint not null,
  cotizacion_salud bigint not null,
  cotizacion_afc bigint not null,
  impuesto_unico bigint not null,
  total_descuentos bigint not null,
  liquido bigint not null,
  aportes_empleador bigint not null,
  costo_empresa bigint not null,
  -- Detalle completo del cálculo: ítems con fórmula, valores y parámetros; alertas.
  detalle jsonb not null,
  parametros jsonb not null,
  version_datos text not null,
  aprobada_por uuid references auth.users(id),
  aprobada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  foreign key (trabajador_id, empresa_id) references public.trabajadores (id, empresa_id) on delete cascade,
  unique (trabajador_id, anio, mes)
);
create index liquidaciones_periodo on public.liquidaciones (empresa_id, anio, mes);

create table public.items_liquidacion (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  liquidacion_id uuid not null references public.liquidaciones(id) on delete cascade,
  orden int not null,
  codigo text not null,
  nombre text not null,
  tipo text not null check (tipo in ('haber_imponible', 'haber_no_imponible', 'descuento_legal', 'descuento_otro', 'aporte_empleador', 'informativo')),
  monto bigint not null,
  detalle jsonb not null
);
create index items_liquidacion_liq on public.items_liquidacion (liquidacion_id);

-- Catálogo de conceptos (para el LRE y Previred en la Fase 6).
create table public.conceptos_remuneracion (
  codigo text primary key,
  nombre text not null,
  tipo text not null check (tipo in ('haber_imponible', 'haber_no_imponible', 'descuento_legal', 'descuento_otro', 'aporte_empleador', 'informativo')),
  imponible boolean not null,
  tributable boolean not null,
  codigo_lre text,       -- POR VERIFICAR con el manual vigente de la DT
  campo_previred text    -- POR VERIFICAR con el formato vigente de Previred
);
alter table public.conceptos_remuneracion enable row level security;
create policy conceptos_ver on public.conceptos_remuneracion for select to authenticated using (true);
create policy conceptos_editar on public.conceptos_remuneracion for all to authenticated using (app.es_superadmin()) with check (app.es_superadmin());

insert into public.conceptos_remuneracion (codigo, nombre, tipo, imponible, tributable) values
  ('sueldo_base', 'Sueldo base', 'haber_imponible', true, true),
  ('horas_extra', 'Horas extraordinarias', 'haber_imponible', true, true),
  ('comisiones', 'Comisiones', 'haber_imponible', true, true),
  ('bono_imponible', 'Bonos imponibles', 'haber_imponible', true, true),
  ('gratificacion', 'Gratificación legal (art. 50)', 'haber_imponible', true, true),
  ('colacion', 'Asignación de colación', 'haber_no_imponible', false, false),
  ('movilizacion', 'Asignación de movilización', 'haber_no_imponible', false, false),
  ('asignacion_familiar', 'Asignación familiar', 'haber_no_imponible', false, false),
  ('bono_no_imponible', 'Bonos no imponibles', 'haber_no_imponible', false, false),
  ('afp', 'Cotización AFP', 'descuento_legal', false, false),
  ('salud', 'Cotización de salud', 'descuento_legal', false, false),
  ('afc_trabajador', 'Seguro de cesantía (trabajador)', 'descuento_legal', false, false),
  ('impuesto_unico', 'Impuesto único de segunda categoría', 'descuento_legal', false, false),
  ('anticipo', 'Anticipo de sueldo', 'descuento_otro', false, false),
  ('prestamo', 'Cuota de préstamo', 'descuento_otro', false, false),
  ('cuota_sindical', 'Cuota sindical', 'descuento_otro', false, false),
  ('apv', 'Ahorro previsional voluntario', 'descuento_otro', false, false),
  ('otros_descuentos', 'Otros descuentos', 'descuento_otro', false, false),
  ('sis', 'Seguro de Invalidez y Sobrevivencia', 'aporte_empleador', false, false),
  ('afc_empleador', 'Seguro de cesantía (empleador)', 'aporte_empleador', false, false),
  ('ley_16744', 'Seguro de accidentes del trabajo (Ley 16.744)', 'aporte_empleador', false, false),
  ('empleador_ci', 'Reforma de pensiones: cuenta individual', 'aporte_empleador', false, false),
  ('empleador_crp', 'Reforma de pensiones: rentabilidad protegida', 'aporte_empleador', false, false),
  ('empleador_ev', 'Reforma de pensiones: expectativa de vida', 'aporte_empleador', false, false);

-- Parámetro faltante para la Ley 16.744 (cotización básica).
insert into public.parametros_legales (codigo, descripcion, valor, unidad, vigente_desde, fuente_nombre, fuente_url, estado, notas) values
  ('LEY16744_BASICA', 'Ley 16.744: cotización básica de cargo del empleador (0,90% + 0,03% Ley SANNA)', 0.93, '%', '2018-01-01',
   'Ley 16.744 y Ley 21.063 (SANNA)', 'https://www.suseso.gob.cl', 'por_verificar', 'Confirmar la vigencia de la cotización SANNA de 0,03%');

do $$
declare t text;
begin
  foreach t in array array['trabajadores', 'novedades', 'liquidaciones'] loop
    execute format('create trigger tocar_updated_at before update on public.%I for each row execute function app.tocar_updated_at()', t);
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function app.auditar()', t);
  end loop;
end $$;

alter table public.trabajadores enable row level security;
alter table public.novedades enable row level security;
alter table public.liquidaciones enable row level security;
alter table public.items_liquidacion enable row level security;

do $$
declare t text;
begin
  foreach t in array array['trabajadores', 'novedades', 'liquidaciones', 'items_liquidacion'] loop
    execute format('create policy %1$s_ver on public.%1$I for select to authenticated using (app.puede_ver(empresa_id, ''remuneraciones''))', t);
    execute format('create policy %1$s_crear on public.%1$I for insert to authenticated with check (app.puede_editar(empresa_id, ''remuneraciones'') and estudio_id = app.estudio_de(empresa_id))', t);
    execute format('create policy %1$s_editar on public.%1$I for update to authenticated using (app.puede_editar(empresa_id, ''remuneraciones'')) with check (app.puede_editar(empresa_id, ''remuneraciones''))', t);
  end loop;
end $$;
-- Los ítems se reemplazan al recalcular una liquidación no aprobada.
create policy items_liquidacion_borrar on public.items_liquidacion for delete to authenticated using (app.puede_editar(empresa_id, 'remuneraciones'));
grant delete on public.items_liquidacion to authenticated;

-- Una liquidación aprobada no se recalcula ni se modifica (salvo anularla).
create or replace function app.proteger_liquidacion() returns trigger
language plpgsql as $$
begin
  if old.estado = 'aprobada' and new.estado = 'aprobada' and new.detalle is distinct from old.detalle then
    raise exception 'La liquidación está aprobada: para cambiarla, primero anúlala.';
  end if;
  return new;
end $$;
create trigger proteger_liquidacion before update on public.liquidaciones for each row execute function app.proteger_liquidacion();
