# Another NPC Shop - Design System

Referencia visual y de implementacion para tocar el frontend sin romper la identidad de la tienda.

La fuente principal de estilos globales es `frontend/src/index.css`. Algunas pantallas operativas (`Admin`, `AdminImport`, `AdminCambios`, `Account`, `Login` e `InventoryModal`) mantienen CSS inline dentro del componente.

## 1. Identidad

- Marca: `ANOTHER NPC SHOP`
- Tono: minimalista, editorial, seco, monocromatico
- Voz: frases cortas, directas, sin decoracion innecesaria
- UI publica: mucho blanco, tipografia Inter, productos como protagonistas
- UI admin: mas densa y utilitaria, pero todavia limpia y monocromatica

## 2. Stack visual

| Area | Regla |
| --- | --- |
| Framework | React + Vite |
| Routing | React Router |
| CSS base | `frontend/src/index.css` |
| CSS banner | `frontend/src/components/TopBanner.css` |
| Fuente | Inter |
| Nomenclatura | BEM cuando el estilo vive en CSS global |
| Tailwind | No usar salvo instruccion explicita |

## 3. Paleta

```css
--white:    #ffffff;
--black:    #0a0a0a;
--grey-100: #f5f5f5;
--grey-200: #e8e8e8;
--grey-300: #cccccc;
--grey-400: #999999;
--grey-600: #555555;
```

La app publica debe sentirse blanco/negro. Colores vivos solo se aceptan en estados operativos del admin, por ejemplo exito/error, toggles o badges de importacion.

## 4. Tipografia

- Fuente unica: `Inter, sans-serif`
- Marca/nav/botones: uppercase, peso medio, tracking amplio
- Texto editorial: peso ligero, tracking sutil
- Nombres de producto: uppercase, tracking amplio
- Home hero: texto grande sobre video, no dentro de card

Evitar hacer crecer tipografia por viewport de forma agresiva. El texto debe caber en mobile sin solaparse.

## 5. Layout por ruta

| Ruta | Tratamiento actual |
| --- | --- |
| `/` | Landing real con video `another.mp4`, nav glass, overlay oscuro y CTA a catalogo |
| `/catalogo` | Nav global, TopBanner negro, sidebar/drawer de filtros, grid de producto y footer |
| `/producto/:id` | Nav global, layout producto 2 columnas en desktop, carrusel 3:4, CTAs y footer |
| `/nosotros` | Pagina editorial sencilla con `fadeIn` y footer |
| `/resumen` | Cesta (los favoritos) con seleccion por linea, talla y cantidad; resumen lateral pegajoso y recomendaciones |
| `/pago/:numero` | Metodos de pago en lista vertical; al abrir uno muestra los datos y el numero de pedido como concepto |
| `/pedido/:numero` (`/gracias/:numero`) | Seguimiento: check verde que se dibuja y pasa a reloj mientras se verifica el pago, numero de seguimiento, linea de tiempo; se refresca sola |
| `/seguimiento` | Buscador de pedido por numero + pedidos recientes de este navegador. Se llega desde el boton de `/cuenta` (no hay enlace en el footer) |
| `/login` | Pantalla fullscreen sin nav global |
| `/cuenta` | Panel de cuenta: `Pagar ahora`, `Seguir mi pedido`, Mis pedidos con la vista de seguimiento integrada, y favoritos. Sin sesion muestra los pedidos y favoritos de este navegador |
| `/admin` | Pantalla operativa fullscreen sin nav global |
| `/admin/cambios` | Historial fullscreen utilitario |
| `/admin/import` | Tabla densa para sincronizacion de drops |
| `/dashboard` | Analitica CRM fullscreen, densa, monocromatica y orientada a decisiones |
| `/pedidos` (CRM) | Pedidos de la tienda publica: lista densa, detalle desplegable y acciones de confirmar/cancelar |
| `/ajustes` (CRM) | Datos de la tienda y metodos de pago que ve el comprador |

## 6. Navegacion

`Nav.jsx` aparece en rutas publicas salvo login/admin.

- Desktop: logo a la izquierda, links `Catalogo` y `Nosotros`, icono de usuario a la derecha
- Mobile: logo + hamburguesa + menu desplegable
- En Home usa variante glass sobre video
- En catalogo aparece junto con `TopBanner`

