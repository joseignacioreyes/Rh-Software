-- =====================================================================
-- Fase 2: contabilidad base.
-- Plan de cuentas, centros de costo, comprobantes y sus líneas, cierre de periodo.
-- Montos en pesos como enteros (bigint), nunca decimales.
-- Los comprobantes se escriben solo mediante funciones que validan "debe = haber"
-- y que el periodo esté abierto; no se borran: se anulan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Plan de cuentas
-- ---------------------------------------------------------------------

-- Clasificación para el balance de 8 columnas:
--  activo, pasivo y patrimonio van al balance (inventario);
--  perdida y ganancia van al estado de resultados.
create type public.tipo_cuenta as enum ('activo', 'pasivo', 'patrimonio', 'perdida', 'ganancia');

-- Plantilla base para pymes chilenas (global, de solo lectura para todos).
create table public.plan_cuentas_plantilla (
  codigo text primary key,
  nombre text not null,
  tipo public.tipo_cuenta not null,
  imputable boolean not null
);

create table public.plan_cuentas (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  -- Código jerárquico con puntos: 1, 1.1, 1.1.01, 1.1.01.001
  codigo text not null check (codigo ~ '^[0-9]+(\.[0-9]+)*$'),
  nombre text not null check (length(trim(nombre)) > 0),
  tipo public.tipo_cuenta not null,
  -- Solo las cuentas imputables reciben movimientos; las demás agrupan.
  imputable boolean not null default true,
  activa boolean not null default true,
  nivel int generated always as (array_length(string_to_array(codigo, '.'), 1)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  unique (empresa_id, codigo),
  unique (id, empresa_id)
);

create table public.centros_costo (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  codigo text not null,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  unique (empresa_id, codigo),
  unique (id, empresa_id)
);

-- ---------------------------------------------------------------------
-- Comprobantes
-- ---------------------------------------------------------------------

create table public.comprobantes (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  -- Correlativo por empresa y año.
  numero int not null,
  tipo text not null check (tipo in ('ingreso', 'egreso', 'traspaso', 'apertura')),
  fecha date not null,
  anio int generated always as (extract(year from fecha)::int) stored,
  mes int generated always as (extract(month from fecha)::int) stored,
  glosa text not null check (length(trim(glosa)) > 0),
  estado text not null default 'vigente' check (estado in ('vigente', 'anulado')),
  motivo_anulacion text,
  -- Origen: manual o centralización automática (Fase 3).
  origen text not null default 'manual',
  total_debe bigint not null default 0,
  total_haber bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id),
  foreign key (empresa_id, estudio_id) references public.empresas (id, estudio_id) on delete cascade,
  unique (empresa_id, anio, numero),
  constraint comprobante_cuadra check (total_debe = total_haber)
);
create index comprobantes_empresa_fecha on public.comprobantes (empresa_id, fecha);

create table public.lineas_comprobante (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  comprobante_id uuid not null references public.comprobantes(id) on delete cascade,
  orden int not null,
  cuenta_id uuid not null,
  glosa text,
  debe bigint not null default 0 check (debe >= 0),
  haber bigint not null default 0 check (haber >= 0),
  centro_costo_id uuid,
  created_at timestamptz not null default now(),
  foreign key (cuenta_id, empresa_id) references public.plan_cuentas (id, empresa_id),
  foreign key (centro_costo_id, empresa_id) references public.centros_costo (id, empresa_id),
  -- Cada línea va al debe o al haber, no a ambos ni en cero.
  constraint linea_un_lado check ((debe > 0 and haber = 0) or (haber > 0 and debe = 0))
);
create index lineas_empresa_cuenta on public.lineas_comprobante (empresa_id, cuenta_id);
create index lineas_comprobante_id on public.lineas_comprobante (comprobante_id);

