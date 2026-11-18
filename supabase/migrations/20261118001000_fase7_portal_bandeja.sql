-- =====================================================================
-- Fase 7: portal del cliente, bandeja de documentos (con lectura por IA) y solicitudes.
-- =====================================================================

-- ¿El usuario es cliente (portal) de la empresa?
create or replace function app.es_cliente(p_empresa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membresias m
    where m.usuario_id = auth.uid() and m.empresa_id = p_empresa and m.rol = 'cliente' and m.activa);
$$;
grant execute on function app.es_cliente to authenticated;

create table public.documentos_bandeja (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  origen text not null check (origen in ('portal', 'whatsapp', 'correo', 'contador')),
  nombre_archivo text not null,
  ruta_storage text not null,
  tipo_mime text,
  tamano int,
  comentario text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'registrado', 'descartado')),
  -- Datos leídos (por IA o ingresados a mano) y siempre confirmados por una persona.
  datos jsonb,
  leido_con text check (leido_con in ('ia', 'manual', 'ejemplo')),
  duplicado_de uuid references public.documentos_rcv(id) on delete set null,
  documento_rcv_id uuid references public.documentos_rcv(id) on delete set null,
  procesado_por uuid references auth.users(id),
  procesado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade
);
create index documentos_bandeja_empresa on public.documentos_bandeja (empresa_id, estado);

create table public.solicitudes_cliente (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  titulo text not null,
  detalle text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'respondida', 'cerrada')),
  respuesta text,
  respondida_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade
);

-- Registro de mensajes de WhatsApp (para la API de Meta, cuando se active; hoy solo links wa.me).
create table public.mensajes_whatsapp (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  telefono text not null,
  direccion text not null check (direccion in ('enviado', 'recibido')),
  plantilla text,
  texto text,
  estado text,
  created_at timestamptz not null default now(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade
);

do $$
declare t text;
begin
  foreach t in array array['documentos_bandeja', 'solicitudes_cliente'] loop
    execute format('create trigger tocar_updated_at before update on public.%I for each row execute function app.tocar_updated_at()', t);
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function app.auditar()', t);
  end loop;
end $$;

alter table public.documentos_bandeja enable row level security;
alter table public.solicitudes_cliente enable row level security;
alter table public.mensajes_whatsapp enable row level security;

-- Bandeja: el estudio (módulo documentos) la trabaja; el cliente sube y ve sus envíos.
create policy bandeja_ver on public.documentos_bandeja for select to authenticated
  using (app.puede_ver(empresa_id, 'documentos') or (app.es_cliente(empresa_id) and created_by = auth.uid()));
create policy bandeja_crear on public.documentos_bandeja for insert to authenticated
  with check (estudio_id = app.estudio_de(empresa_id) and (
    app.puede_editar(empresa_id, 'documentos') or (app.es_cliente(empresa_id) and origen = 'portal' and estado = 'pendiente')));
create policy bandeja_editar on public.documentos_bandeja for update to authenticated
  using (app.puede_editar(empresa_id, 'documentos')) with check (app.puede_editar(empresa_id, 'documentos'));

-- Solicitudes: las crea el estudio; el cliente las ve y las responde.
create policy solicitudes_ver on public.solicitudes_cliente for select to authenticated
  using (app.puede_ver(empresa_id, 'documentos') or app.es_cliente(empresa_id));
create policy solicitudes_crear on public.solicitudes_cliente for insert to authenticated
  with check (app.puede_editar(empresa_id, 'documentos') and estudio_id = app.estudio_de(empresa_id));
create policy solicitudes_editar on public.solicitudes_cliente for update to authenticated
  using (app.puede_editar(empresa_id, 'documentos') or app.es_cliente(empresa_id))
  with check (app.puede_editar(empresa_id, 'documentos') or app.es_cliente(empresa_id));

create policy whatsapp_ver on public.mensajes_whatsapp for select to authenticated using (app.puede_ver(empresa_id, 'documentos'));
create policy whatsapp_crear on public.mensajes_whatsapp for insert to authenticated with check (app.puede_editar(empresa_id, 'documentos'));

-- Portal: el cliente ve su F29, sus libros y las liquidaciones aprobadas de su empresa.
create policy documentos_rcv_cliente_ver on public.documentos_rcv for select to authenticated using (app.es_cliente(empresa_id));
create policy honorarios_cliente_ver on public.honorarios for select to authenticated using (app.es_cliente(empresa_id));
create policy liquidaciones_cliente_ver on public.liquidaciones for select to authenticated using (app.es_cliente(empresa_id) and estado = 'aprobada');
create policy items_cliente_ver on public.items_liquidacion for select to authenticated
  using (app.es_cliente(empresa_id) and exists (select 1 from public.liquidaciones l where l.id = liquidacion_id and l.estado = 'aprobada'));
create policy trabajadores_cliente_ver on public.trabajadores for select to authenticated using (app.es_cliente(empresa_id));
