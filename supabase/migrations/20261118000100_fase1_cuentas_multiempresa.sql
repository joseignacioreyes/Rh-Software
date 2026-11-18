-- =====================================================================
-- Fase 1: cuentas, multiempresa, permisos, auditoría.
-- Reglas:
--  * Toda tabla de negocio lleva estudio_id (y empresa_id cuando corresponde) con RLS.
--  * Nada se borra físicamente desde la app: las empresas se desactivan.
--  * Contadores y asistentes deben haber pasado el segundo factor (aal2) para ver datos.
-- =====================================================================

create schema if not exists app;
grant usage on schema app to authenticated, anon, service_role;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------

-- Valida un RUT normalizado ("12345678-K") con dígito verificador módulo 11.
create or replace function app.rut_valido(rut text) returns boolean
language plpgsql immutable as $$
declare
  cuerpo text;
  dv text;
  suma int := 0;
  factor int := 2;
  resto int;
  esperado text;
begin
  if rut is null or rut !~ '^[0-9]{1,8}-[0-9K]$' then
    return false;
  end if;
  cuerpo := split_part(rut, '-', 1);
  dv := split_part(rut, '-', 2);
  for i in reverse length(cuerpo)..1 loop
    suma := suma + substr(cuerpo, i, 1)::int * factor;
    factor := case when factor = 7 then 2 else factor + 1 end;
  end loop;
  resto := 11 - (suma % 11);
  esperado := case resto when 11 then '0' when 10 then 'K' else resto::text end;
  return dv = esperado;
end $$;

-- Mantiene updated_at al día.
create or replace function app.tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table public.estudios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rut text check (rut is null or app.rut_valido(rut)),
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- Perfil de cada usuario (la contraseña y el 2FA los gestiona Supabase Auth).
create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  rut text not null unique check (app.rut_valido(rut)),
  nombre text not null,
  correo text not null,
  -- Contadores y asistentes deben usar segundo factor. Solo el demo lo desactiva.
  requiere_2fa boolean not null default true,
  es_superadmin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create type public.rol_membresia as enum ('contador', 'asistente', 'cliente', 'lector');

-- Pertenencia de un usuario a un estudio (empresa_id nulo) o a una empresa puntual.
--  * contador: a nivel de estudio, ve y trabaja todas sus empresas.
--  * lector:   a nivel de estudio, solo lectura (lo usa el "Ver demo").
--  * asistente: por empresa, con permisos por módulo.
--  * cliente:  por empresa, para el portal del cliente.
create table public.membresias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  empresa_id uuid,
  rol public.rol_membresia not null,
  -- Ejemplo: {"contabilidad": true, "remuneraciones": false}
  permisos jsonb not null default '{}'::jsonb,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint membresia_nivel check (
    (rol in ('contador', 'lector') and empresa_id is null)
    or (rol in ('asistente', 'cliente') and empresa_id is not null)
  )
);
create unique index membresias_unica on public.membresias
  (usuario_id, estudio_id, coalesce(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index membresias_estudio on public.membresias (estudio_id);

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  rut text not null check (app.rut_valido(rut)),
  razon_social text not null,
  nombre_fantasia text,
  giro text,
  actividades_economicas text[] not null default '{}',
  direccion text,
  comuna text,
  representante_legal text,
  rut_representante text check (rut_representante is null or app.rut_valido(rut_representante)),
  -- Régimen tributario: códigos configurables (ver src/lib/empresas.ts).
  regimen text not null default 'propyme_general',
  inicio_actividades date,
  -- Tasa de PPM en porcentaje (por ejemplo 0.25 = 0,25%).
  tasa_ppm numeric(7, 4),
  emite_factura_electronica boolean not null default true,
  -- Ley 16.744: organismo administrador (mutual o ISL) y tasa adicional en porcentaje.
  organismo_16744 text,
  tasa_cotizacion_adicional numeric(7, 4),
  caja_compensacion text,
  contacto_nombre text,
  contacto_correo text,
  contacto_whatsapp text,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (estudio_id, rut),
  unique (id, estudio_id)
);

alter table public.membresias
  add constraint membresias_empresa_fk foreign key (empresa_id, estudio_id)
  references public.empresas (id, estudio_id) on delete cascade;

create table public.periodos (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  anio int not null check (anio between 2000 and 2100),
  mes int not null check (mes between 1 and 12),
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  cerrado_at timestamptz,
  cerrado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  unique (empresa_id, anio, mes)
);

create table public.consentimientos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  tipo text not null, -- 'terminos', 'privacidad', 'whatsapp', ...
  version text not null,
  aceptado boolean not null default true,
  ip text,
  created_at timestamptz not null default now()
);

