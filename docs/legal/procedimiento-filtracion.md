# Procedimiento ante una vulneración de seguridad (filtración de datos)

> **BORRADOR: revisar con un abogado.** Basado en la Ley 21.719.

## 1. Detectar
- Fuentes: alertas de Supabase/Vercel, auditoría (accesos raros, exportaciones masivas), aviso de un usuario o de un proveedor.
- Quien lo detecte avisa de inmediato a José (responsable de seguridad) por teléfono y WhatsApp.

## 2. Contener (primeras horas)
1. Cerrar la vía de acceso: revocar sesiones (Supabase Auth → cerrar sesiones), rotar claves (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, tokens de WhatsApp) y desactivar usuarios comprometidos.
2. Si hace falta, pasar la app a modo mantenimiento.
3. Guardar evidencia: exportar la tabla `auditoria`, registros de Vercel y Supabase del periodo.

## 3. Evaluar
- Qué datos, de qué estudios y empresas, cuántos titulares, si incluye datos sensibles (salud, licencias, sindicato), desde cuándo.
- Riesgo para los titulares.

## 4. Notificar
- **A cada estudio afectado (responsable)**: sin demora indebida, con lo que se sabe, las medidas tomadas y recomendaciones.
- **A la Agencia de Protección de Datos Personales**: cuando corresponda según la ley, en el plazo que establezca la normativa (POR VERIFICAR con abogado).
- **A los titulares**: cuando el riesgo sea alto o lo exija la ley, en lenguaje simple.

## 5. Corregir y aprender
- Corregir la causa, agregar pruebas automáticas que la cubran, documentar el incidente (fecha, causa, alcance, medidas) y revisar este procedimiento.

## Registro de incidentes
| Fecha | Descripción | Datos afectados | Estudios | Medidas | Notificado a |
|---|---|---|---|---|---|
| | | | | | |
