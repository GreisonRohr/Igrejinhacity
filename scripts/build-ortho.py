# Recorta a imagem aérea da Prefeitura (GEO Igrejinha, "Imagem Aérea Igrejinha 2016", 0,2 m/px, SIRGAS 2000 UTM 22S)
# em texturas por bloco de terreno (640 m), reprojetadas para as coordenadas do jogo.
# Fonte: https://sites.google.com/view/geoigrejinha/dados-para-download (uso autorizado pelo diretor em 23/11/2026).
# O TIFF usa JPEG com 4 canais em blocos de 256 px, que o libvips/sharp não decodifica; aqui usamos tifffile.
# Uso: python3 scripts/build-ortho.py <imagem.tif> <arquivo.tfw> [px por bloco=1024] [raio m=2600]
# Requer: pip install tifffile imagecodecs numpy pillow.  Saída: public/ortho/<ci>_<cj>.webp + index.json
import sys, os, json, math
import numpy as np, tifffile
from PIL import Image

tif, tfw = sys.argv[1], sys.argv[2]
PX = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
RAD = float(sys.argv[4]) if len(sys.argv) > 4 else 2600
OUT = 'public/ortho'; os.makedirs(OUT, exist_ok=True)
meta = json.load(open('public/data/terrain.json'))
A, _, _, E, E0, N0 = [float(v) for v in open(tfw).read().split()]

# mesma projeção local do jogo (src/geo.js)
OLAT, OLON = -29.5730284, -50.7919383
R, D2R = 6378137, math.pi / 180
KX, KZ = math.cos(OLAT * D2R) * R * D2R, R * D2R
def to_latlon(x, z): return OLAT - z / KZ, OLON + x / KX
def utm(lat, lon):
    a, f, k0 = 6378137, 1 / 298.257222101, 0.9996
    e2 = f * (2 - f); ep2 = e2 / (1 - e2); lon0 = -51 * D2R
    p, l = lat * D2R, lon * D2R
    N = a / math.sqrt(1 - e2 * math.sin(p) ** 2); T = math.tan(p) ** 2; C = ep2 * math.cos(p) ** 2; Aa = math.cos(p) * (l - lon0)
    M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * p)
             + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * p) - (35 * e2 ** 3 / 3072) * math.sin(6 * p))
    x = k0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Aa ** 5 / 120) + 500000
    y = k0 * (M + N * math.tan(p) * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Aa ** 6 / 720)) + 10000000
    return x, y
def to_pix(x, z):
    e_, n_ = utm(*to_latlon(x, z)); return (e_ - E0) / A, (n_ - N0) / E

tf = tifffile.TiffFile(tif); page = tf.pages[0]
IH, IW = page.shape[0], page.shape[1]; TW, TH = page.tilewidth, page.tilelength
tiles_x = (IW + TW - 1) // TW; fh = tf.filehandle
cache = {}
def tile(tx, ty):
    k = (tx, ty)
    if k not in cache:
        i = ty * tiles_x + tx; fh.seek(page.dataoffsets[i]); data = fh.read(page.databytecounts[i])
        try: t = page.decode(data, i, jpegtables=page.jpegtables)[0][0]
        except Exception: t = np.zeros((TH, TW, 4), np.uint8)
        if len(cache) > 4000: cache.clear()
        cache[k] = t
    return cache[k]
