# Lista de arquivos para publicar um build (sem modelos sem licença confirmada e sem .glb/.fbx brutos): lista-publicacao.py <pasta>
import os, sys, json
d = os.path.abspath(sys.argv[1]); out = []
for root, _, fs in os.walk(d):
    for f in fs:
        p = os.path.join(root, f); rel = os.path.relpath(p, d)
        if rel.startswith(('models/extra/', 'models/hero/')) or f.endswith(('.glb', '.fbx')) or f.startswith('piloto-e'): continue
        out.append({'as': rel, 'path': p})
out.sort(key=lambda o: (o['as'] != 'index.html', o['as']))
print(json.dumps(out))
