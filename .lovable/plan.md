# JAV Wireless — plataforma comercial completa

## Decisiones confirmadas
- Pagos con tarjeta y PayPal simulados (flujo completo, sin cobro real). Zelle con instrucciones + campo de referencia/comprobante.
- Datos reales en Lovable Cloud: productos, pedidos, solicitudes de servicio, estados.
- Panel protegido con inicio de sesión del personal (rol administrador).
- Avisos por correo al cambiar el estado de un pedido; SMS/WhatsApp quedan preparados.
- Correo de Zelle: pendiente, se usará un texto de ejemplo editable hasta recibirlo.

## Nuevo diseño
- Fondo blanco, azul marino principal, rojo solo para promociones y acciones clave, grises de apoyo.
- Sin neón, sin cuadrículas futuristas ni brillos. Tarjetas limpias, sombras suaves, fotos grandes de producto.
- Menú: Inicio | Productos | Servicios | Financiamiento | Reparaciones | Seguimiento | Nosotros | Contacto | Carrito (n) | Panel.

## Páginas
1. **Inicio** (solo productos): banner, categorías, destacados, más vendidos, nuevos, ofertas, recomendados, "Ver todos los productos".
2. **Productos**: buscador, categorías (Teléfonos, Accesorios, Perfumes, Joyería, Trajes, Herramientas, Gift Shop, Otros), filtros de precio, disponibilidad, marca; orden por precio, novedades, destacados. Tarjeta con "Ver detalles" y "Agregar al carrito"; modal de detalle único.
3. **Servicios**: listado de 13 servicios ("Envíos de dinero" claramente separado de envíos de productos). Cada servicio con su propia página: descripción, requisitos, costo, formulario → revisión → método de pago → envío → número de referencia.
4. **Carrito**: accesible desde todas las páginas, se conserva al navegar; cantidades, eliminar, subtotal, total, continuar comprando, proceder al pago.
5. **Checkout**: datos del cliente, entrega (recogida en tienda o paquetería), pago (tarjeta, PayPal, Zelle). Confirmación con número de orden (JW-####), productos, total, método de pago y entrega, estado inicial.
6. **Seguimiento**: búsqueda por número de orden + teléfono o correo (sin cuenta). Línea de estados adaptada al tipo de entrega, fechas, número de guía; se actualiza automáticamente cuando el personal cambia el estado. Solicitudes de servicio consultables por referencia.
7. **Panel** (protegido): pedidos con selector de estado, solicitudes de servicio, productos (precio, inventario, categoría, destacado, oferta), clientes, pagos (confirmar Zelle), servicios.
8. Financiamiento, Reparaciones, Nosotros, Contacto: rediseñadas con el nuevo estilo.

## Sección técnica
- Tablas: categories, products, orders, order_items, order_status_history, service_requests, notifications (cola de avisos), user_roles + has_role.
- Lectura pública de productos; pedidos y solicitudes creados por servidor; búsqueda de pedido validada con teléfono/correo; panel bajo ruta autenticada con verificación de rol admin.
- Actualizaciones en vivo del seguimiento vía suscripción en tiempo real a cambios del pedido.
- Carrito en el navegador (persistente entre páginas).
- Correos transaccionales al cambiar estado; requiere configurar un dominio de envío.
- Productos de muestra en todas las categorías, con imágenes generadas.
