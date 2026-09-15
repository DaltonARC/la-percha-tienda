/* =========================================================
   test/server.test.mjs — integration tests para server.js (La Percha)

   Arranca server.js como child process con HOST=127.0.0.1 y un
   port libre, espera la línea de stdout "La Percha — tienda
   sirviéndose en http://...", extrae el port y corre fetch.
   ========================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/* ---------- helper: buscar un port libre ---------- */
function freePort() {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.unref();
    s.on("error", fail);
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port;
      s.close(() => ok(port));
    });
  });
}

/* ---------- helper: arrancar server.js ---------- */
function startServer(port) {
  return new Promise((ok, fail) => {
    const child = spawn("node", ["server.js"], {
      cwd: ROOT,
      env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let started = false;
    child.stdout.on("data", (buf) => {
      out += buf.toString();
      if (!started && out.includes("La Percha")) {
        started = true;
        ok({ child, port, baseUrl: `http://127.0.0.1:${port}` });
      }
    });
    child.stderr.on("data", (buf) => { out += buf.toString(); });
    child.on("error", fail);
    child.on("exit", (code) => {
      if (!started) fail(new Error(`server exited ${code}: ${out}`));
    });
  });
}

/* ---------- global ---------- */
let serverInfo;

before(async () => {
  const port = await freePort();
  serverInfo = await startServer(port);
});

after(() => {
  serverInfo?.child.kill("SIGTERM");
});

/* ---------- helpers ---------- */
async function req(path, opts = {}) {
  const r = await fetch(`${serverInfo.baseUrl}${path}`, {
    redirect: "manual",
    ...opts,
  });
  return r;
}

/* =========================================================
   Rutas abiertas (200)
   ========================================================= */
describe("Rutas 200", () => {
  it("GET / → 200", async () => {
    const r = await req("/");
    assert.equal(r.status, 200);
  });

  it("GET /js/main.js → 200", async () => {
    const r = await req("/js/main.js");
    assert.equal(r.status, 200);
  });

  it("GET /js/lib.mjs → 200", async () => {
    const r = await req("/js/lib.mjs");
    assert.equal(r.status, 200);
  });

  it("GET /css/styles.css → 200", async () => {
    const r = await req("/css/styles.css");
    assert.equal(r.status, 200);
  });
});

/* =========================================================
   MIME types correctos
   ========================================================= */
describe("Content-Type correcto", () => {
  it("/js/lib.mjs → text/javascript", async () => {
    const r = await req("/js/lib.mjs");
    assert.ok(r.headers.get("content-type").includes("text/javascript"));
  });

  it("/css/styles.css → text/css", async () => {
    const r = await req("/css/styles.css");
    assert.ok(r.headers.get("content-type").includes("text/css"));
  });
});

/* =========================================================
   Bloqueos 403 (archivos sensibles)
   ========================================================= */
describe("Bloqueos 403", () => {
  const blocked = [
    "/.git/config",
    "/.receipts/test.json",
    "/.gitignore",
    "/package.json",
    "/server.js",
    "/README.md",
    "/.env",
  ];

  for (const path of blocked) {
    it(`${path} → 403`, async () => {
      const r = await req(path);
      assert.equal(r.status, 403);
    });
  }

  it("dotfile anidado /css/.env-test → 403", async () => {
    const r = await req("/css/.env-test");
    assert.equal(r.status, 403);
  });
});

/* =========================================================
   404 en rutas inexistentes
   ========================================================= */
describe("404", () => {
  it("GET /js/no-existe.js → 404", async () => {
    const r = await req("/js/no-existe.js");
    assert.equal(r.status, 404);
  });

  it("GET /pagina-fantasma → 404", async () => {
    const r = await req("/pagina-fantasma");
    assert.equal(r.status, 404);
  });
});

/* =========================================================
   Seguridad — headers presentes en TODAS las respuestas
   ========================================================= */
describe("Headers de seguridad", () => {
  it("200 incluye X-Content-Type-Options: nosniff", async () => {
    const r = await req("/");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  });

  it("200 incluye X-Frame-Options: DENY", async () => {
    const r = await req("/");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
  });

  it("200 incluye Referrer-Policy", async () => {
    const r = await req("/");
    assert.equal(r.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  });

  it("403 incluye X-Content-Type-Options", async () => {
    const r = await req("/server.js");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  });

  it("404 incluye X-Frame-Options", async () => {
    const r = await req("/js/no-existe.js");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
  });
});