## 7. Home

Home ya no debe tratarse como una ruta excluida o pendiente. Es una landing de marca:

- Video full-screen desde `frontend/public/another.mp4`
- Overlay oscuro sutil
- H1 `ANOTHER NPC SHOP` sobre el video
- CTA `VER CATALOGO`
- Transicion al catalogo con fade

Los cambios en Home deben cuidar especialmente legibilidad sobre video y sincronizacion de carga.

## 8. Catalogo

Componentes principales:

- `Catalog.jsx`
- `FilterChips.jsx`
- `ProductCard.jsx`
- `TopBanner.jsx`
- `Footer.jsx`

Reglas visibles:

- Grid de productos con tarjetas 3:4
- Sidebar de filtros en desktop
- Drawer de filtros en mobile
- Busqueda por ID/nombre
- Favoritos con toast
- Agotado en grayscale + overlay
- TopBanner solo en `/catalogo`
- Al volver desde producto, el scroll se restaura antes de revelar nav/banner/grid

La animacion normal del catalogo usa `slowFadeIn`; cuando se vuelve desde producto con scroll guardado, se desactiva el fade para evitar saltos.

## 9. ProductCard

- Imagen con `aspect-ratio: 3 / 4`
- Hover desktop: segunda imagen si existe
- Mobile: swipe entre imagenes
- Dots solo en dispositivos tactiles
- Favorito circular
- Estado agotado con overlay `Agotado`
- Click en tarjeta guarda scroll del catalogo antes de navegar a detalle

## 10. Producto

`Product.jsx` mantiene coherencia con catalogo:

- Layout editorial con carrusel 3:4
- `fadeIn`
- Back link a catalogo
- Tallas como chips
- Colores como swatches cuando hay variantes reales
- CTAs: WhatsApp negro, `Comprar ahora` outline (lleva a `/resumen` con la talla elegida)
- Footer al final

Si el producto no existe, muestra estado centrado y link de vuelta.

## 10b. Checkout

`Resumen.jsx`, `Pago.jsx` y `Gracias.jsx` comparten `pages/Checkout.css` (mismo
patron que `TopBanner.css`: CSS propio del bloque, fuera de `index.css`).

Reglas visibles:

- Los favoritos hacen de carrito. Un favorito no guarda talla ni cantidad: eso
  se elige en `/resumen` y la talla es obligatoria para poder pagar.
- Checkbox por linea; el total recalcula solo con lo marcado.
- Antes del resumen aparece una puerta modal: invitado o cuenta.
- En movil se mantienen las esquinas redondeadas; en escritorio (>=64rem) todo
  pasa a recto, como el catalogo.
- Los datos bancarios nunca viajan en `/api/meta`: se sirven desde
  `/api/checkout/metodos` y solo aparecen dentro del pedido.
- El numero de pedido (`ANPC-XXXXXX`) es la referencia de todo y el concepto que
  se le pide al comprador.

- Cada metodo de pago lleva su icono junto al titulo (`public/pay-icons/`). Efectivo
  usa un billete generico propio, no una marca. `Binance Pay` va primero con la
  etiqueta `Recomendado` (campo `etiqueta` en Ajustes).
- La API publica del pedido no devuelve telefono, email ni ids: solo lo necesario
  para el seguimiento.

- Los resumenes de pedido (seguimiento y pago) llevan miniatura de cada prenda.
- Los avisos por correo salen al recibir el pago, verificarlo, confirmar y cancelar.
  Transporte SMTP (Gmail con clave de aplicacion: `SMTP_USER`, `SMTP_PASSWORD`, `SITE_URL`);
  Resend queda como alternativa si no hay SMTP. Sin configurar no hacen nada y nunca
  bloquean la peticion.
- El resumen tiene papelera por prenda (quita tambien el favorito: es la misma lista).
- La conciliacion de Binance usa el ID/nota solo como filtro y compara importe,
  moneda y receptor contra el CRM: solo un pago exacto se verifica solo.

Ningun pedido online toca inventario ni `crm.ventas`. Eso ocurre solo cuando el
admin pulsa Confirmar en `/pedidos` del CRM.

