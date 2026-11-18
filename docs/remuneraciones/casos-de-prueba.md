# Casos de prueba de remuneraciones (para verificar por la socia contadora)

> Estado: **POR VERIFICAR**. La Fase 5 no está terminada hasta que estos casos cuadren al peso con un simulador oficial o con liquidaciones reales anonimizadas.
> Las pruebas automáticas están en `src/lib/remuneraciones.test.ts` y se ejecutan con `npm test`.

**Parámetros usados (remuneraciones de noviembre de 2026):** se tomaron de los [indicadores de Previred de noviembre de 2026](https://www.previred.com/wp-content/uploads/2026/11/Indicadores-Previsionales-Previred-Noviembre-2026.pdf) y de la [tabla de impuesto único del SII](https://www.sii.cl/valores_y_fechas/impuesto_2da_categoria/impuesto2026.htm).

- UF al 30-11-2026: $41.439,89. UTM de noviembre: $72.440. Ingreso mínimo: $553.553.
- Topes imponibles: 90 UF ($3.729.590) y 135,2 UF ($5.602.673).
- AFP Modelo 10,58%; AFP Cuprum 11,44%.
- SIS 1,79%. Reforma de Pensiones: 0,1% + 0,9% + 0,71%.
- Seguro de cesantía (contrato indefinido): 0,6% el trabajador y 2,4% el empleador.
- Ley 16.744 básica: 0,93% (**por verificar**).

## Caso 1: sueldo mínimo, Fonasa, AFP Modelo, 1 carga familiar, colación $30.000, contrato indefinido, 30 días

| Concepto | Cálculo | Monto |
|---|---|---|
| Sueldo base | 553.553 × 30/30 | $553.553 |
| Gratificación art. 50 | 25% × 553.553 = 138.388,25; tope 4,75 × 553.553 / 12 = 219.114,73 → el menor | $138.388 |
| **Total imponible** | | **$691.941** |
| Asignación familiar | renta 691.941 → tramo B ($13.870) × 1 carga | $13.870 |
| Colación | | $30.000 |
| **Total haberes** | | **$735.811** |
| AFP Modelo | 691.941 × 10,58% = 73.207,36 | $73.207 |
| Salud Fonasa | 691.941 × 7% = 48.435,87 | $48.436 |
| Seguro de cesantía | 691.941 × 0,6% = 4.151,65 | $4.152 |
| Base tributable | 691.941 − 73.207 − 48.436 − 4.152 | $566.146 |
| Impuesto único | menos de 13,5 UTM ($977.940): exento | $0 |
| **Líquido a pagar** | 735.811 − 125.795 | **$610.016** |
| SIS (empleador) | 691.941 × 1,79% | $12.386 |
| Seguro de cesantía (empleador) | 691.941 × 2,4% | $16.607 |
| Ley 16.744 (ISL, sin adicional) | 691.941 × 0,93% | $6.435 |
| Reforma: cuenta individual | 691.941 × 0,1% | $692 |
| Reforma: rentabilidad protegida | 691.941 × 0,9% | $6.227 |
| Reforma: expectativa de vida | 691.941 × 0,71% | $4.913 |
| **Costo empresa** | 735.811 + 47.260 | **$783.071** |

## Caso 2: sueldo $2.400.000, Isapre plan 5,8 UF, AFP Cuprum, colación y movilización $40.000 cada una

| Concepto | Cálculo | Monto |
|---|---|---|
| Gratificación | 25% = 600.000; tope 219.114,73 → tope | $219.115 |
| **Total imponible** | 2.400.000 + 219.115 | **$2.619.115** |
| AFP Cuprum | × 11,44% = 299.626,76 | $299.627 |
| Salud | 7% = 183.338; plan 5,8 × 41.439,89 = 240.351,36 → se descuenta el plan | $240.351 |
| Seguro de cesantía | × 0,6% = 15.714,69 | $15.715 |
| Base tributable | 2.619.115 − 299.627 − 183.338 (solo el 7% rebaja) − 15.715 | $2.120.435 |
| Impuesto único | 2.120.435 × 0,04 − 39.117,60 = 45.699,80 | $45.700 |
| **Líquido** | 2.699.115 − 601.393 | **$2.097.722** |

## Otros casos automáticos

- **Ingreso a mitad de mes:** si ingresa el 16-11-2026, son 15 días (mes comercial de 30 días).
- **Licencia médica:** 7 días de licencia sobre un sueldo de $900.000 dejan 23 días trabajados, con un sueldo proporcional de $690.000.
- **Horas extra:** sueldo $850.000 y 42 horas semanales. La hora vale 850.000 / 30 × 28 / (42 × 4) = $4.722,22; la hora extra (con el 50%) vale $7.083,33; 10 horas suman $70.833.
- **Plazo fijo:** el trabajador no paga seguro de cesantía; el empleador paga el 3%.

## Criterios que la socia debe confirmar

1. **Gratificación mensual:** el tope se aplica proporcional a los días trabajados.
2. **Colación y movilización:** se pagan proporcionales a los días trabajados.
3. **Asignación familiar:** el tramo se determina con la renta del mes. Por ley se usa el promedio del semestre anterior.
4. **Plan de Isapre con licencia o ingreso a mitad de mes:** se descuenta proporcional a los días trabajados.
5. **Licencias médicas:** falta definir la cotización del seguro de cesantía del empleador por los días de licencia y el informe en Previred (movimiento de personal).
6. **Ley 16.744:** la cotización básica es 0,93% (0,90% + 0,03% de la Ley SANNA).
7. **APV régimen B:** por ahora se descuenta del líquido, pero no rebaja la base del impuesto único.
