# Árvores reais: copas detectadas na imagem aérea da Prefeitura (GEO Igrejinha 2016), já recortada em blocos por
# scripts/build-ortho.py (public/ortho). Vegetação = verde dominante (índice ExG), fora de prédios e ruas.
# Cada copa vira uma árvore no centro (máximo local da distância à borda), com raio da copa medido.
# Uso: python3 scripts/build-trees.py [raio m=2400] [máx árvores=9000]
# Requer: numpy, pillow, scipy.  Saída: public/data/trees.data.json  {gzip_base64: [[x, z, raio], ...]}
import sys, json, gzip, base64, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

RAD = float(sys.argv[1]) if len(sys.argv) > 1 else 2400
MAX = int(sys.argv[2]) if len(sys.argv) > 2 else 9000
ix = json.load(open('public/ortho/index.json'))
raw = json.load(open('public/data/world.data.json'))
world = json.loads(gzip.decompress(base64.b64decode(raw['gzip_base64'])))
trees = []
for t in ix['tiles']:
    if math.hypot((t['x0'] + t['x1']) / 2, (t['z0'] + t['z1']) / 2) > RAD + 400: continue
    im = Image.open('public/ortho/' + t['file']).convert('RGBA'); W, H = im.size
    a = np.asarray(im).astype(np.float32); r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mx = (t['x1'] - t['x0']) / W   # metros por pixel
    exg = 2 * g - r - b
    veg = (exg > 18) & (g > 45) & (al > 200) & (g > r) & (g > b * 0.95)
    # tira prédios e ruas (desenhados no mesmo sistema do bloco)
    mask = Image.new('L', (W, H), 0); d = ImageDraw.Draw(mask)
    P = lambda q: ((q[0] - t['x0']) / mx, (q[1] - t['z0']) / mx)
    for bd in world['buildings']:
        q = bd['p'][0]
        if t['x0'] - 60 < q[0] < t['x1'] + 60 and t['z0'] - 60 < q[1] < t['z1'] + 60: d.polygon([P(v) for v in bd['p']], fill=255)
    for rd in world['roads']:
        if not any(t['x0'] - 30 < v[0] < t['x1'] + 30 and t['z0'] - 30 < v[1] < t['z1'] + 30 for v in rd['p']): continue
        d.line([P(v) for v in rd['p']], fill=255, width=max(1, int(rd['w'] / mx)))
    veg &= np.asarray(mask) == 0
    veg = ndi.binary_opening(veg, iterations=2)
    veg = ndi.binary_closing(veg, iterations=2)
    lab, n = ndi.label(veg)
    if not n: continue
    sizes = ndi.sum(veg, lab, range(1, n + 1)) * mx * mx
    dist = ndi.distance_transform_edt(veg) * mx
    # copas: máximos locais da distância à borda, separados por ≥ 5 m, raio ≥ 1,6 m
    win = max(3, int(5 / mx))
    peaks = (dist == ndi.maximum_filter(dist, size=win)) & (dist > 1.6)
    ys, xs = np.nonzero(peaks)
    for y, x in zip(ys, xs):
        area = sizes[lab[y, x] - 1]
        if area < 8: continue
        gx, gz = t['x0'] + (x + 0.5) * mx, t['z0'] + (y + 0.5) * mx
        if math.hypot(gx, gz) > RAD: continue
        rr = float(min(7.5, dist[y, x] * 1.15))
        trees.append([round(gx, 1), round(gz, 1), round(rr, 1), 1 if area > 4000 else 0])   # 1 = mata (bloco grande)
# máximos colados (mesmo blob em bordas de bloco): fica o maior num raio de 4 m
trees.sort(key=lambda q: -q[2]); kept = []; grid = {}
for q in trees:
    k = (int(q[0] // 8), int(q[1] // 8))
    if any(math.hypot(o[0] - q[0], o[1] - q[1]) < max(4, (o[2] + q[2]) * 0.55) for i in (-1, 0, 1) for j in (-1, 0, 1) for o in grid.get((k[0] + i, k[1] + j), [])): continue
    kept.append(q); grid.setdefault(k, []).append(q)
# prioridade: árvores urbanas perto do centro; mata só depois
kept.sort(key=lambda q: (q[3], math.hypot(q[0], q[1])))
kept = kept[:MAX]
blob = base64.b64encode(gzip.compress(json.dumps(kept).encode(), 9)).decode()
json.dump({'gzip_base64': blob}, open('public/data/trees.data.json', 'w'))
print('copas', len(trees), 'árvores', len(kept), 'urbanas', sum(1 for q in kept if not q[3]))
