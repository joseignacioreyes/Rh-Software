-- =====================================================================
-- Fase 3: libros (RCV y honorarios), importaciones, cartolas y conciliación,
-- configuración de centralizaciones y archivos generados.
-- =====================================================================

-- Documentos del Registro de Compras y Ventas (y libros de otros softwares).
create table public.documentos_rcv (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  libro text not null check (libro in ('compras', 'ventas')),
  anio int not null,
  mes int not null check (mes between 1 and 12),
  -- Código SII del documento: 33 factura, 34 exenta, 39 boleta, 46 factura de compra, 56 nota de débito, 61 nota de crédito...
  tipo_doc int not null,
  -- Tipo de compra o venta del SII (Del Giro, Supermercado, Activo Fijo...).
  tipo_operacion text,
  folio text not null,
  rut_contraparte text not null,
  razon_social text,
  fecha_docto date not null,
  fecha_recepcion date,
  monto_exento bigint not null default 0,
  monto_neto bigint not null default 0,
  monto_iva bigint not null default 0,              -- en compras: IVA recuperable
  monto_iva_no_recuperable bigint not null default 0,
  codigo_iva_no_recuperable text,
  iva_uso_comun bigint not null default 0,
  monto_neto_activo_fijo bigint not null default 0,
  iva_activo_fijo bigint not null default 0,
  otros_impuestos bigint not null default 0,
  monto_total bigint not null default 0,
  -- Solo para resúmenes de boletas: cantidad de documentos que resume.
  cantidad_documentos int,
  origen text not null default 'rcv_sii' check (origen in ('rcv_sii', 'excel', 'manual', 'resumen_boletas')),
  importacion_id uuid,
  datos_originales jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  -- Sin duplicados por tipo de documento, folio y RUT de la contraparte.
  unique (empresa_id, libro, tipo_doc, folio, rut_contraparte)
);
create index documentos_rcv_periodo on public.documentos_rcv (empresa_id, libro, anio, mes);

-- Boletas de honorarios recibidas y emitidas.
create table public.honorarios (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  tipo text not null check (tipo in ('recibidas', 'emitidas')),
  anio int not null,
  mes int not null check (mes between 1 and 12),
  folio text not null,
  fecha date not null,
  rut_contraparte text not null,
  nombre text,
  monto_bruto bigint not null,
  monto_retencion bigint not null default 0,
  monto_liquido bigint not null,
  estado text not null default 'vigente' check (estado in ('vigente', 'anulada')),
  -- Retención de terceros (cuando la empresa retiene) o pagada por el emisor.
  retencion_por text check (retencion_por in ('receptor', 'emisor')),
  importacion_id uuid,
  datos_originales jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  unique (empresa_id, tipo, folio, rut_contraparte)
);
create index honorarios_periodo on public.honorarios (empresa_id, tipo, anio, mes);

-- Registro de cada archivo importado.
create table public.importaciones (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  tipo text not null, -- rcv_compras, rcv_ventas, honorarios_recibidos, honorarios_emitidos, cartola, excel_libro
  anio int,
  mes int,
  nombre_archivo text not null,
  hash_archivo text,
  mapeo jsonb,
  filas_leidas int not null default 0,
  filas_nuevas int not null default 0,
  filas_duplicadas int not null default 0,
  filas_con_error int not null default 0,
  errores jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade
);

-- Mapeos de columnas guardados para reutilizar ("esta columna es el folio...").
create table public.mapeos_importacion (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  nombre text not null,
  tipo text not null, -- libro_compras, libro_ventas, cartola
  -- Firma de los encabezados del archivo para reconocerlo la próxima vez.
  firma_encabezados text not null,
  mapeo jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  unique (estudio_id, tipo, firma_encabezados)
);

-- Cuentas bancarias y cartolas.
create table public.cuentas_bancarias (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  banco text not null,
  numero text not null,
  cuenta_contable_id uuid,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  foreign key (cuenta_contable_id, empresa_id) references public.plan_cuentas (id, empresa_id),
  unique (empresa_id, banco, numero),
  unique (id, empresa_id)
);

