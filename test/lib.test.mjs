/* =========================================================
   test/lib.test.mjs — unit tests para js/lib.mjs (La Percha)

   IMPORTANTE: lib.mjs usa el global `localStorage` del browser.
   Estos tests inyectan un stub en globalThis.localStorage ANTES
   de importar el módulo (patrón requerido).
   ========================================================= */
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

/* ---------- stub de localStorage (en memoria) ---------- */
function makeStorage(){
  const store = new Map();
  return {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length(){ return store.size; },
  };
}

globalThis.localStorage = makeStorage();

/* importar el módulo con los helpers a testear */
const {
  LS_IG_ACCOUNTS,
  normalizeUsername,
  isValidInstagramUsername,
  isValidInstagramAccountId,
  seedInstagramAccounts,
  loadInstagramAccounts,
  saveInstagramAccounts,
  loadJSONStrict,
  money,
  hashPasscode,
} = await import("../js/lib.mjs");

beforeEach(() => { localStorage.clear(); });
after(() => { delete globalThis.localStorage; });

/* =========================================================
   loadJSONStrict
   ========================================================= */
test("loadJSONStrict: null → escribe el fallback y lo devuelve", () => {
  const fallback = [{ a: 1 }];
  const out = loadJSONStrict("k1", fallback);
  assert.deepEqual(out, fallback);
  assert.equal(localStorage.getItem("k1"), JSON.stringify(fallback));
});

test("loadJSONStrict: fallback no muta el array original", () => {
  const fallback = [{ a: 1 }];
  const out = loadJSONStrict("k2", fallback);
  assert.deepEqual(fallback, [{ a: 1 }]);
  assert.notEqual(out, fallback);
});

test("loadJSONStrict: JSON válido → devuelve el array parseado", () => {
  localStorage.setItem("k3", JSON.stringify([1, 2, 3]));
  assert.deepEqual(loadJSONStrict("k3", []), [1, 2, 3]);
});

test("loadJSONStrict: corrupto → fallback y sobreescribe", () => {
  localStorage.setItem("k4", "{not valid json!!");
  const out = loadJSONStrict("k4", ["x"]);
  assert.deepEqual(out, ["x"]);
  assert.equal(localStorage.getItem("k4"), JSON.stringify(["x"]));
});

test("loadJSONStrict: JSON válido pero no-array → fallback y sobreescribe", () => {
  localStorage.setItem("k5", JSON.stringify({ obj: true }));
  const out = loadJSONStrict("k5", [42]);
  assert.deepEqual(out, [42]);
  assert.equal(localStorage.getItem("k5"), JSON.stringify([42]));
});

test("loadJSONStrict: [] guardado → devuelve [] (no re-siembra)", () => {
  localStorage.setItem("k6", "[]");
  assert.deepEqual(loadJSONStrict("k6", ["fallback"]), []);
  assert.equal(localStorage.getItem("k6"), "[]");
});

/* =========================================================
   normalizeUsername
   ========================================================= */
test("normalizeUsername: recorta espacios", () => {
  assert.equal(normalizeUsername("  janicegp18  "), "janicegp18");
});

test("normalizeUsername: quita el @ inicial", () => {
  assert.equal(normalizeUsername("@janicegp18"), "janicegp18");
});

test("normalizeUsername: pasa a minúsculas", () => {
  assert.equal(normalizeUsername("JaniceGP18"), "janicegp18");
});

test("normalizeUsername: elimina espacios internos", () => {
  assert.equal(normalizeUsername("ja nice gp 18"), "janicegp18");
});

test("normalizeUsername: undefined/null → string vacío", () => {
  assert.equal(normalizeUsername(undefined), "");
  assert.equal(normalizeUsername(null), "");
  assert.equal(normalizeUsername(""), "");
});

/* =========================================================
   isValidInstagramUsername
   ========================================================= */
test("isValidInstagramUsername: válidos (a-z 0-9 . _)", () => {
  assert.equal(isValidInstagramUsername("janicegp18"), true);
  assert.equal(isValidInstagramUsername("a".repeat(30)), true);
  assert.equal(isValidInstagramUsername("user.name_01"), true);
  assert.equal(isValidInstagramUsername("A".repeat(30)), true);
});

test("isValidInstagramUsername: >30 chars → inválido", () => {
  assert.equal(isValidInstagramUsername("a".repeat(31)), false);
});

test("isValidInstagramUsername: espacios → inválido", () => {
  assert.equal(isValidInstagramUsername("janice gp18"), false);
});

test("isValidInstagramUsername: !@# → inválido", () => {
  assert.equal(isValidInstagramUsername("jani!ce"), false);
  assert.equal(isValidInstagramUsername("j@nice"), false);
  assert.equal(isValidInstagramUsername("ja#nice"), false);
});

test("isValidInstagramUsername: vacío → inválido", () => {
  assert.equal(isValidInstagramUsername(""), false);
  assert.equal(isValidInstagramUsername("   "), false);
});

// HALLAZGO #1: isValidInstagramUsername coercee no-string a string via .test().
//   123 → "123" (válido), null → "null" (válido), undefined → "undefined" (válido).
//   Esto es correcto en la práctica porque el flujo real siempre llama
//   normalizeUsername() antes (que retorna string). Documentado aquí como
//   comportamiento actual, no como bug.
test("isValidInstagramUsername: no-string → coerceido a string por .test() (comportamiento documentado)", () => {
  assert.equal(isValidInstagramUsername(123), true);
  assert.equal(isValidInstagramUsername(null), true);
  assert.equal(isValidInstagramUsername(undefined), true);
});

