// Dev server estático sin dependencias — sirve index.html y assets con MIME correcto.
// Uso: npm start  (o: node server.js)  →  http://127.0.0.1:3000
import { createServer } from "node:http";
import { access, readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || 3000;

// Únicas rutas servidas: raíz (→ index.html), index.html, css/, js/ y favicon.ico.
const ALLOWED = ["/", "/index.html", "/css/", "/js/", "/favicon.ico"];
// Prefijos de directorio servibles (derivados de ALLOWED: "/css/", "/js/").
const DIR_PREFIXES = ALLOWED.filter((entry) => entry.length > 1 && entry.endsWith("/"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

// Headers mínimos de seguridad en todas las respuestas (200/403/404).
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

    // Guard 1 — dotfiles: CUALQUIER segmento con "." (`.git`, `.receipts`, `.gitignore`, `css/.env-test`, ...) → 403 sin leer archivo.
    const segments = urlPath.split("/").filter(Boolean);
    if (segments.some((segment) => segment.startsWith("."))) {
      send(res, 403, "403 Forbidden");
      return;
    }

    // Guard 3 — traversal (defensa en profundidad; new URL ya normaliza "..", pero nunca está de más).
    const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    const filePath = normalize(join(root, rel));
    if (!filePath.startsWith(root)) {
      send(res, 403, "403 Forbidden");
      return;
    }

    // Guard 2 — allowlist: match exacto (/, /index.html, /favicon.ico) o prefijo de directorio (/css/, /js/).
    const allowed = ALLOWED.includes(urlPath) || DIR_PREFIXES.some((prefix) => urlPath.startsWith(prefix));
    if (!allowed) {
      // Fuera de la allowlist: existe → 403 (no servible); no existe → 404. Nunca se sirve contenido.
      try {
        await access(filePath);
      } catch {
        send(res, 404, "404 Not Found");
        return;
      }
      send(res, 403, "403 Forbidden");
      return;
    }

    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream", ...SECURITY_HEADERS });
    res.end(data);
  } catch {
    // ENOENT (no existe) o cualquier otro error tras pasar los guards → 404 genérico, sin filtrar qué existe.
    send(res, 404, "404 Not Found");
  }
}).listen(port, host, () => {
  console.log(`La Percha — tienda sirviéndose en http://${host}:${port}`);
});