-- Registro de quién hizo qué, cuándo y desde dónde. Solo se inserta desde triggers.
create table public.auditoria (
  id bigint generated always as identity primary key,
  estudio_id uuid,
  empresa_id uuid,
  usuario_id uuid,
  accion text not null,
  tabla text,
  registro_id text,
  detalle jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index auditoria_estudio_fecha on public.auditoria (estudio_id, created_at desc);

-- Acceso de soporte del superadministrador: solo con autorización registrada y con plazo.
create table public.accesos_soporte (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  superadmin_id uuid not null references public.usuarios(id),
  motivo text not null,
  autorizado_por uuid not null references public.usuarios(id),
  vigente_hasta timestamptz not null,
  created_at timestamptz not null default now()
);

-- Intentos de inicio de sesión (para limitar intentos por RUT). Solo el servidor lo usa.
create table public.intentos_login (
  id bigint generated always as identity primary key,
  rut text not null,
  ip text,
  exito boolean not null,
  created_at timestamptz not null default now()
);
create index intentos_login_rut_fecha on public.intentos_login (rut, created_at desc);

-- updated_at automático
do $$
declare t text;
begin
  foreach t in array array['estudios', 'usuarios', 'membresias', 'empresas', 'periodos'] loop
    execute format('create trigger tocar_updated_at before update on public.%I
                    for each row execute function app.tocar_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Funciones de permisos (security definer para no recurrir en RLS)
-- ---------------------------------------------------------------------

-- ¿El usuario actual cumplió el segundo factor cuando se le exige?
create or replace function app.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select not u.requiere_2fa from public.usuarios u where u.id = auth.uid()), false)
    or coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- ¿Es contador (administrador) del estudio?
create or replace function app.es_contador(p_estudio uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.mfa_ok() and exists (
    select 1 from public.membresias m
    where m.usuario_id = auth.uid() and m.estudio_id = p_estudio
      and m.empresa_id is null and m.rol = 'contador' and m.activa);
$$;

-- ¿Pertenece al estudio con cualquier rol? (para ver el nombre del estudio)
create or replace function app.es_miembro(p_estudio uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membresias m
    where m.usuario_id = auth.uid() and m.estudio_id = p_estudio and m.activa);
$$;

-- ¿Puede VER la empresa? Si se indica módulo, el asistente necesita ese permiso.
-- El cliente ve solo lo que el portal le muestre (se restringe por módulo en cada tabla).
create or replace function app.puede_ver(p_empresa uuid, p_modulo text default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.mfa_ok() and exists (
    select 1
    from public.empresas e
    join public.membresias m on m.estudio_id = e.estudio_id and m.activa
    where e.id = p_empresa and m.usuario_id = auth.uid()
      and (
        (m.empresa_id is null and m.rol in ('contador', 'lector'))
        or (m.empresa_id = e.id and m.rol = 'asistente'
            and (p_modulo is null or coalesce((m.permisos ->> p_modulo)::boolean, false)))
        or (m.empresa_id = e.id and m.rol = 'cliente' and p_modulo is null)
      ));
$$;

-- ¿Puede MODIFICAR datos de la empresa en el módulo indicado?
create or replace function app.puede_editar(p_empresa uuid, p_modulo text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.mfa_ok() and exists (
    select 1
    from public.empresas e
    join public.membresias m on m.estudio_id = e.estudio_id and m.activa
    where e.id = p_empresa and m.usuario_id = auth.uid()
      and (
        (m.empresa_id is null and m.rol = 'contador')
        or (m.empresa_id = e.id and m.rol = 'asistente'
            and coalesce((m.permisos ->> p_modulo)::boolean, false))
      ));
$$;

create or replace function app.es_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select es_superadmin from public.usuarios where id = auth.uid()), false);
$$;

grant execute on all functions in schema app to authenticated, service_role;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.estudios enable row level security;
alter table public.usuarios enable row level security;
alter table public.membresias enable row level security;
alter table public.empresas enable row level security;
alter table public.periodos enable row level security;
alter table public.consentimientos enable row level security;
alter table public.auditoria enable row level security;
alter table public.accesos_soporte enable row level security;
alter table public.intentos_login enable row level security; -- sin políticas: solo service_role

-- Estudios: lo ven sus miembros; lo edita el contador.
create policy estudios_ver on public.estudios for select to authenticated
  using (app.es_miembro(id) or app.es_superadmin());
create policy estudios_editar on public.estudios for update to authenticated
  using (app.es_contador(id)) with check (app.es_contador(id));

-- Usuarios: cada uno ve su perfil; el contador ve a los usuarios de su estudio.
create policy usuarios_ver on public.usuarios for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.membresias m
      where m.usuario_id = usuarios.id and app.es_contador(m.estudio_id))
  );
create policy usuarios_editar_propio on public.usuarios for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Solo el nombre se puede cambiar desde la app; RUT, 2FA y superadmin, no.
revoke update on public.usuarios from authenticated;
grant update (nombre) on public.usuarios to authenticated;

