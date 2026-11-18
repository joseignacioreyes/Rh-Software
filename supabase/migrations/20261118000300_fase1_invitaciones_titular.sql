-- Invitaciones con clave temporal y solicitudes del titular de datos (Ley 21.719).

-- Un usuario invitado recibe una clave temporal y debe cambiarla al primer ingreso.
alter table public.usuarios add column debe_cambiar_clave boolean not null default false;

-- Solicitudes del titular (acceso, rectificación, supresión, portabilidad...).
create table public.solicitudes_titular (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('acceso', 'rectificacion', 'supresion', 'oposicion', 'portabilidad')),
  detalle text,
  estado text not null default 'recibida' check (estado in ('recibida', 'en_revision', 'respondida', 'rechazada')),
  respuesta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tocar_updated_at before update on public.solicitudes_titular
  for each row execute function app.tocar_updated_at();

alter table public.solicitudes_titular enable row level security;
create policy solicitudes_titular_ver on public.solicitudes_titular for select to authenticated
  using (usuario_id = auth.uid() or app.es_superadmin());
create policy solicitudes_titular_crear on public.solicitudes_titular for insert to authenticated
  with check (usuario_id = auth.uid() and estado = 'recibida');
revoke update, delete on public.solicitudes_titular from authenticated, anon;