-- Historial de cierres y reaperturas de periodos (con motivo).
create table public.periodo_eventos (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null,
  empresa_id uuid not null,
  periodo_id uuid not null references public.periodos(id) on delete cascade,
  accion text not null check (accion in ('cerrar', 'reabrir')),
  motivo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

do $$
declare t text;
begin
  foreach t in array array['plan_cuentas', 'centros_costo', 'comprobantes'] loop
    execute format('create trigger tocar_updated_at before update on public.%I
                    for each row execute function app.tocar_updated_at()', t);
  end loop;
  foreach t in array array['plan_cuentas', 'centros_costo', 'comprobantes', 'periodo_eventos'] loop
    execute format('create trigger auditar after insert or update or delete on public.%I
                    for each row execute function app.auditar()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Periodo cerrado: bloqueo a nivel de base de datos
-- ---------------------------------------------------------------------

create or replace function app.periodo_cerrado(p_empresa uuid, p_fecha date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.periodos p
    where p.empresa_id = p_empresa
      and p.anio = extract(year from p_fecha)::int
      and p.mes = extract(month from p_fecha)::int
      and p.estado = 'cerrado');
$$;

create or replace function app.bloquear_periodo_cerrado() returns trigger
language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and app.periodo_cerrado(old.empresa_id, old.fecha) then
    raise exception 'El periodo %-% está cerrado. Para modificarlo, reábrelo indicando un motivo.',
      lpad(extract(month from old.fecha)::text, 2, '0'), extract(year from old.fecha)
      using errcode = 'P0001';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and app.periodo_cerrado(new.empresa_id, new.fecha) then
    raise exception 'El periodo %-% está cerrado. Para modificarlo, reábrelo indicando un motivo.',
      lpad(extract(month from new.fecha)::text, 2, '0'), extract(year from new.fecha)
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger bloquear_periodo_cerrado before insert or update or delete on public.comprobantes
  for each row execute function app.bloquear_periodo_cerrado();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.plan_cuentas_plantilla enable row level security;
alter table public.plan_cuentas enable row level security;
alter table public.centros_costo enable row level security;
alter table public.comprobantes enable row level security;
alter table public.lineas_comprobante enable row level security;
alter table public.periodo_eventos enable row level security;

create policy plantilla_ver on public.plan_cuentas_plantilla for select to authenticated using (true);

create policy plan_ver on public.plan_cuentas for select to authenticated
  using (app.puede_ver(empresa_id, 'contabilidad'));
create policy plan_crear on public.plan_cuentas for insert to authenticated
  with check (app.puede_editar(empresa_id, 'contabilidad')
              and estudio_id = (select e.estudio_id from public.empresas e where e.id = empresa_id));
create policy plan_editar on public.plan_cuentas for update to authenticated
  using (app.puede_editar(empresa_id, 'contabilidad'))
  with check (app.puede_editar(empresa_id, 'contabilidad'));

create policy cc_ver on public.centros_costo for select to authenticated
  using (app.puede_ver(empresa_id, 'contabilidad'));
create policy cc_crear on public.centros_costo for insert to authenticated
  with check (app.puede_editar(empresa_id, 'contabilidad')
              and estudio_id = (select e.estudio_id from public.empresas e where e.id = empresa_id));
create policy cc_editar on public.centros_costo for update to authenticated
  using (app.puede_editar(empresa_id, 'contabilidad'))
  with check (app.puede_editar(empresa_id, 'contabilidad'));

-- Comprobantes y líneas: solo lectura directa; se escriben con las funciones de abajo.
create policy comprobantes_ver on public.comprobantes for select to authenticated
  using (app.puede_ver(empresa_id, 'contabilidad'));
create policy lineas_ver on public.lineas_comprobante for select to authenticated
  using (app.puede_ver(empresa_id, 'contabilidad'));
create policy periodo_eventos_ver on public.periodo_eventos for select to authenticated
  using (app.puede_ver(empresa_id, 'contabilidad'));

revoke insert, update, delete on public.comprobantes, public.lineas_comprobante, public.periodo_eventos
  from authenticated, anon;
revoke insert, update, delete on public.plan_cuentas_plantilla from authenticated, anon;
revoke delete on public.plan_cuentas, public.centros_costo from authenticated, anon;

-- ---------------------------------------------------------------------
-- Funciones de escritura
-- ---------------------------------------------------------------------

-- Crea o modifica un comprobante completo en una sola transacción.
-- p_lineas: [{"cuenta_id": uuid, "glosa": text, "debe": int, "haber": int, "centro_costo_id": uuid|null}, ...]
create or replace function public.guardar_comprobante(
  p_empresa uuid,
  p_id uuid,
  p_tipo text,
  p_fecha date,
  p_glosa text,
  p_lineas jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_estudio uuid;
  v_id uuid := p_id;
  v_numero int;
  v_debe bigint;
  v_haber bigint;
  v_cantidad int;
  v_malas int;
  v_actual public.comprobantes;
begin
  if not app.puede_editar(p_empresa, 'contabilidad') then
    raise exception 'No tienes permiso para registrar comprobantes en esta empresa.' using errcode = '42501';
  end if;
  select estudio_id into v_estudio from public.empresas where id = p_empresa;

  if jsonb_typeof(p_lineas) <> 'array' then
    raise exception 'Las líneas deben venir como lista.';
  end if;

  -- Validar las líneas.
  select count(*),
         coalesce(sum((l ->> 'debe')::bigint), 0),
         coalesce(sum((l ->> 'haber')::bigint), 0)
    into v_cantidad, v_debe, v_haber
    from jsonb_array_elements(p_lineas) l;

  if v_cantidad < 2 then
    raise exception 'El comprobante necesita al menos dos líneas.';
  end if;
  if v_debe <> v_haber then
    raise exception 'El comprobante no cuadra: debe % y haber % (diferencia %).', v_debe, v_haber, v_debe - v_haber;
  end if;
  if v_debe = 0 then
    raise exception 'El comprobante no tiene montos.';
  end if;

  select count(*) into v_malas
    from jsonb_array_elements(p_lineas) l
    left join public.plan_cuentas c
      on c.id = (l ->> 'cuenta_id')::uuid and c.empresa_id = p_empresa
    where c.id is null or not c.imputable or not c.activa;
  if v_malas > 0 then
    raise exception 'Hay % línea(s) con una cuenta inexistente, no imputable o inactiva.', v_malas;
  end if;

  if p_tipo not in ('ingreso', 'egreso', 'traspaso', 'apertura') then
    raise exception 'Tipo de comprobante no válido: %', p_tipo;
  end if;

  if v_id is null then
    -- Número correlativo por empresa y año, sin choques entre usuarios simultáneos.
    perform pg_advisory_xact_lock(hashtext(p_empresa::text || extract(year from p_fecha)::text));
    select coalesce(max(numero), 0) + 1 into v_numero
      from public.comprobantes
      where empresa_id = p_empresa and anio = extract(year from p_fecha)::int;

    insert into public.comprobantes
      (estudio_id, empresa_id, numero, tipo, fecha, glosa, total_debe, total_haber, created_by)
    values (v_estudio, p_empresa, v_numero, p_tipo, p_fecha, trim(p_glosa), v_debe, v_haber, auth.uid())
    returning id into v_id;
  else
    select * into v_actual from public.comprobantes where id = v_id and empresa_id = p_empresa for update;
    if not found then
      raise exception 'Comprobante no encontrado.';
    end if;
    if v_actual.estado = 'anulado' then
      raise exception 'El comprobante está anulado y no se puede modificar.';
    end if;
    if extract(year from v_actual.fecha) <> extract(year from p_fecha) then
      raise exception 'No se puede cambiar el año de un comprobante (cambiaría su número).';
    end if;
    -- El trigger valida que ni el periodo anterior ni el nuevo estén cerrados.
    update public.comprobantes
       set tipo = p_tipo, fecha = p_fecha, glosa = trim(p_glosa),
           total_debe = v_debe, total_haber = v_haber, updated_by = auth.uid()
     where id = v_id;
    delete from public.lineas_comprobante where comprobante_id = v_id;
  end if;

  insert into public.lineas_comprobante
    (estudio_id, empresa_id, comprobante_id, orden, cuenta_id, glosa, debe, haber, centro_costo_id)
  select v_estudio, p_empresa, v_id, ord::int,
         (l ->> 'cuenta_id')::uuid,
         nullif(trim(l ->> 'glosa'), ''),
         coalesce((l ->> 'debe')::bigint, 0),
         coalesce((l ->> 'haber')::bigint, 0),
         nullif(l ->> 'centro_costo_id', '')::uuid
    from jsonb_array_elements(p_lineas) with ordinality as x(l, ord);

  return v_id;
end $$;

-- Anula un comprobante (no se borra). Deja de sumar en los informes.
create or replace function public.anular_comprobante(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.comprobantes;
begin
  select * into v from public.comprobantes where id = p_id;
  if not found or not app.puede_editar(v.empresa_id, 'contabilidad') then
    raise exception 'No tienes permiso para anular este comprobante.' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 5 then
    raise exception 'Indica el motivo de la anulación.';
  end if;
  update public.comprobantes
     set estado = 'anulado', motivo_anulacion = trim(p_motivo), updated_by = auth.uid()
   where id = p_id;
end $$;

-- Cierra un mes: desde ahí no se pueden crear, modificar ni anular comprobantes de ese mes.
create or replace function public.cerrar_periodo(p_empresa uuid, p_anio int, p_mes int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_estudio uuid;
  v_periodo uuid;
begin
  select estudio_id into v_estudio from public.empresas where id = p_empresa;
  if v_estudio is null or not app.es_contador(v_estudio) then
    raise exception 'Solo el contador del estudio puede cerrar periodos.' using errcode = '42501';
  end if;
  insert into public.periodos (estudio_id, empresa_id, anio, mes, created_by)
  values (v_estudio, p_empresa, p_anio, p_mes, auth.uid())
  on conflict (empresa_id, anio, mes) do nothing;

  update public.periodos
     set estado = 'cerrado', cerrado_at = now(), cerrado_por = auth.uid()
   where empresa_id = p_empresa and anio = p_anio and mes = p_mes and estado = 'abierto'
  returning id into v_periodo;
  if v_periodo is null then
    raise exception 'El periodo ya estaba cerrado.';
  end if;
  insert into public.periodo_eventos (estudio_id, empresa_id, periodo_id, accion, created_by)
  values (v_estudio, p_empresa, v_periodo, 'cerrar', auth.uid());
end $$;

-- Reabre un mes cerrado. Exige un motivo, que queda registrado.
create or replace function public.reabrir_periodo(p_empresa uuid, p_anio int, p_mes int, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_estudio uuid;
  v_periodo uuid;
begin
  select estudio_id into v_estudio from public.empresas where id = p_empresa;
  if v_estudio is null or not app.es_contador(v_estudio) then
    raise exception 'Solo el contador del estudio puede reabrir periodos.' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 10 then
    raise exception 'Para reabrir el periodo escribe un motivo (al menos 10 caracteres).';
  end if;
  update public.periodos
     set estado = 'abierto', cerrado_at = null, cerrado_por = null
   where empresa_id = p_empresa and anio = p_anio and mes = p_mes and estado = 'cerrado'
  returning id into v_periodo;
  if v_periodo is null then
    raise exception 'El periodo no está cerrado.';
  end if;
  insert into public.periodo_eventos (estudio_id, empresa_id, periodo_id, accion, motivo, created_by)
  values (v_estudio, p_empresa, v_periodo, 'reabrir', trim(p_motivo), auth.uid());
end $$;

-- Copia la plantilla base (o el plan de otra empresa) a una empresa. No pisa cuentas existentes.
create or replace function public.copiar_plan_cuentas(p_destino uuid, p_origen uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_estudio uuid;
  v_filas int;
begin
  if not app.puede_editar(p_destino, 'contabilidad') then
    raise exception 'No tienes permiso para modificar el plan de cuentas de esta empresa.' using errcode = '42501';
  end if;
  select estudio_id into v_estudio from public.empresas where id = p_destino;

  if p_origen is null then
    insert into public.plan_cuentas (estudio_id, empresa_id, codigo, nombre, tipo, imputable, created_by)
    select v_estudio, p_destino, t.codigo, t.nombre, t.tipo, t.imputable, auth.uid()
      from public.plan_cuentas_plantilla t
    on conflict (empresa_id, codigo) do nothing;
  else
    if not app.puede_ver(p_origen, 'contabilidad') then
      raise exception 'No tienes acceso al plan de la empresa de origen.' using errcode = '42501';
    end if;
    insert into public.plan_cuentas (estudio_id, empresa_id, codigo, nombre, tipo, imputable, activa, created_by)
    select v_estudio, p_destino, c.codigo, c.nombre, c.tipo, c.imputable, c.activa, auth.uid()
      from public.plan_cuentas c where c.empresa_id = p_origen
    on conflict (empresa_id, codigo) do nothing;
  end if;
  get diagnostics v_filas = row_count;
  return v_filas;
end $$;

grant execute on function public.guardar_comprobante, public.anular_comprobante,
  public.cerrar_periodo, public.reabrir_periodo, public.copiar_plan_cuentas to authenticated;

-- ---------------------------------------------------------------------
-- Consultas para informes (respetan RLS: security invoker)
-- ---------------------------------------------------------------------

-- Sumas de debe y haber por cuenta entre dos fechas (solo comprobantes vigentes).
create or replace function public.sumas_por_cuenta(p_empresa uuid, p_desde date, p_hasta date)
returns table (cuenta_id uuid, debe bigint, haber bigint)
language sql stable security invoker set search_path = '' as $$
  select l.cuenta_id, sum(l.debe)::bigint, sum(l.haber)::bigint
    from public.lineas_comprobante l
    join public.comprobantes c on c.id = l.comprobante_id
   where l.empresa_id = p_empresa and c.estado = 'vigente'
     and c.fecha between p_desde and p_hasta
   group by l.cuenta_id;
$$;
grant execute on function public.sumas_por_cuenta to authenticated;

-- ---------------------------------------------------------------------
-- Plantilla base del plan de cuentas para pymes chilenas.
-- Estructura de referencia: la socia contadora puede ajustarla.
-- ---------------------------------------------------------------------
insert into public.plan_cuentas_plantilla (codigo, nombre, tipo, imputable) values
  ('1', 'ACTIVO', 'activo', false),
  ('1.1', 'ACTIVO CORRIENTE', 'activo', false),
  ('1.1.01', 'Disponible', 'activo', false),
  ('1.1.01.001', 'Caja', 'activo', true),
  ('1.1.01.002', 'Fondo fijo', 'activo', true),
  ('1.1.01.003', 'Banco cuenta corriente', 'activo', true),
  ('1.1.01.004', 'Banco cuenta vista', 'activo', true),
  ('1.1.02', 'Inversiones de corto plazo', 'activo', false),
  ('1.1.02.001', 'Depósitos a plazo', 'activo', true),
  ('1.1.02.002', 'Fondos mutuos', 'activo', true),
  ('1.1.03', 'Deudores', 'activo', false),
  ('1.1.03.001', 'Clientes', 'activo', true),
  ('1.1.03.002', 'Documentos por cobrar', 'activo', true),
  ('1.1.03.003', 'Deudores varios', 'activo', true),
  ('1.1.03.004', 'Anticipo a proveedores', 'activo', true),
  ('1.1.03.005', 'Préstamos al personal', 'activo', true),
  ('1.1.03.006', 'Anticipos de sueldo', 'activo', true),
  ('1.1.03.009', 'Estimación deudores incobrables', 'activo', true),
  ('1.1.04', 'Existencias', 'activo', false),
  ('1.1.04.001', 'Mercaderías', 'activo', true),
  ('1.1.04.002', 'Materias primas', 'activo', true),
  ('1.1.05', 'Impuestos por recuperar', 'activo', false),
  ('1.1.05.001', 'IVA crédito fiscal', 'activo', true),
  ('1.1.05.002', 'Remanente IVA crédito fiscal', 'activo', true),
  ('1.1.05.003', 'PPM', 'activo', true),
  ('1.1.05.004', 'Impuestos por recuperar', 'activo', true),
  ('1.1.06', 'Otros activos corrientes', 'activo', false),
  ('1.1.06.001', 'Gastos pagados por anticipado', 'activo', true),
  ('1.1.06.002', 'Garantías entregadas', 'activo', true),
  ('1.2', 'ACTIVO NO CORRIENTE', 'activo', false),
  ('1.2.01', 'Propiedades, planta y equipo', 'activo', false),
  ('1.2.01.001', 'Terrenos', 'activo', true),
  ('1.2.01.002', 'Construcciones', 'activo', true),
  ('1.2.01.003', 'Maquinarias y equipos', 'activo', true),
  ('1.2.01.004', 'Vehículos', 'activo', true),
  ('1.2.01.005', 'Muebles y útiles', 'activo', true),
  ('1.2.01.006', 'Equipos computacionales', 'activo', true),
  ('1.2.01.009', 'Depreciación acumulada', 'activo', true),
  ('1.2.02', 'Intangibles', 'activo', false),
  ('1.2.02.001', 'Software y licencias', 'activo', true),
  ('1.2.02.009', 'Amortización acumulada', 'activo', true),
  ('2', 'PASIVO', 'pasivo', false),
  ('2.1', 'PASIVO CORRIENTE', 'pasivo', false),
  ('2.1.01', 'Obligaciones financieras', 'pasivo', false),
  ('2.1.01.001', 'Préstamos bancarios corto plazo', 'pasivo', true),
  ('2.1.01.002', 'Línea de crédito', 'pasivo', true),
  ('2.1.01.003', 'Tarjetas de crédito', 'pasivo', true),
  ('2.1.02', 'Cuentas por pagar', 'pasivo', false),
  ('2.1.02.001', 'Proveedores', 'pasivo', true),
  ('2.1.02.002', 'Documentos por pagar', 'pasivo', true),
  ('2.1.02.003', 'Acreedores varios', 'pasivo', true),
  ('2.1.02.004', 'Honorarios por pagar', 'pasivo', true),
  ('2.1.02.005', 'Anticipo de clientes', 'pasivo', true),
  ('2.1.03', 'Obligaciones laborales y previsionales', 'pasivo', false),
  ('2.1.03.001', 'Remuneraciones por pagar', 'pasivo', true),
  ('2.1.03.002', 'Cotizaciones previsionales por pagar', 'pasivo', true),
  ('2.1.03.003', 'Provisión de vacaciones', 'pasivo', true),
  ('2.1.04', 'Impuestos por pagar', 'pasivo', false),
  ('2.1.04.001', 'IVA débito fiscal', 'pasivo', true),
  ('2.1.04.002', 'Impuesto único trabajadores', 'pasivo', true),
  ('2.1.04.003', 'Retención impuesto honorarios', 'pasivo', true),
  ('2.1.04.004', 'PPM por pagar', 'pasivo', true),
  ('2.1.04.005', 'Impuesto a la renta por pagar', 'pasivo', true),
  ('2.1.04.006', 'IVA por pagar', 'pasivo', true),
  ('2.2', 'PASIVO NO CORRIENTE', 'pasivo', false),
  ('2.2.01', 'Obligaciones de largo plazo', 'pasivo', false),
  ('2.2.01.001', 'Préstamos bancarios largo plazo', 'pasivo', true),
  ('2.2.01.002', 'Cuentas por pagar a socios', 'pasivo', true),
  ('3', 'PATRIMONIO', 'patrimonio', false),
  ('3.1', 'CAPITAL Y RESERVAS', 'patrimonio', false),
  ('3.1.01', 'Capital', 'patrimonio', false),
  ('3.1.01.001', 'Capital pagado', 'patrimonio', true),
  ('3.1.01.002', 'Cuenta particular socios', 'patrimonio', true),
  ('3.1.02', 'Resultados', 'patrimonio', false),
  ('3.1.02.001', 'Utilidades (pérdidas) acumuladas', 'patrimonio', true),
  ('3.1.02.002', 'Utilidad (pérdida) del ejercicio', 'patrimonio', true),
  ('3.1.02.003', 'Retiros', 'patrimonio', true),
  ('4', 'PÉRDIDAS (GASTOS Y COSTOS)', 'perdida', false),
  ('4.1', 'COSTOS DE EXPLOTACIÓN', 'perdida', false),
  ('4.1.01', 'Costo de ventas', 'perdida', false),
  ('4.1.01.001', 'Costo de venta mercaderías', 'perdida', true),
  ('4.1.01.002', 'Costo de servicios', 'perdida', true),
  ('4.1.01.003', 'Fletes y combustibles', 'perdida', true),
  ('4.2', 'GASTOS DE ADMINISTRACIÓN Y VENTAS', 'perdida', false),
  ('4.2.01', 'Gastos de personal', 'perdida', false),
  ('4.2.01.001', 'Sueldos y salarios', 'perdida', true),
  ('4.2.01.002', 'Gratificaciones', 'perdida', true),
  ('4.2.01.003', 'Horas extraordinarias', 'perdida', true),
  ('4.2.01.004', 'Aportes patronales', 'perdida', true),
  ('4.2.01.005', 'Colación y movilización', 'perdida', true),
  ('4.2.01.006', 'Indemnizaciones', 'perdida', true),
  ('4.2.01.007', 'Honorarios', 'perdida', true),
  ('4.2.02', 'Gastos generales', 'perdida', false),
  ('4.2.02.001', 'Arriendos', 'perdida', true),
  ('4.2.02.002', 'Consumos básicos', 'perdida', true),
  ('4.2.02.003', 'Telefonía e internet', 'perdida', true),
  ('4.2.02.004', 'Materiales de oficina', 'perdida', true),
  ('4.2.02.005', 'Mantención y reparaciones', 'perdida', true),
  ('4.2.02.006', 'Seguros', 'perdida', true),
  ('4.2.02.007', 'Publicidad', 'perdida', true),
  ('4.2.02.008', 'Asesorías contables y legales', 'perdida', true),
  ('4.2.02.009', 'Patentes y contribuciones', 'perdida', true),
  ('4.2.02.010', 'Gastos generales varios', 'perdida', true),
  ('4.2.03', 'Depreciaciones y castigos', 'perdida', false),
  ('4.2.03.001', 'Depreciación del ejercicio', 'perdida', true),
  ('4.2.03.002', 'Castigo deudores incobrables', 'perdida', true),
  ('4.3', 'GASTOS NO OPERACIONALES', 'perdida', false),
  ('4.3.01', 'Gastos financieros', 'perdida', false),
  ('4.3.01.001', 'Intereses y comisiones bancarias', 'perdida', true),
  ('4.3.01.002', 'Multas e intereses fiscales', 'perdida', true),
  ('4.3.01.003', 'Diferencias de cambio', 'perdida', true),
  ('4.3.02', 'Impuesto a la renta', 'perdida', false),
  ('4.3.02.001', 'Impuesto a la renta', 'perdida', true),
  ('5', 'GANANCIAS (INGRESOS)', 'ganancia', false),
  ('5.1', 'INGRESOS DE EXPLOTACIÓN', 'ganancia', false),
  ('5.1.01', 'Ventas', 'ganancia', false),
  ('5.1.01.001', 'Ventas de mercaderías', 'ganancia', true),
  ('5.1.01.002', 'Ventas de servicios', 'ganancia', true),
  ('5.1.01.003', 'Ventas exentas', 'ganancia', true),
  ('5.1.01.004', 'Ventas con boleta', 'ganancia', true),
  ('5.1.01.009', 'Devoluciones y descuentos sobre ventas', 'ganancia', true),
  ('5.2', 'INGRESOS NO OPERACIONALES', 'ganancia', false),
  ('5.2.01', 'Otros ingresos', 'ganancia', false),
  ('5.2.01.001', 'Intereses ganados', 'ganancia', true),
  ('5.2.01.002', 'Utilidad en venta de activos', 'ganancia', true),
  ('5.2.01.003', 'Corrección monetaria', 'ganancia', true),
  ('5.2.01.004', 'Otros ingresos', 'ganancia', true);
