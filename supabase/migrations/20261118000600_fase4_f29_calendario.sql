-- =====================================================================
-- Fase 4: propuesta de F29 versus la del SII, y calendario (feriados).
-- =====================================================================

create table public.f29_propuestas (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  anio int not null,
  mes int not null check (mes between 1 and 12),
  -- Cálculo de RH Software: { "codigos": { "538": 123, ... }, "lineas": [...detalle y explicación...] }
  calculada jsonb not null,
  -- Valores de la propuesta del SII ingresados o importados por el contador: { "538": 123, ... }
  propuesta_sii jsonb,
  -- Ajustes manuales del contador: { "48": 120000 } con su motivo en notas.
  ajustes jsonb not null default '{}'::jsonb,
  -- Parámetros usados (con vigencia y fuente) y versión de los datos (hash de los documentos).
  parametros jsonb not null,
  version_datos text not null,
  total_a_pagar bigint not null default 0,
  estado text not null default 'borrador' check (estado in ('borrador', 'revisado', 'declarado', 'pagado')),
  revisado_por uuid references auth.users(id),
  revisado_at timestamptz,
  declarado_at timestamptz,
  folio_declaracion text,
  monto_pagado bigint,
  ruta_comprobante text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  unique (empresa_id, anio, mes)
);
create trigger tocar_updated_at before update on public.f29_propuestas for each row execute function app.tocar_updated_at();
create trigger auditar after insert or update or delete on public.f29_propuestas for each row execute function app.auditar();

alter table public.f29_propuestas enable row level security;
-- El cliente ve su F29 (portal); el contador y asistentes con "impuestos" lo trabajan.
create policy f29_ver on public.f29_propuestas for select to authenticated
  using (app.puede_ver(empresa_id, 'impuestos') or app.puede_ver(empresa_id));
create policy f29_crear on public.f29_propuestas for insert to authenticated
  with check (app.puede_editar(empresa_id, 'impuestos') and estudio_id = app.estudio_de(empresa_id));
create policy f29_editar on public.f29_propuestas for update to authenticated
  using (app.puede_editar(empresa_id, 'impuestos')) with check (app.puede_editar(empresa_id, 'impuestos'));
revoke delete on public.f29_propuestas from authenticated, anon;

-- Una vez declarado, el cálculo no se puede cambiar (solo notas y datos del pago).
create or replace function app.proteger_f29_declarado() returns trigger
language plpgsql as $$
begin
  if old.estado in ('declarado', 'pagado') and (
    new.calculada is distinct from old.calculada or new.ajustes is distinct from old.ajustes
    or new.total_a_pagar is distinct from old.total_a_pagar
  ) then
    raise exception 'El F29 ya fue declarado: su cálculo no se puede modificar.';
  end if;
  return new;
end $$;
create trigger proteger_f29 before update on public.f29_propuestas for each row execute function app.proteger_f29_declarado();

-- Feriados nacionales (para correr vencimientos al siguiente día hábil). Datos públicos.
create table public.feriados (
  fecha date primary key,
  nombre text not null,
  fuente text not null default 'feriados.cl / BCN (POR VERIFICAR)'
);
alter table public.feriados enable row level security;
create policy feriados_ver on public.feriados for select to authenticated using (true);
create policy feriados_editar on public.feriados for all to authenticated using (app.es_superadmin()) with check (app.es_superadmin());

insert into public.feriados (fecha, nombre) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-04-04', 'Sábado Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-05-21', 'Día de las Glorias Navales'),
  ('2026-06-21', 'Día Nacional de los Pueblos Indígenas'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-16', 'Virgen del Carmen'),
  ('2026-08-15', 'Asunción de la Virgen'),
  ('2026-09-18', 'Independencia Nacional'),
  ('2026-09-19', 'Glorias del Ejército'),
  ('2026-10-12', 'Encuentro de Dos Mundos'),
  ('2026-10-31', 'Día de las Iglesias Evangélicas y Protestantes'),
  ('2026-11-01', 'Día de Todos los Santos'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo');

-- Bucket "archivos": permitir reemplazar el comprobante de pago del F29 (mismo nombre).
create policy archivos_storage_actualizar on storage.objects for update to authenticated
  using (bucket_id = 'archivos' and app.puede_ver(((storage.foldername(name))[2])::uuid));
