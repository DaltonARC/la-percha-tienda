/* =========================================================
   lib.mjs — funciones puras / helpers de La Percha

   ES module SIN dependencias de DOM. Se puede importar desde
   Node (node:test) y desde el browser (js/main.js se carga como
   module y lo importa).

   Nota sobre localStorage: loadJSONStrict / seedInstagramAccounts /
   loadInstagramAccounts / saveInstagramAccounts usan `localStorage`
   (API del browser). Se mantienen acá porque la LÓGICA es la que se
   quiere testear; los tests en Node deben inyectar un stub del
   global `localStorage` antes de importar este módulo.
   ========================================================= */

export const LS_IG_ACCOUNTS = "lapercha_ig_accounts";

/* =========================================================
   CUENTAS DE INSTAGRAM — destino del checkout
   (seed desde las cuentas por defecto al primer arranque;
   se gestionan desde el panel admin)
   ========================================================= */
export function normalizeUsername(raw){
  return String(raw || "").trim().replace(/^@/, "").replace(/\s+/g, "").toLowerCase();
}
export function isValidInstagramUsername(u){
  return /^[A-Za-z0-9._]{1,30}$/.test(u);
}
export function isValidInstagramAccountId(id){
  // los ids se generan internamente (ig_seed / ig_<timestamp>); validar acá
  // evita que un id manipulado en localStorage rompa los onclick del panel
  return typeof id === "string" && /^[A-Za-z0-9_:-]{1,64}$/.test(id);
}
export function seedInstagramAccounts(defaultAccounts){
  const seed = defaultAccounts
    .map(a => ({ id: a.id, username: normalizeUsername(a.username) }))
    .filter(a => isValidInstagramAccountId(a.id) && isValidInstagramUsername(a.username));
  localStorage.setItem(LS_IG_ACCOUNTS, JSON.stringify(seed));
  return seed;
}
export function loadInstagramAccounts(defaultAccounts){
  // Delegar la persistencia/saneamiento a loadJSONStrict (helper genérico del PR #10).
  // - sin datos / JSON corrupto / no-array → loadJSONStrict devuelve [] (fallback)
  // - datos válidos (array) → devuelve el array parseado para normalizar/filtrar acá
  const raw = localStorage.getItem(LS_IG_ACCOUNTS);
  const parsed = loadJSONStrict(LS_IG_ACCOUNTS, []);
  let accounts;
  // Un array JSON válido puede traer elementos null/undefined (ej: "[null]"):
  // el .map() lanzaría TypeError no capturado y crashearía main.js (carga de módulo).
  // En el catch asignamos [] para que el branch de abajo re-siembre defaults
  // (contrato del código viejo: catch genérico que re-sembraba). NO usar `return []`
  // acá: un early-return cortaría antes de la re-siembra.
  try{
    accounts = parsed
      .map(a => ({ id: a.id, username: normalizeUsername(a.username) }))
      .filter(a => isValidInstagramAccountId(a.id) && isValidInstagramUsername(a.username));
  }catch(e){
    accounts = []; // elemento inválido → re-siembra defaults abajo
  }
  // Contrato del código viejo: "[]" guardado es vacío legítimo (admin borró todas
  // las cuentas) y se respeta sin re-sembrar. Cualquier otro resultado vacío
  // (elementos inválidos, basura, sin datos) re-siembra defaults.
  if(accounts.length === 0 && raw === "[]") return [];
  if(accounts.length === 0) return seedInstagramAccounts(defaultAccounts);
  return accounts;
}
export function saveInstagramAccounts(list){ localStorage.setItem(LS_IG_ACCOUNTS, JSON.stringify(list)); }

/* =========================================================
   PERSISTENCIA — saneamiento de localStorage
   ========================================================= */
export function loadJSONStrict(key, fallback){
  const raw = localStorage.getItem(key);
  if(raw === null){
    localStorage.setItem(key, JSON.stringify(fallback));
    return [...fallback];
  }
  let parsed;
  try{ parsed = JSON.parse(raw); }
  catch(e){ parsed = null; }
  if(!Array.isArray(parsed)){
    localStorage.setItem(key, JSON.stringify(fallback));
    return [...fallback];
  }
  return parsed;
}

/* =========================================================
   FORMATO DE DINERO
   ========================================================= */
export function money(cents, currency){ return currency + " " + (cents).toLocaleString("es-DO"); }

/* =========================================================
   ADMIN — hash de passcode (SHA-256 + salt)
   Requiere secure context (https o localhost) para crypto.subtle.
   ========================================================= */
export async function hashPasscode(pass, salt){
  const data = new TextEncoder().encode(salt + pass);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}