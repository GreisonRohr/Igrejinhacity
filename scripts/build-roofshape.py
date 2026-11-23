# Formato do telhado de cada prédio pela imagem aérea (GEO Igrejinha 2016): o sol ilumina as águas de modo diferente.
# Divide o retângulo do prédio ao longo do eixo maior (A|B) e do menor (C|D) e compara o brilho das metades:
#   A≠B e C≈D → duas águas (cumeeira no eixo maior); A≠B e C≠D → quatro águas; tudo igual e liso → laje.
# Uso: python3 scripts/build-roofshape.py <imagem.tif> <arquivo.tfw>
# Saída: public/data/roofshape.data.json  {gzip_base64: [0 desconhecido | 1 laje | 2 duas águas | 3 quatro águas, ...]}
import sys, json, gzip, base64
import numpy as np
src = open('scripts/build-ortho.py', encoding='utf8').read().split('CHm = round')[0]
sys.argv = [sys.argv[0], sys.argv[1], sys.argv[2], '1024', '0']
G = {}; exec(compile(src, 'build-ortho.py', 'exec'), G)
to_pix, region = G['to_pix'], G['region']
raw = json.load(open('public/data/world.data.json'))
world = json.loads(gzip.decompress(base64.b64decode(raw['gzip_base64'])))
out = []; cnt = [0, 0, 0, 0]
for b in world['buildings']:
    r = b.get('rect')
    if not r: out.append(0); cnt[0] += 1; continue
    cx, cz, ux, uz, hu, hv = r
    if hu < hv: ux, uz, hu, hv = -uz, ux, hv, hu          # u = eixo maior
    vx, vz = -uz, ux
    if hv < 2 or hu * hv * 4 > 3000: out.append(0); cnt[0] += 1; continue
    # amostras em grade no retângulo (85% para fugir da beira)
    us = np.linspace(-hu * 0.85, hu * 0.85, 14); vs = np.linspace(-hv * 0.85, hv * 0.85, 10)
    U, V = np.meshgrid(us, vs)
    X = cx + U * ux + V * vx; Z = cz + U * uz + V * vz
    pts = [to_pix(x, z) for x, z in zip(X.ravel(), Z.ravel())]
    px = np.array(pts); x0, y0 = int(px[:, 0].min()) - 1, int(px[:, 1].min()) - 1
    x1, y1 = int(px[:, 0].max()) + 2, int(px[:, 1].max()) + 2
    if x0 < 0 or y0 < 0 or x1 >= G['IW'] or y1 >= G['IH']: out.append(0); cnt[0] += 1; continue
    img = region(x0, y0, x1 - x0, y1 - y0).astype(np.float32)
    s = img[(px[:, 1] - y0).astype(int), (px[:, 0] - x0).astype(int)]
    if (s[:, 3] < 200).mean() > 0.2: out.append(0); cnt[0] += 1; continue
    lum = s[:, :3].mean(1).reshape(V.shape); grn = (2 * s[:, 1] - s[:, 0] - s[:, 2]).reshape(V.shape)
    if (grn > 25).mean() > 0.3: out.append(0); cnt[0] += 1; continue      # árvore em cima
    A, B2 = lum[V > 0].mean(), lum[V < 0].mean()                           # lados da cumeeira (eixo maior)
    C, D = lum[U > hu * 0.3].mean(), lum[U < -hu * 0.3].mean()             # pontas
    mid = lum[np.abs(U) <= hu * 0.3].mean()
    dv, du = abs(A - B2), abs(C - D)
    endDark = abs((C + D) / 2 - mid)
    sd = lum.std()
    if dv < 6 and du < 6 and sd < 14: k = 1
    elif dv >= 8 and (du >= 8 or endDark >= 8): k = 3
    elif dv >= 8: k = 2
    else: k = 0
    out.append(k); cnt[k] += 1
blob = base64.b64encode(gzip.compress(json.dumps(out).encode(), 9)).decode()
json.dump({'gzip_base64': blob}, open('public/data/roofshape.data.json', 'w'))
print('desconhecido, laje, duas águas, quatro águas:', cnt)