create table public.cartolas (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  cuenta_bancaria_id uuid not null,
  anio int not null,
  mes int not null,
  saldo_inicial bigint,
  saldo_final bigint,
  importacion_id uuid references public.importaciones(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  foreign key (cuenta_bancaria_id, empresa_id) references public.cuentas_bancarias (id, empresa_id) on delete cascade
);

create table public.movimientos_bancarios (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  cartola_id uuid not null references public.cartolas(id) on delete cascade,
  cuenta_bancaria_id uuid not null,
  fecha date not null,
  descripcion text not null,
  documento text,
  -- Positivo = abono (entra plata); negativo = cargo (sale plata).
  monto bigint not null check (monto <> 0),
  saldo bigint,
  huella text not null, -- para evitar duplicados al reimportar
  created_at timestamptz not null default now(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  unique (cuenta_bancaria_id, huella)
);
create index movimientos_bancarios_fecha on public.movimientos_bancarios (empresa_id, fecha);

-- Pareo de un movimiento bancario con una línea contable de la cuenta banco.
create table public.conciliaciones (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  movimiento_id uuid not null unique references public.movimientos_bancarios(id) on delete cascade,
  linea_id uuid unique references public.lineas_comprobante(id) on delete cascade,
  -- Si no hay línea contable: se marca como diferencia con una nota.
  tipo text not null default 'pareo' check (tipo in ('pareo', 'diferencia')),
  nota text,
  automatica boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  check (tipo = 'diferencia' or linea_id is not null)
);

-- Cuentas de destino de las centralizaciones, una vez por empresa.
create table public.config_centralizacion (
  empresa_id uuid primary key,
  estudio_id uuid not null,
  -- {"compras_neto": uuid, "iva_credito": uuid, "proveedores": uuid, "ventas_neto": uuid, ...}
  cuentas jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade
);

-- Archivos generados (libros, F29, Previred, LRE), con hash y versión de datos y parámetros.
create table public.archivos_generados (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  tipo text not null,
  anio int,
  mes int,
  nombre_archivo text not null,
  hash_contenido text not null,
  tamano int,
  parametros jsonb,
  resumen jsonb,
  ruta_storage text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade
);
create index archivos_generados_periodo on public.archivos_generados (empresa_id, tipo, anio, mes);

-- updated_at y auditoría
do $$
declare t text;
begin
  foreach t in array array['documentos_rcv', 'honorarios', 'mapeos_importacion', 'cuentas_bancarias'] loop
    execute format('create trigger tocar_updated_at before update on public.%I for each row execute function app.tocar_updated_at()', t);
  end loop;
  foreach t in array array['importaciones', 'cuentas_bancarias', 'conciliaciones', 'config_centralizacion', 'archivos_generados'] loop
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function app.auditar()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- RLS: libros con el módulo "libros"; bancos y centralización con "contabilidad".
-- ---------------------------------------------------------------------
alter table public.documentos_rcv enable row level security;
alter table public.honorarios enable row level security;
alter table public.importaciones enable row level security;
alter table public.mapeos_importacion enable row level security;
alter table public.cuentas_bancarias enable row level security;
alter table public.cartolas enable row level security;
alter table public.movimientos_bancarios enable row level security;
alter table public.conciliaciones enable row level security;
alter table public.config_centralizacion enable row level security;
alter table public.archivos_generados enable row level security;

create or replace function app.estudio_de(p_empresa uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select estudio_id from public.empresas where id = p_empresa;
$$;
grant execute on function app.estudio_de to authenticated;

do $$
declare
  t text;
  modulo text;
begin
  for t, modulo in select * from (values
    ('documentos_rcv', 'libros'), ('honorarios', 'libros'), ('importaciones', 'libros'),
    ('cuentas_bancarias', 'contabilidad'), ('cartolas', 'contabilidad'), ('movimientos_bancarios', 'contabilidad'),
    ('conciliaciones', 'contabilidad'), ('config_centralizacion', 'contabilidad')
  ) as x(t, m) loop
    execute format('create policy %1$s_ver on public.%1$I for select to authenticated using (app.puede_ver(empresa_id, %2$L))', t, modulo);
    execute format('create policy %1$s_crear on public.%1$I for insert to authenticated with check (app.puede_editar(empresa_id, %2$L) and estudio_id = app.estudio_de(empresa_id))', t, modulo);
    execute format('create policy %1$s_editar on public.%1$I for update to authenticated using (app.puede_editar(empresa_id, %2$L)) with check (app.puede_editar(empresa_id, %2$L))', t, modulo);
  end loop;
end $$;

-- Se pueden borrar documentos importados por error y conciliaciones (deshacer un pareo),
-- solo con permiso de edición; queda en auditoría.
create policy documentos_rcv_borrar on public.documentos_rcv for delete to authenticated using (app.puede_editar(empresa_id, 'libros'));
create policy honorarios_borrar on public.honorarios for delete to authenticated using (app.puede_editar(empresa_id, 'libros'));
create policy conciliaciones_borrar on public.conciliaciones for delete to authenticated using (app.puede_editar(empresa_id, 'contabilidad'));
grant delete on public.documentos_rcv, public.honorarios, public.conciliaciones to authenticated;
create trigger auditar after delete on public.documentos_rcv for each row execute function app.auditar();
create trigger auditar_h after delete on public.honorarios for each row execute function app.auditar();

-- Mapeos: por estudio, los usan todos sus miembros.
create policy mapeos_ver on public.mapeos_importacion for select to authenticated using (app.es_miembro(estudio_id));
create policy mapeos_crear on public.mapeos_importacion for insert to authenticated with check (app.es_miembro(estudio_id));
create policy mapeos_editar on public.mapeos_importacion for update to authenticated using (app.es_miembro(estudio_id));

-- Archivos generados: se ven con la empresa; se crean con cualquier permiso de edición.
create policy archivos_ver on public.archivos_generados for select to authenticated using (app.puede_ver(empresa_id));
create policy archivos_crear on public.archivos_generados for insert to authenticated
  with check (estudio_id = app.estudio_de(empresa_id) and (
    app.puede_editar(empresa_id, 'libros') or app.puede_editar(empresa_id, 'contabilidad')
    or app.puede_editar(empresa_id, 'impuestos') or app.puede_editar(empresa_id, 'remuneraciones')));
revoke update, delete on public.archivos_generados from authenticated;

-- Las centralizaciones crean comprobantes con origen distinto de "manual".
-- Permitir que guardar_comprobante reciba el origen y el periodo de la centralización.
create or replace function public.centralizar(
  p_empresa uuid, p_origen text, p_fecha date, p_glosa text, p_lineas jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_previo uuid;
begin
  if not app.puede_editar(p_empresa, 'contabilidad') then
    raise exception 'No tienes permiso para centralizar en esta empresa.' using errcode = '42501';
  end if;
  if p_origen not like 'centralizacion_%' then
    raise exception 'Origen de centralización no válido.';
  end if;
  -- Si ya existía la centralización del mes, se anula la anterior (queda el historial).
  select id into v_previo from public.comprobantes
   where empresa_id = p_empresa and origen = p_origen and estado = 'vigente'
     and anio = extract(year from p_fecha)::int and mes = extract(month from p_fecha)::int
   limit 1;
  if v_previo is not null then
    update public.comprobantes set estado = 'anulado', motivo_anulacion = 'Reemplazado por una nueva centralización', updated_by = auth.uid()
     where id = v_previo;
  end if;
  v_id := public.guardar_comprobante(p_empresa, null, 'traspaso', p_fecha, p_glosa, p_lineas);
  update public.comprobantes set origen = p_origen where id = v_id;
  return v_id;
end $$;
grant execute on function public.centralizar to authenticated;

-- Almacenamiento de adjuntos y archivos generados (privado). Ruta: <estudio>/<empresa>/...
insert into storage.buckets (id, name, public) values ('archivos', 'archivos', false) on conflict do nothing;

create policy archivos_storage_ver on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and app.puede_ver(((storage.foldername(name))[2])::uuid));
create policy archivos_storage_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and app.es_miembro(((storage.foldername(name))[1])::uuid)
              and app.puede_ver(((storage.foldername(name))[2])::uuid));