## 11. Admin e importacion

Las rutas admin no buscan ser landing ni editorial. Son herramientas:

- Densidad alta
- Tablas, inputs y toggles claros
- Feedback de guardado/importacion
- Uso puntual de verde/rojo/azul para estados
- Sin nav global

El deploy privado del CRM comparte una cabecera propia entre `/clientes` y
`/dashboard`. El dashboard usa KPIs, barras y tablas sin abandonar los bordes
finos, la tipografia Inter ni la paleta monocromatica del CRM.

Aunque usen CSS inline, deben respetar Inter, blanco/negro, bordes finos y controles sobrios.

## 12. Animaciones

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slowFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

Uso actual:

- Producto y Nosotros: `fadeIn`
- Catalogo: `slowFadeIn`
- Home: animaciones propias de video/entrada/salida
- Admin/import: animaciones utilitarias puntuales

No agregar animaciones largas que hagan que nav, banner o contenido aparezcan descoordinados.

## 13. Datos de producto

Campos frecuentes del catalogo:

```json
{
  "id": "038",
  "ref": "PB-0001",
  "nombre": "Nombre del producto",
  "precio": 30,
  "precio_coste": 12,
  "categoria": "sin_categoria",
  "genero": "mujer",
  "tallas": ["XS", "S", "M", "L", "XL"],
  "imagen": "/images/038.jpg",
  "imagenes": ["/images/038.jpg"],
  "descripcion": "Texto de tallas o descripcion",
  "disponible": true,
  "marca": "",
  "drop": "Drop 1"
}
```

El frontend conserva esta forma de objeto, pero el dato vive en las tablas
`productos`, `variantes` e `inventario` de Supabase/PostgreSQL. FastAPI recompone
el contrato; `backend/data/*.json` es únicamente el backup de la migración.

## 14. Coherencia actual revisada

Revisado contra las vistas renderizadas en local:

- Home, catalogo, producto, nosotros y login son visualmente coherentes con la identidad monocromatica.
- Catalogo muestra nav + TopBanner + grid de forma consistente.
- Producto mantiene aspect ratio 3:4, `fadeIn`, CTAs y footer.
- Nosotros mantiene el tono editorial minimalista.
- Login es coherente como pantalla fullscreen sin nav.
- Cuenta sin sesion redirige a login, asi que su estado visible tambien es coherente.
- Admin principal e importacion son coherentes por codigo como herramientas fullscreen, aunque `/admin` y `/admin/import` pueden ser bloqueadas por algunos entornos de navegador interno por la ruta.

Puntos a vigilar:

- Hay mojibake antiguo en algunos comentarios de codigo; no afecta UI, pero ensucia lectura.
- `Account`, `Login`, `Admin`, `AdminCambios`, `AdminImport` e `InventoryModal` tienen CSS inline; si siguen creciendo, conviene extraer estilos.
- No volver a documentar Home como "excluido" o "en rediseno"; ya es parte visible del producto.

## 15. Reglas para futuros cambios

1. Mantener la UI publica monocromatica.
2. Usar `index.css` para estilos globales reutilizables.
3. No introducir Tailwind ni otro sistema de estilos sin decision explicita.
4. No duplicar nav ni reemplazarlo en rutas publicas.
5. Mantener tarjetas e imagenes de producto en formato 3:4.
6. Mantener admin como herramienta densa, no como pagina de marketing.
7. Probar Home, catalogo y producto despues de cambios visuales grandes.
8. Evitar fades que revelen nav, banner y contenido en momentos distintos.
9. No editar `catalog.json`/`inventory.json`: son backups de solo lectura; los
   cambios operativos pasan por `/admin`.
10. Actualizar este documento si cambia una ruta, layout o regla visual importante.
11. `CHECKOUT_STOCK_ESTRICTO=0` (solo backend) desactiva las comprobaciones de stock
    mientras se prueba. "Agotado" es siempre el interruptor manual del catalogo:
    ninguna venta ni pedido lo cambia. Quitar la variable antes de salir a produccion.
12. El checkout nunca confia en precios que venga del navegador: los recalcula el
    backend contra el catalogo.
