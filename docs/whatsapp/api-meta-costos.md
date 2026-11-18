# WhatsApp Business Cloud API (Meta): qué falta para activarla

**Estado:** NO activada. Hoy RH Software usa solo links `wa.me` prellenados (gratis): el contador
pulsa "Escribir por WhatsApp" y se abre su propio WhatsApp con el mensaje listo.

## Qué permitiría la API
- Recordatorios automáticos a clientes (documentos pendientes, F29 listo para pagar).
- Envío de liquidaciones a trabajadores que aceptaron recibirlas por WhatsApp.
- Recepción de fotos y PDF que el cliente envía al número del estudio → bandeja de documentos
  (ya existe la tabla `mensajes_whatsapp` y el origen `whatsapp` en la bandeja).

## Lo que necesita José
1. Cuenta de Meta Business verificada (business.facebook.com) con los datos de la empresa.
2. Un número de teléfono dedicado (no puede estar usándose en la app normal de WhatsApp).
3. Aprobar el costo mensual (abajo) y las plantillas de mensajes.

## Costo (POR VERIFICAR)
Meta cobra **por mensaje de plantilla entregado**, con tarifa distinta por país y categoría
(marketing, utilidad, autenticación). Los mensajes de "servicio" (respuestas dentro de las 24 h
después de que el cliente escribe) no se cobran en el esquema vigente al escribir esto.
Los recordatorios de RH Software serían de categoría **utilidad**.

- Tarifa oficial vigente para Chile: https://developers.facebook.com/docs/whatsapp/pricing
  (no la escribo aquí para no inventar una cifra: revisarla al activar).
- Fórmula para estimar: `costo mensual ≈ empresas × mensajes de utilidad por empresa al mes × tarifa utilidad Chile`.
  Ejemplo de volumen: 50 empresas × 3 recordatorios = 150 mensajes/mes, más 1 por cada liquidación enviada.
- Recibir documentos de clientes (que inician la conversación) y responder dentro de 24 h: sin costo por mensaje.

## Reglas que ya respeta el sistema
- Solo se envía a personas que dieron su consentimiento (tabla `consentimientos`, tipo `whatsapp`).
- Nada de envíos masivos a números que no lo aceptaron.
