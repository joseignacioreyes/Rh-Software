-- =====================================================================
-- Fase 8: suscripciones y pagos.
-- Planes por cantidad de empresas, pago por transferencia con comprobante,
-- y modo de SOLO LECTURA por atraso (nunca se borran datos).
-- =====================================================================

-- Planes: los precios son una decisión comercial de José (editables por el superadministrador).
create table public.planes (
  codigo text primary key,
  nombre text not null,
  max_empresas int not null check (max_empresas > 0),
  precio_mensual bigint not null check (precio_mensual >= 0), -- pesos, IVA incluido
  descripcion text,
  activo boolean not null default true,
  orden int not null default 0,
  updated_at timestamptz not null default now()
);

-- PROPUESTA de precios (José decide antes de publicar). Precios en pesos, IVA incluido.
insert into public.planes (codigo, nombre, max_empresas, precio_mensual, descripcion, orden) values
  ('inicial', 'Inicial', 10, 29990, 'Para contadores independientes que parten.', 1),
  ('estudio', 'Estudio', 30, 59990, 'Para estudios pequeños con asistentes.', 2),
  ('pro', 'Pro', 80, 109990, 'Para estudios con muchas empresas.', 3),
  ('grande', 'Grande', 200, 189990, 'Para estudios grandes.', 4);