/* =========================================================
   isValidInstagramAccountId
   ========================================================= */
test("isValidInstagramAccountId: ig_seed e ig_<ts> válidos", () => {
  assert.equal(isValidInstagramAccountId("ig_seed"), true);
  assert.equal(isValidInstagramAccountId("ig_1715600000000"), true);
  assert.equal(isValidInstagramAccountId("ig_abc-123:xyz_1"), true);
});

test("isValidInstagramAccountId: espacios → inválido", () => {
  assert.equal(isValidInstagramAccountId("ig _seed"), false);
  assert.equal(isValidInstagramAccountId("ig seed"), false);
});

test("isValidInstagramAccountId: vacío / demasiado largo → inválido", () => {
  assert.equal(isValidInstagramAccountId(""), false);
  assert.equal(isValidInstagramAccountId("a".repeat(65)), false);
});

test("isValidInstagramAccountId: no-string → inválido", () => {
  assert.equal(isValidInstagramAccountId(123), false);
  assert.equal(isValidInstagramAccountId(null), false);
  assert.equal(isValidInstagramAccountId(undefined), false);
});

/* =========================================================
   seed / load / save InstagramAccounts
   ========================================================= */
const DEFAULT_ACCOUNTS = [{ id: "ig_seed", username: "janicegp18" }];

test("seedInstagramAccounts: sin datos → siembra y persiste", () => {
  const seeded = seedInstagramAccounts(DEFAULT_ACCOUNTS);
  const stored = JSON.parse(localStorage.getItem(LS_IG_ACCOUNTS));
  assert.deepEqual(seeded, [{ id: "ig_seed", username: "janicegp18" }]);
  assert.deepEqual(stored, seeded);
});

test("seedInstagramAccounts: filtra entradas inválidas y normaliza", () => {
  const out = seedInstagramAccounts([
    { id: "ig_seed", username: "@JaniceGP18 " },
    { id: "ig_123", username: "valid.user" },
    { id: "ig_456", username: "no good!" },   // username inválido → filtrado
    { id: "bad id!", username: "janice" },    // id inválido → filtrado
  ]);
  assert.deepEqual(out, [
    { id: "ig_seed", username: "janicegp18" },
    { id: "ig_123", username: "valid.user" },
  ]);
});

test("loadInstagramAccounts: sin datos → siembra con los default", () => {
  const loaded = loadInstagramAccounts(DEFAULT_ACCOUNTS);
  assert.deepEqual(loaded, [{ id: "ig_seed", username: "janicegp18" }]);
  assert.notEqual(localStorage.getItem(LS_IG_ACCOUNTS), null);
});

test("loadInstagramAccounts: datos válidos guardados → los devuelve normalizados", () => {
  saveInstagramAccounts([{ id: "ig_999", username: " @New User1 " }]);
  const loaded = loadInstagramAccounts(DEFAULT_ACCOUNTS);
  assert.deepEqual(loaded, [{ id: "ig_999", username: "newuser1" }]);
});

test("loadInstagramAccounts: corrupto → re-siembra los default", () => {
  localStorage.setItem(LS_IG_ACCOUNTS, "{corrupt!!");
  const loaded = loadInstagramAccounts(DEFAULT_ACCOUNTS);
  assert.deepEqual(loaded, [{ id: "ig_seed", username: "janicegp18" }]);
  assert.deepEqual(JSON.parse(localStorage.getItem(LS_IG_ACCOUNTS)), loaded);
});

test("loadInstagramAccounts: JSON no-array (objeto) → re-siembra", () => {
  localStorage.setItem(LS_IG_ACCOUNTS, JSON.stringify({ no: "array" }));
  const loaded = loadInstagramAccounts(DEFAULT_ACCOUNTS);
  assert.deepEqual(loaded, [{ id: "ig_seed", username: "janicegp18" }]);
});

/* =========================================================
   money
   ========================================================= */
test("money: formatea con separador de miles (es-DO)", () => {
  assert.equal(money(1500, "RD$"), "RD$ 1,500");
  assert.equal(money(0, "RD$"), "RD$ 0");
  assert.equal(money(1234567, "RD$"), "RD$ 1,234,567");
});

/* =========================================================
   hashPasscode (SHA-256 + salt)
   ========================================================= */
test("hashPasscode: devuelve hex de 64 chars (SHA-256)", async () => {
  const hash = await hashPasscode("secreto", "sal");
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("hashPasscode: determinista para el mismo pass+salt", async () => {
  const h1 = await hashPasscode("abc123", "salt-1");
  const h2 = await hashPasscode("abc123", "salt-1");
  assert.equal(h1, h2);
});

test("hashPasscode: distinto salt → hash distinto", async () => {
  const h1 = await hashPasscode("abc123", "salt-1");
  const h2 = await hashPasscode("abc123", "salt-2");
  assert.notEqual(h1, h2);
});

test("hashPasscode: distinto pass → hash distinto", async () => {
  const h1 = await hashPasscode("pass-A", "salt-x");
  const h2 = await hashPasscode("pass-B", "salt-x");
  assert.notEqual(h1, h2);
});

/* =========================================================
   Enroll/Verify (helpers de main.js — se testean si existen)
   ========================================================= */
test("verify: hash contratado se puede verificar con el mismo pass (flujo enroll/verify)", async () => {
  const salt = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const hash = await hashPasscode("mi-clave", salt);
  const verify = await hashPasscode("mi-clave", salt);
  assert.equal(verify, hash);
  const wrong = await hashPasscode("otra-clave", salt);
  assert.notEqual(wrong, hash);
});