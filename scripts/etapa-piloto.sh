#!/bin/sh
# Gera uma etapa do piloto das quadras: dados + navegação + build de teste (dist, com ?piloto) + build experimental
# (dist-piloto-e<n>, piloto ligado). Uso: sh scripts/etapa-piloto.sh <n>
set -e
N=$1
PILOTO_ETAPA=$N node scripts/build-piloto.mjs | grep -E "^ETAPA|VALID|eixo fora|pista dentro|calçada dentro|perímetro|trapézios"
cp public/data/piloto.data.json public/data/piloto-e$N.data.json
PILOTO=1 node scripts/build-nav.mjs > /dev/null
npx vite build --logLevel error && node scripts/pack-models.mjs > /dev/null
rm -rf dist-piloto-e$N && VITE_PILOTO=1 npx vite build --logLevel error --outDir dist-piloto-e$N && node scripts/pack-models.mjs dist-piloto-e$N > /dev/null
echo "etapa $N pronta: dist (teste com ?piloto) e dist-piloto-e$N"