-- Membresías: cada uno ve las suyas; el contador administra las de su estudio.
create policy membresias_ver on public.membresias for select to authenticated
  using (usuario_id = auth.uid() or app.es_contador(estudio_id));
create policy membresias_crear on public.membresias for insert to authenticated
  with check (app.es_contador(estudio_id) and usuario_id <> auth.uid());
create policy membresias_editar on public.membresias for update to authenticated
  using (app.es_contador(estudio_id) and usuario_id <> auth.uid())
  with check (app.es_contador(estudio_id) and usuario_id <> auth.uid());

-- Empresas: se ven según membresía; las crea y edita el contador. No se borran (se desactivan).
create policy empresas_ver on public.empresas for select to authenticated
  using (app.puede_ver(id));
create policy empresas_crear on public.empresas for insert to authenticated
  with check (app.es_contador(estudio_id));
create policy empresas_editar on public.empresas for update to authenticated
  using (app.es_contador(estudio_id)) with check (app.es_contador(estudio_id));

-- Periodos: se ven con la empresa; los crea quien puede editar contabilidad.
-- Cerrar y reabrir se hace con funciones (Fase 2), no con update directo.
create policy periodos_ver on public.periodos for select to authenticated
  using (app.puede_ver(empresa_id));
create policy periodos_crear on public.periodos for insert to authenticated
  with check (app.puede_editar(empresa_id, 'contabilidad') and estado = 'abierto');

-- Consentimientos: cada usuario los suyos.
create policy consentimientos_ver on public.consentimientos for select to authenticated
  using (usuario_id = auth.uid());
create policy consentimientos_crear on public.consentimientos for insert to authenticated
  with check (usuario_id = auth.uid());

-- Auditoría: la ve el contador del estudio. Nadie la modifica.
create policy auditoria_ver on public.auditoria for select to authenticated
  using (app.es_contador(estudio_id));

-- Accesos de soporte: los ve el contador del estudio y el superadmin involucrado.
create policy accesos_soporte_ver on public.accesos_soporte for select to authenticated
  using (app.es_contador(estudio_id) or superadmin_id = auth.uid());
create policy accesos_soporte_crear on public.accesos_soporte for insert to authenticated
  with check (app.es_contador(estudio_id) and autorizado_por = auth.uid());

-- Nadie (salvo service_role) borra filas desde la app.
revoke delete on all tables in schema public from authenticated, anon;
revoke all on public.intentos_login from authenticated, anon;
revoke insert, update on public.auditoria from authenticated, anon;

-- ---------------------------------------------------------------------
-- Auditoría automática
-- ---------------------------------------------------------------------

-- IP y navegador: el servidor de la app los envía como encabezados x-rh-ip y x-rh-ua.
create or replace function app.encabezado(nombre text) returns text
language sql stable as $$
  select nullif(current_setting('request.headers', true), '')::json ->> nombre;
$$;

create or replace function app.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  fila jsonb;
  anterior jsonb;
  cambios jsonb;
begin
  fila := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  anterior := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  -- En una modificación, guardar solo los campos que cambiaron.
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('antes', anterior -> k, 'despues', fila -> k))
      into cambios
      from jsonb_object_keys(fila) k
      where k not in ('updated_at') and (anterior -> k) is distinct from (fila -> k);
    if cambios is null then
      return new;
    end if;
  else
    cambios := fila;
  end if;

  insert into public.auditoria (estudio_id, empresa_id, usuario_id, accion, tabla, registro_id, detalle, ip, user_agent)
  values (
    case when tg_table_name = 'estudios' then (fila ->> 'id')::uuid else (fila ->> 'estudio_id')::uuid end,
    case when tg_table_name = 'empresas' then (fila ->> 'id')::uuid else (fila ->> 'empresa_id')::uuid end,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    fila ->> 'id',
    cambios,
    app.encabezado('x-rh-ip'),
    app.encabezado('x-rh-ua')
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['estudios', 'membresias', 'empresas', 'periodos', 'accesos_soporte'] loop
    execute format('create trigger auditar after insert or update or delete on public.%I
                    for each row execute function app.auditar()', t);
  end loop;
end $$;

-- Registro explícito de eventos que no son cambios de tablas (inicio de sesión, exportaciones, etc.).
create or replace function public.registrar_evento(
  p_accion text, p_estudio uuid default null, p_empresa uuid default null, p_detalle jsonb default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  if p_estudio is not null and not app.es_miembro(p_estudio) then
    raise exception 'Sin acceso al estudio';
  end if;
  insert into public.auditoria (estudio_id, empresa_id, usuario_id, accion, detalle, ip, user_agent)
  values (p_estudio, p_empresa, auth.uid(), p_accion, p_detalle,
          app.encabezado('x-rh-ip'), app.encabezado('x-rh-ua'));
end $$;
grant execute on function public.registrar_evento to authenticated;
