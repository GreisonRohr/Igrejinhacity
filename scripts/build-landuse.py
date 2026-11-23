# Mapa de uso do solo para o chão do jogo: "Uso e Ocupação do Solo 2023 - PMMA" (GEO Igrejinha, camada 10129).
# Rasteriza as áreas (mata, vegetação rasteira, solo exposto, água, silvicultura) na extensão do terreno.
# Uso: python3 scripts/build-landuse.py [altura px=2048]   (antes: node scripts/fetch-usosolo.mjs)
# Saída: public/data/landuse.webp (RGBA; transparente onde não há dado)
import sys, json, math
from PIL import Image, ImageDraw
HPX = int(sys.argv[1]) if len(sys.argv) > 1 else 2048
meta = json.load(open('public/data/terrain.json'))
W_m, H_m = (meta['nx'] - 1) * meta['cell'], (meta['nz'] - 1) * meta['cell']
WPX = round(HPX * W_m / H_m)
OLAT, OLON = -29.5730284, -50.7919383
R, D2R = 6378137, math.pi / 180
KX, KZ = math.cos(OLAT * D2R) * R * D2R, R * D2R
def px(lon, lat):
    x, z = (lon - OLON) * KX, -(lat - OLAT) * KZ
    return ((x - meta['x0']) / W_m * WPX, (z - meta['z0']) / H_m * HPX)
COL = {'Formações florestais': (46, 78, 38, 235), 'Silvicultura': (58, 84, 44, 235), 'Vegetação rasteira': (122, 150, 74, 220),
       'Solo exposto': (166, 146, 108, 210), 'Água': (63, 120, 160, 200), 'Urbanização': (0, 0, 0, 0)}
ORDER = ['Vegetação rasteira', 'Solo exposto', 'Silvicultura', 'Formações florestais', 'Água']
j = json.load(open('data/raw/geoigrejinha/uso_solo_2023.geojson'))
im = Image.new('RGBA', (WPX, HPX), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
for cls in ORDER:
    for f in j['features']:
        if f['properties'].get('Classe Uso') != cls or not f['geometry']: continue
        g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            d.polygon([px(*q[:2]) for q in poly[0]], fill=COL[cls])
            for hole in poly[1:]: d.polygon([px(*q[:2]) for q in hole], fill=(0, 0, 0, 0))
im.save('public/data/landuse.webp', 'WEBP', quality=80, alpha_quality=70, method=5)
import os; print(WPX, HPX, os.path.getsize('public/data/landuse.webp') // 1024, 'KB')
