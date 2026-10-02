# JAV Wireless — panel administrativo completo, API y seguridad

Se mantiene el diseño actual (azul marino, blanco, rojo) y todas las páginas públicas que ya funcionan. Solo se agrega lo que falta.

## Ya existe (se reutiliza)
- Catálogo, carrito, checkout, seguimiento, 13 servicios con formularios.
- Inicio de sesión del personal, rol administrador protegido en la base de datos.
- Pedidos JW-####, historial de estados, cola de avisos.

## Lo nuevo

### Panel con menú lateral
Dashboard, Productos, Categorías, Inventario, Pedidos, Clientes, Servicios, Solicitudes, Pagos, Promociones, Seguimiento, Configuración.
- **Dashboard:** ventas del día, pedidos pendientes / preparando / listos para recoger, solicitudes pendientes, poco stock, agotados, total de clientes.
- **Productos:** crear, editar, desactivar o eliminar; subir imágenes; colores, características, especificaciones, oferta, destacado.
- **Categorías:** crear, editar, activar/desactivar; eliminar solo si no tienen productos.
- **Inventario:** existencias, entradas y salidas registradas, stock bajo, agotados; salida automática al confirmar una compra.
- **Pedidos:** detalle completo, cambio de estado (incluye Cancelado y Archivado; nunca se borran), guía, historial con estado anterior, nuevo, fecha y administrador.
- **Servicios:** pasan a la base de datos; editar nombre, requisitos, campos del formulario, costo/comisión, activar/desactivar.
- **Solicitudes:** revisar formulario, cambiar estado, confirmar pago, notas internas, completar.
- **Pagos:** lista unificada de pedidos y solicitudes con método, referencia, total, fecha y estado pendiente/confirmado/rechazado.
- **Promociones:** crear, editar, programar (fecha inicio/fin), activar, elegir productos; el sitio muestra solo las vigentes.
- **Configuración:** datos de Zelle, teléfono/WhatsApp, umbral de stock bajo.

### Sitio público
- Solo muestra productos, categorías, servicios y promociones activos.
- Seguimiento se actualiza al instante cuando el personal cambia el estado (sin recargar).

### API
Públicos: productos, producto por id, categorías, servicios, crear pedido, rastrear pedido, crear solicitud.
Administrativos (`/api/admin/...`): productos, categorías, estado de pedidos, pedidos, pagos, servicios. Todos exigen sesión y verifican el rol administrador en el servidor; respuestas uniformes `{ ok, data | error }` con validación.

### Pagos
Tarjeta y PayPal siguen simulados; nunca se guardan números de tarjeta. Zelle guarda solo nombre del remitente y referencia. Cobro real con un proveedor seguro puede conectarse después.

## Sección técnica
- Migración: `categories.active`; `services` (slug, nombre, requisitos, fields jsonb, costo, comisión, activo) sembrada con los servicios actuales; `promotions` + `promotion_products`; `inventory_movements` (tipo entrada/salida/ajuste, cantidad, motivo, admin, pedido); `orders.payment_status`, `archived`; `order_status_history.previous_status` y `changed_by`; `service_requests.internal_notes`, `payment_status`; `settings` (clave/valor, lectura pública limitada); bucket público de imágenes de producto con escritura solo admin. GRANT + RLS en cada tabla; escritura solo `has_role(admin)`.
- Trigger de estado registra estado anterior y `auth.uid()`; trigger de inventario registra salidas al crear pedido.
- Tiempo real para seguimiento: canal de difusión emitido por trigger con el número de orden (sin exponer la tabla de pedidos al público), con respaldo de sondeo cada 15 s.
- API REST en `src/routes/api/public/*` y `src/routes/api/admin/*` (validación de token + `has_role` en cada handler); el panel usa funciones de servidor con la misma verificación.
- `site-data.ts` deja de ser la fuente de servicios: los formularios públicos leen de la tabla `services`.
- Panel dividido en rutas `_authenticated/panel/*` con barra lateral (shadcn Sidebar), en lugar de pestañas.