create table public.suscripciones (
  estudio_id uuid primary key references public.estudios(id) on delete cascade,
  plan text not null references public.planes(codigo),
  -- prueba: periodo gratis; activa: al día; por_vencer/atrasada se calculan con las fechas;
  -- solo_lectura: atraso mayor a los días de gracia; cancelada: el estudio se fue (se conservan los datos).
  estado text not null default 'prueba' check (estado in ('prueba', 'activa', 'solo_lectura', 'cancelada')),
  pagado_hasta date not null,
  dias_gracia int not null default 10,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pagos_suscripcion (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  plan text not null references public.planes(codigo),
  meses int not null default 1 check (meses between 1 and 12),
  monto bigint not null check (monto > 0),
  fecha_transferencia date not null,
  banco_origen text,
  numero_operacion text,
  ruta_comprobante text,
  estado text not null default 'informado' check (estado in ('informado', 'aprobado', 'rechazado')),
  motivo_rechazo text,
  revisado_por uuid references auth.users(id),
  revisado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);
create index pagos_suscripcion_estudio on public.pagos_suscripcion (estudio_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['suscripciones', 'pagos_suscripcion'] loop
    execute format('create trigger tocar_updated_at before update on public.%I for each row execute function app.tocar_updated_at()', t);
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function app.auditar()', t);
  end loop;
end $$;

-- ¿El estudio puede escribir? Falso solo en solo lectura o cancelado, o con atraso mayor a la gracia.
-- Sin suscripción (estudios antiguos o el demo) se considera al día.
create or replace function app.estudio_escribible(p_estudio uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select s.estado in ('prueba', 'activa')
       and (now() at time zone 'America/Santiago')::date <= s.pagado_hasta + s.dias_gracia
    from public.suscripciones s where s.estudio_id = p_estudio), true);
$$;
grant execute on function app.estudio_escribible to authenticated;

-- Editar exige además que el estudio esté al día (el modo solo lectura nunca borra ni oculta datos).
create or replace function app.puede_editar(p_empresa uuid, p_modulo text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.mfa_ok() and exists (
    select 1
    from public.empresas e
    join public.membresias m on m.estudio_id = e.estudio_id and m.activa
    where e.id = p_empresa and m.usuario_id = auth.uid()
      and app.estudio_escribible(e.estudio_id)
      and (
        (m.empresa_id is null and m.rol = 'contador')
        or (m.empresa_id = e.id and m.rol = 'asistente'
            and coalesce((m.permisos ->> p_modulo)::boolean, false))
      ));
$$;

-- Empresas: crear o editar exige estar al día; crear, además, respetar el máximo del plan.
drop policy empresas_crear on public.empresas;
create policy empresas_crear on public.empresas for insert to authenticated
  with check (app.es_contador(estudio_id) and app.estudio_escribible(estudio_id));
drop policy empresas_editar on public.empresas;
create policy empresas_editar on public.empresas for update to authenticated
  using (app.es_contador(estudio_id)) with check (app.es_contador(estudio_id) and app.estudio_escribible(estudio_id));

create or replace function app.revisar_limite_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_max int; v_actuales int;
begin
  if tg_op = 'UPDATE' and (old.activa or not new.activa) then return new; end if;
  select p.max_empresas into v_max from public.suscripciones s join public.planes p on p.codigo = s.plan where s.estudio_id = new.estudio_id;
  if v_max is null then return new; end if;
  select count(*) into v_actuales from public.empresas where estudio_id = new.estudio_id and activa and id <> new.id;
  if v_actuales + 1 > v_max then
    raise exception 'Tu plan permite % empresas activas. Cambia a un plan mayor o desactiva una empresa.', v_max using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger limite_plan before insert or update of activa on public.empresas
  for each row execute function app.revisar_limite_plan();

alter table public.planes enable row level security;
alter table public.suscripciones enable row level security;
alter table public.pagos_suscripcion enable row level security;

-- Planes: los ve cualquiera (también la portada pública); solo el superadministrador los cambia.
create policy planes_ver on public.planes for select to anon, authenticated using (true);
create policy planes_editar on public.planes for all to authenticated using (app.es_superadmin()) with check (app.es_superadmin());

-- Suscripción: la ve el estudio; solo el superadministrador la modifica.
create policy suscripciones_ver on public.suscripciones for select to authenticated using (app.es_miembro(estudio_id) or app.es_superadmin());
create policy suscripciones_editar on public.suscripciones for all to authenticated using (app.es_superadmin()) with check (app.es_superadmin());

-- Pagos: el contador informa un pago (con comprobante); el superadministrador lo aprueba o rechaza.
-- Informar un pago se permite aunque el estudio esté en solo lectura (justamente para ponerse al día).
create policy pagos_ver on public.pagos_suscripcion for select to authenticated using (app.es_contador(estudio_id) or app.es_superadmin());
create policy pagos_crear on public.pagos_suscripcion for insert to authenticated
  with check (app.es_contador(estudio_id) and estado = 'informado' and revisado_por is null);
create policy pagos_revisar on public.pagos_suscripcion for update to authenticated using (app.es_superadmin()) with check (app.es_superadmin());

-- Aprobar un pago extiende "pagado hasta" y reactiva el estudio (todo en una transacción).
create or replace function public.aprobar_pago(p_pago uuid) returns date
language plpgsql security definer set search_path = '' as $$
declare v_pago public.pagos_suscripcion; v_hasta date;
begin
  if not app.es_superadmin() then raise exception 'Solo el superadministrador aprueba pagos'; end if;
  select * into v_pago from public.pagos_suscripcion where id = p_pago for update;
  if v_pago.id is null or v_pago.estado <> 'informado' then raise exception 'El pago no está pendiente de revisión'; end if;
  update public.pagos_suscripcion set estado = 'aprobado', revisado_por = auth.uid(), revisado_at = now() where id = p_pago;
  insert into public.suscripciones (estudio_id, plan, estado, pagado_hasta)
    values (v_pago.estudio_id, v_pago.plan, 'activa', (now() at time zone 'America/Santiago')::date)
    on conflict (estudio_id) do nothing;
  update public.suscripciones
     set plan = v_pago.plan, estado = 'activa',
         pagado_hasta = (greatest(pagado_hasta, (now() at time zone 'America/Santiago')::date) + make_interval(months => v_pago.meses))::date
   where estudio_id = v_pago.estudio_id
   returning pagado_hasta into v_hasta;
  return v_hasta;
end $$;
revoke all on function public.aprobar_pago from public, anon;
grant execute on function public.aprobar_pago to authenticated;

-- Resumen de estudios para el superadministrador: SOLO datos de la cuenta (nunca la contabilidad).
create or replace function public.resumen_estudios() returns table (
  estudio_id uuid, nombre text, rut text, es_demo boolean, creado timestamptz, plan text, estado text,
  pagado_hasta date, dias_gracia int, empresas_activas bigint, usuarios bigint, pagos_pendientes bigint, contacto text
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.nombre, e.rut, e.es_demo, e.created_at, s.plan, s.estado, s.pagado_hasta, s.dias_gracia,
         (select count(*) from public.empresas x where x.estudio_id = e.id and x.activa),
         (select count(distinct m.usuario_id) from public.membresias m where m.estudio_id = e.id and m.activa and m.rol <> 'cliente'),
         (select count(*) from public.pagos_suscripcion p where p.estudio_id = e.id and p.estado = 'informado'),
         (select u.correo from public.membresias m join public.usuarios u on u.id = m.usuario_id
           where m.estudio_id = e.id and m.rol = 'contador' and m.empresa_id is null and m.activa order by m.created_at limit 1)
  from public.estudios e left join public.suscripciones s on s.estudio_id = e.id
  where app.es_superadmin()
  order by e.created_at desc;
$$;
grant execute on function public.resumen_estudios to authenticated;

-- Comprobantes de pago: bucket propio, carpeta por estudio ("<estudio>/archivo").
insert into storage.buckets (id, name, public) values ('suscripciones', 'suscripciones', false) on conflict do nothing;
create policy comprobantes_pago_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'suscripciones' and app.es_contador(((storage.foldername(name))[1])::uuid));
create policy comprobantes_pago_ver on storage.objects for select to authenticated
  using (bucket_id = 'suscripciones' and (app.es_contador(((storage.foldername(name))[1])::uuid) or app.es_superadmin()));
