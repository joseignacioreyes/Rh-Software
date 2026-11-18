-- UTM de 2026 que faltaban (fuente: SII, Circular 39 de 2026, tabla de valores mensuales).
insert into public.parametros_legales (codigo, descripcion, valor, unidad, vigente_desde, vigente_hasta, fuente_nombre, fuente_url, estado)
select 'UTM', 'Unidad Tributaria Mensual', v.valor, '$', v.desde::date, (v.desde::date + interval '1 month' - interval '1 day')::date,
       'SII, Circular 39 de 2026', 'https://www.sii.cl/normativa_legislacion/circulares/2026/circu39.pdf', 'por_verificar'
from (values
  ('2026-01-01', 69751), ('2026-02-01', 69611), ('2026-03-01', 69889), ('2026-04-01', 69889),
  ('2026-05-01', 70588), ('2026-06-01', 71506), ('2026-09-01', 71721)
) as v(desde, valor)
on conflict (codigo, vigente_desde) do nothing;
