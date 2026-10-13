#!/usr/bin/env bash
# Exporta todas las tablas de la SuperLiga THC y los escudos de Supabase a archivos.
# Uso: bash scripts/backup.sh <carpeta-de-salida>
# Solo lee datos que ya son públicos en el sitio (misma clave pública que usa la web).
set -euo pipefail
SB_URL="${SB_URL:-https://thdwohtkvhbynodrnewr.supabase.co}"
SB_KEY="${SB_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZHdvaHRrdmhieW5vZHJuZXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0Njk4NzQsImV4cCI6MjEwNjA0NTg3NH0.VgExV9nwcyuVFPfTRhydbnE92D-nwzvgeKXKHa1gnKk}"
OUT="${1:-backup-out}"
DAY="$(TZ=America/Santiago date +%F)"
TABLES=(temporadas teams players matches cup_players cup_matches)
PAGE="${PAGE:-1000}"
H=(-H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY")
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT/datos/$DAY" "$OUT/escudos"

for t in "${TABLES[@]}"; do
  echo '[]' > "$TMP/acc.json"; from=0
  while :; do
    curl -fsS --retry 3 "$SB_URL/rest/v1/$t?select=*&order=id" "${H[@]}" \
      -H "Range-Unit: items" -H "Range: $from-$((from+PAGE-1))" > "$TMP/page.json"
    n=$(jq length "$TMP/page.json")
    jq -s '.[0]+.[1]' "$TMP/acc.json" "$TMP/page.json" > "$TMP/acc2.json" && mv "$TMP/acc2.json" "$TMP/acc.json"
    [ "$n" -lt "$PAGE" ] && break
    from=$((from+PAGE))
  done
  jq . "$TMP/acc.json" > "$OUT/datos/$DAY/$t.json"
  printf '%-12s %s filas\n' "$t" "$(jq length "$TMP/acc.json")"
done

# Si una tabla esencial viene vacía, algo anda mal: se corta antes de guardar un respaldo inútil.
for t in teams players matches; do
  [ "$(jq length "$OUT/datos/$DAY/$t.json")" -gt 0 ] || { echo "ERROR: la tabla $t vino vacía; no se guarda el respaldo." >&2; exit 1; }
done

curl -fsS --retry 3 -X POST "$SB_URL/storage/v1/object/list/team-logos" "${H[@]}" \
  -H 'Content-Type: application/json' -d '{"prefix":"","limit":1000}' > "$TMP/logos.json"
n=0
for f in $(jq -r '.[] | select(.id != null) | .name' "$TMP/logos.json"); do
  curl -fsS --retry 3 "$SB_URL/storage/v1/object/public/team-logos/$f" -o "$OUT/escudos/$f"; n=$((n+1))
done
echo "escudos     $n archivos"
echo "$DAY" > "$OUT/ULTIMO.txt"
