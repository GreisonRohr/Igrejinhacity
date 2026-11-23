# Cor real do telhado de cada prédio a partir da imagem aérea da Prefeitura (GEO Igrejinha 2016, 0,2 m/px).
# Uso: python3 scripts/build-roofs.py <imagem.tif> <arquivo.tfw>
# Saída: public/data/roofs.data.json  {gzip_base64: [cor RGB 0xRRGGBB ou -1 por prédio, na ordem de world.buildings]}
import sys, json, gzip, base64, math, importlib.util
import numpy as np
spec = importlib.util.spec_from_file_location('ortho', 'scripts/build-ortho.py')
# reaproveita projeção e leitura em blocos do build-ortho.py sem executar o recorte
src = open('scripts/build-ortho.py', encoding='utf8').read().split('CHm = round')[0]
sys.argv = [sys.argv[0], sys.argv[1], sys.argv[2], '1024', '0']
G = {}; exec(compile(src, 'build-ortho.py', 'exec'), G)
to_pix, region = G['to_pix'], G['region']

raw = json.load(open('public/data/world.data.json'))
world = json.loads(gzip.decompress(base64.b64decode(raw['gzip_base64'])))
out = []
for n, b in enumerate(world['buildings']):
    p = b['p']; cx = sum(q[0] for q in p) / len(p); cz = sum(q[1] for q in p) / len(p)
    pp = [to_pix(cx + (q[0] - cx) * 0.7, cz + (q[1] - cz) * 0.7) for q in p]   # 70%: longe da beira (sombra/calçada)
    xs = [q[0] for q in pp]; ys = [q[1] for q in pp]
    x0, y0, x1, y1 = int(min(xs)), int(min(ys)), int(max(xs)) + 1, int(max(ys)) + 1
    if x1 - x0 < 3 or y1 - y0 < 3 or x0 < 0 or y0 < 0 or x1 >= G['IW'] or y1 >= G['IH'] or (x1 - x0) * (y1 - y0) > 4_000_000:
        out.append(-1); continue
    img = region(x0, y0, x1 - x0, y1 - y0)
    # máscara do polígono (par-ímpar) em grade reduzida
    step = max(1, int(max(x1 - x0, y1 - y0) / 40))
    yy, xx = np.mgrid[y0:y1:step, x0:x1:step]
    inside = np.zeros(xx.shape, bool)
    for i in range(len(pp)):
        ax, ay = pp[i]; bx, by = pp[i - 1]
        cond = ((ay > yy) != (by > yy)) & (xx < (bx - ax) * (yy - ay) / ((by - ay) or 1e-9) + ax)
        inside ^= cond
    px = img[(yy - y0)[inside], (xx - x0)[inside]]
    px = px[px[:, 3] > 200][:, :3].astype(np.float32)
    if len(px) < 6: out.append(-1); continue
    lum = px.mean(1)
    px = px[(lum > np.percentile(lum, 25)) & (lum < np.percentile(lum, 95))]   # tira sombras e reflexos
    if len(px) < 4: out.append(-1); continue
    r, g, bl = np.median(px, 0)
    if g > r + 12 and g > bl + 8: out.append(-1); continue                       # árvore cobrindo o telhado
    out.append((int(r) << 16) | (int(g) << 8) | int(bl))
    if n % 3000 == 0: print(n, flush=True)
ok = sum(1 for c in out if c >= 0)
blob = base64.b64encode(gzip.compress(json.dumps(out).encode(), 9)).decode()
json.dump({'gzip_base64': blob}, open('public/data/roofs.data.json', 'w'))
print('prédios', len(out), 'com cor', ok)
