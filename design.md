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
| `/login` | Pantalla fullscreen sin nav global |
| `/cuenta` | Redirige a `/login` si no hay sesion; con sesion muestra favoritos en estilo de catalogo |
| `/admin` | Pantalla operativa fullscreen sin nav global |
| `/admin/cambios` | Historial fullscreen utilitario |
| `/admin/import` | Tabla densa para sincronizacion de drops |

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
- CTAs: WhatsApp negro, PayPal outline
- Footer al final

Si el producto no existe, muestra estado centrado y link de vuelta.

## 11. Admin e importacion

Las rutas admin no buscan ser landing ni editorial. Son herramientas:

- Densidad alta
- Tablas, inputs y toggles claros
- Feedback de guardado/importacion
- Uso puntual de verde/rojo/azul para estados
- Sin nav global

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

El inventario por color/talla vive aparte en `backend/data/inventory.json` y el backend lo combina con el catalogo.

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
9. No editar manualmente `catalog.json`/`inventory.json` salvo mantenimiento controlado.
10. Actualizar este documento si cambia una ruta, layout o regla visual importante.