def region(x0, y0, w, h):
    out = np.zeros((h, w, 4), np.uint8)
    for ty in range(max(0, y0 // TH), min((IH - 1) // TH, (y0 + h - 1) // TH) + 1):
        for tx in range(max(0, x0 // TW), min((IW - 1) // TW, (x0 + w - 1) // TW) + 1):
            t = tile(tx, ty); gx, gy = tx * TW, ty * TH
            sx0, sy0 = max(x0, gx), max(y0, gy); sx1, sy1 = min(x0 + w, gx + TW, IW), min(y0 + h, gy + TH, IH)
            if sx1 > sx0 and sy1 > sy0: out[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = t[sy0 - gy:sy1 - gy, sx0 - gx:sx1 - gx]
    return out

CHm = round(640 / meta['cell']) * meta['cell']; W = (meta['nx'] - 1) * meta['cell']; H = (meta['nz'] - 1) * meta['cell']
ncx, ncz = math.ceil(W / CHm), math.ceil(H / CHm); index = []
uu = (np.arange(PX) + 0.5) / PX; FU, FV = np.meshgrid(uu, uu)
for cj in range(ncz):
    for ci in range(ncx):
        x0 = meta['x0'] + ci * CHm; z0 = meta['z0'] + cj * CHm; x1 = min(x0 + CHm, meta['x0'] + W); z1 = min(z0 + CHm, meta['z0'] + H)
        if math.hypot((x0 + x1) / 2, (z0 + z1) / 2) > RAD: continue
        c = [to_pix(x0, z0), to_pix(x1, z0), to_pix(x0, z1), to_pix(x1, z1)]
        px0 = int(math.floor(min(q[0] for q in c))) - 2; py0 = int(math.floor(min(q[1] for q in c))) - 2
        px1 = int(math.ceil(max(q[0] for q in c))) + 2; py1 = int(math.ceil(max(q[1] for q in c))) + 2
        if px1 < 0 or py1 < 0 or px0 >= IW or py0 >= IH: continue
        src = region(px0, py0, px1 - px0, py1 - py0)
        # reduz a ~2x a resolução final antes de reamostrar (antisserrilhado)
        f = max(1, int((px1 - px0) / (PX * 2)))
        if f > 1:
            hh, ww = src.shape[0] // f * f, src.shape[1] // f * f
            src = src[:hh, :ww].reshape(hh // f, f, ww // f, f, 4).mean(axis=(1, 3))
        src = src.astype(np.float32)
        X = (c[0][0] * (1 - FU) + c[1][0] * FU) * (1 - FV) + (c[2][0] * (1 - FU) + c[3][0] * FU) * FV
        Y = (c[0][1] * (1 - FU) + c[1][1] * FU) * (1 - FV) + (c[2][1] * (1 - FU) + c[3][1] * FU) * FV
        sx = (X - px0) / f - 0.5; sy = (Y - py0) / f - 0.5
        ix = np.clip(np.floor(sx).astype(int), 0, src.shape[1] - 2); iy = np.clip(np.floor(sy).astype(int), 0, src.shape[0] - 2)
        tx = np.clip(sx - ix, 0, 1)[..., None]; ty = np.clip(sy - iy, 0, 1)[..., None]
        out = (src[iy, ix] * (1 - tx) + src[iy, ix + 1] * tx) * (1 - ty) + (src[iy + 1, ix] * (1 - tx) + src[iy + 1, ix + 1] * tx) * ty
        out = np.clip(out, 0, 255).astype(np.uint8)
        cover = float((out[..., 3] > 200).mean())
        if cover < 0.05: continue
        name = f'{ci}_{cj}.webp'
        Image.fromarray(out, 'RGBA').save(f'{OUT}/{name}', 'WEBP', quality=72, alpha_quality=60, method=5)
        index.append({'ci': ci, 'cj': cj, 'x0': x0, 'z0': z0, 'x1': x1, 'z1': z1, 'file': name, 'cover': round(cover, 2)})
        print(name, os.path.getsize(f'{OUT}/{name}') // 1024, 'KB cobertura', round(cover, 2), flush=True)
json.dump({'fonte': 'GEO Igrejinha — Imagem Aérea Igrejinha 2016 (Prefeitura de Igrejinha)', 'px': PX, 'chunk': CHm, 'tiles': index}, open(f'{OUT}/index.json', 'w'))
print(len(index), 'blocos;', round(sum(os.path.getsize(f"{OUT}/{t['file']}") for t in index) / 1048576, 1), 'MB')
