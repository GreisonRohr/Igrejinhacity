// Depois do build: cria uma cópia de cada modelo (.glb/.fbx) em JSON base64 (dist/models/**/<arquivo>.b64.json),
// para hospedagens que só servem tipos comuns (o artefato publicado). O jogo tenta a cópia JSON primeiro.
import fs from 'node:fs';
import path from 'node:path';
const walk = d => fs.readdirSync(d).flatMap(f => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
let n = 0;
const OUT = process.argv[2] || 'dist';
for (const f of walk(OUT + '/models')) if (/\.(glb|fbx)$/i.test(f)) { fs.writeFileSync(f + '.b64.json', JSON.stringify({ base64: fs.readFileSync(f).toString('base64') })); n++; }
console.log('modelos empacotados:', n);
