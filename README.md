# La Percha — Tienda

Tienda online estática de **La Percha** (Santiago, RD): catálogo de productos con filtros y búsqueda, carrito de compras y pedido directo por Instagram. Sin framework, sin build: HTML + CSS + JavaScript puro.

## Stack

- **HTML5 / CSS3 / JavaScript** (ES puro, sin dependencias)
- Tema oscuro `#171512`, acentos mango `#FF9F1C`, guayaba `#FF3D6E` y teal `#06B6A8`
- Tipografías: **Anton** (display) + **Inter** (cuerpo), vía Google Fonts
- Persistencia del carrito y catálogo en `localStorage` (demo/validación)
- Dev server: Node.js (`node:http`) sin dependencias

## Estructura

```
la-percha-tienda/
├── index.html       # Página principal (referencia css/ y js/)
├── css/
│   └── styles.css   # Estilos extraídos del template original
├── js/
│   └── main.js      # Lógica: render, carrito, admin, checkout por Instagram
├── server.js        # Dev server estático (sin dependencias)
└── package.json     # Scripts + engines
```

## Requisitos

- Node.js >= 18 (probado con Node 20)

## Correr localmente

```bash
npm start
# o sin npm:  node server.js
```

Abrir [http://localhost:3000](http://localhost:3000).

## Configuración

Editar `CONFIG` al inicio de `js/main.js`:

- `instagramDefaultAccounts` — cuentas de Instagram destino con las que arranca la tienda la primera vez (sin `@`). Cada cuenta: `{ id, username }`
- `currency` — moneda a mostrar

### Cuentas de Instagram

- Desde el panel admin (apartado **Cuentas de Instagram**) se gestionan las cuentas destino: agregar, editar inline, eliminar y marcar una como **activa**.
- La cuenta activa es la que usa el checkout: copia el pedido y abre `instagram.com/<usuario>` para cerrar la compra.
- Persisten en `localStorage` (`lapercha_ig_accounts` / `lapercha_ig_active`). La primera vez se siembran desde `instagramDefaultAccounts`; si la cuenta activa se elimina, se promueve automáticamente la primera restante.

### Clave de administración (enrolamiento one-time)

- No hay clave hardcodeada. La primera vez que entrás al panel, el sistema registra la clave que tipeás como hash **SHA-256 + salt** en `localStorage` (`lapercha_admin_cred`).
- Para cambiar la clave: borrá `lapercha_admin_cred` (o los datos del sitio) y volvé a entrar; la primera vez registra la nueva.
- Requiere **secure context** para `crypto.subtle`: funciona en `https` o en `localhost` (por eso el dev server corre en `http://localhost:3000`).

> Nota: el panel admin y el catálogo persisten en `localStorage` del navegador; es una validación/demo, no un backend.

## Ramas

- `main` — producción (protegida, requiere PR)
- `dev` — integración (protegida, requiere PR)

## Verificación

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/   # → 200
```