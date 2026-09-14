#!/usr/bin/env bash
# Smoke test del issue #9 — server hardening.
# Verifica que el server (npm start) sirve solo lo permitido y no expone archivos sensibles.
# Dependencias: curl, ss, grep (sin dependencias externas).
set -u

BASE="http://127.0.0.1:3000"
FAILURES=0

code() {
  curl -s -o /dev/null -w '%{http_code}' "$1"
}

check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf 'PASS  %-42s → %s\n' "$desc" "$actual"
  else
    printf 'FAIL  %-42s → %s (esperado %s)\n' "$desc" "$actual" "$expected"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "== Rutas públicas (200) =="
check "/"                  200 "$(code "$BASE/")"
check "/js/main.js"        200 "$(code "$BASE/js/main.js")"
check "/css/styles.css"    200 "$(code "$BASE/css/styles.css")"

echo "== Archivos sensibles / dotfiles (403) =="
check "/.git/config"          403 "$(code "$BASE/.git/config")"
check "/.receipts/venta.json" 403 "$(code "$BASE/.receipts/venta.json")"
check "/.gitignore"           403 "$(code "$BASE/.gitignore")"
check "/package.json"         403 "$(code "$BASE/package.json")"
check "/server.js"            403 "$(code "$BASE/server.js")"
check "/README.md"            403 "$(code "$BASE/README.md")"

echo "== Dotfiles ANIDADOS (403, no 200) =="
# Archivos de prueba temporales: se crean, se verifican y se borran con trap.
TMP_NESTED_FILES="css/.env-test js/.DS_Store-test"
cleanup() {
  rm -f $TMP_NESTED_FILES
}
trap cleanup EXIT
mkdir -p css js
printf 'secret-env' > css/.env-test
printf 'DS_Store-junk' > js/.DS_Store-test

check "/css/.env-test"      403 "$(code "$BASE/css/.env-test")"
check "/js/.DS_Store-test"  403 "$(code "$BASE/js/.DS_Store-test")"

# Verificación extra: el contenido NO debe llegar al cliente (nunca 200 + body).
for leaked in "/css/.env-test" "/js/.DS_Store-test"; do
  BODY="$(curl -s "$BASE$leaked")"
  case "$BODY" in
    *secret-env*|*DS_Store-junk*)
      printf 'FAIL  %-42s → contenido filtrado en el body\n' "$leaked"
      FAILURES=$((FAILURES + 1))
      ;;
    *)
      printf 'PASS  %-42s → sin fuga de contenido en el body\n' "$leaked"
      ;;
  esac
done

cleanup
trap - EXIT
[ ! -e css/.env-test ] && [ ! -e js/.DS_Store-test ] && printf 'PASS  cleanup de archivos de prueba (css/.env-test, js/.DS_Store-test)\n' \
  || { printf 'FAIL  cleanup: quedaron archivos de prueba en el working tree\n'; FAILURES=$((FAILURES + 1)); }

echo "== Rutas permitidas que no existen (404) =="
check "/no-existe.html"       404 "$(code "$BASE/no-existe.html")"
check "/favicon.ico"          404 "$(code "$BASE/favicon.ico")"

echo "== Traversal (nunca 200) =="
TRAVERSAL="$(curl -s --path-as-is -o /dev/null -w '%{http_code}' "$BASE/../package.json")"
if [ "$TRAVERSAL" != "200" ]; then
  printf 'PASS  /../package.json (--path-as-is) → %s (no 200)\n' "$TRAVERSAL"
else
  printf 'FAIL  /../package.json → 200 (traversal expone el repo)\n'
  FAILURES=$((FAILURES + 1))
fi

echo "== Headers de seguridad en / =="
HEADERS="$(curl -s -D - -o /dev/null "$BASE/")"
HEADERS_OK=1
for header in "x-content-type-options: nosniff" "x-frame-options: deny" "referrer-policy: strict-origin-when-cross-origin"; do
  if printf '%s' "$HEADERS" | grep -qi "$header"; then
    printf 'PASS  header %s\n' "$header"
  else
    printf 'FAIL  header %s no presente\n' "$header"
    HEADERS_OK=0
  fi
done
[ "$HEADERS_OK" -eq 1 ] || FAILURES=$((FAILURES + 1))

echo "== Bind 127.0.0.1:3000 (NO *:3000) =="
ss -tlnp | grep 3000
if ss -tlnp | grep -q '127.0.0.1:3000' && ! ss -tlnp | grep -qE '(\*|0\.0\.0\.0|\[::\]):3000'; then
  printf 'PASS  bind exclusivo 127.0.0.1:3000\n'
else
  printf 'FAIL  bind no es exclusivo de 127.0.0.1:3000\n'
  FAILURES=$((FAILURES + 1))
fi

echo "== Resultado =="
if [ "$FAILURES" -gt 0 ]; then
  printf 'RESULTADO: FAIL (%s chequeo(s) fallaron)\n' "$FAILURES"
  exit 1
fi
printf 'RESULTADO: OK (todos los chequeos pasaron)\n'