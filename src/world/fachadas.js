// Fachadas do centro (padrão de qualidade): letreiros legíveis das lojas, cores dos sobrados históricos, sacadas.
// Os nomes reais vêm do cadastro de lugares (OSM/Overture/GEO); onde não há nome, um tipo de comércio genérico
// (sem inventar empresas). Atlas único de letreiros: 1 textura, 1 chamada de desenho por região.
import * as THREE from 'three';

// tipos de comércio comuns no centro de cidade pequena do RS (sem marcas)
const TIPOS = ['FARMÁCIA', 'CALÇADOS', 'ÓTICA', 'LANCHERIA', 'PADARIA', 'MODA', 'PRESENTES', 'CAFÉ', 'FERRAGEM', 'SALÃO',
  'ELETRO', 'CONFEITARIA', 'MERCADO', 'PAPELARIA', 'SORVETERIA', 'CELULARES', 'IMOBILIÁRIA', 'ARMARINHO', 'PET SHOP', 'RELOJOARIA'];
const CORES = [['#c62828', '#fff'], ['#1565c0', '#fff'], ['#f9a825', '#1a1a1a'], ['#2e7d32', '#fff'], ['#ffffff', '#b71c1c'],
  ['#263238', '#ffd54f'], ['#6a1b9a', '#fff'], ['#ef6c00', '#fff'], ['#f5f0e1', '#1b5e20'], ['#00838f', '#fff']];
const FONTES = ['900 40px Rubik, sans-serif', 'italic 800 40px Rubik, sans-serif', '700 38px Georgia, serif', '800 40px Arial Narrow, Arial, sans-serif'];

// lojas vistas nas fotos do diretor (Street View abr/2026), posição pela vista aérea — R. Gen. Ernesto Dorneles
export const LOJAS_FOTOS = [
  { n: 'FARMÁCIAS SÃO JOÃO', x: 30, z: 80, cor: ['#f4f6fb', '#1d4fa3'] },
  { n: 'KOSMUS', x: 40, z: 86, cor: ['#3a3a3c', '#f2efe8'] },
  { n: 'TRILEGAL', x: 46, z: 66, cor: ['#7cc242', '#14331a'] },
  { n: 'HASHTAG PRESENTES', x: 46, z: 40, cor: ['#5b2a8c', '#ffffff'] },
  { n: 'PANVEL', x: 46, z: -22, cor: ['#1f2f8f', '#ffffff'] },
];
const COR_FIXA = Object.fromEntries(LOJAS_FOTOS.map(l => [l.n, l.cor]));

/** Atlas de letreiros: uma faixa de 64 px por letreiro; devolve { tex, get(texto, i) → {v0, v1, u1, aspect} }. */
export function signAtlas(extra = []) {
  const textos = [...new Set([...extra, ...TIPOS])].slice(0, 63);
  const W = 1024, RH = 64, c = document.createElement('canvas'); c.width = W; c.height = RH * textos.length;
  const g = c.getContext('2d'), info = new Map();
  textos.forEach((t, i) => {
    let [bg, fg] = CORES[i % CORES.length], font = FONTES[(i * 7) % FONTES.length];
    if (COR_FIXA[t]) [bg, fg] = COR_FIXA[t];
    if (t === 'PICCADILLY') { bg = '#ecebe6'; fg = '#6d7175'; font = '700 44px Georgia, serif'; }   // letras cinza na parede clara (foto)
    g.font = font; const tw = Math.min(W - 40, g.measureText(t).width), w = Math.min(W, Math.max(tw + 48, 220)), y = i * RH;
    g.fillStyle = bg; g.fillRect(0, y + 2, w, RH - 4);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y + RH - 8, w, 6);                    // sombra da borda de baixo
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.strokeRect(5, y + 7, w - 10, RH - 14);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, y + RH / 2 + 1, W - 40);
    info.set(t, { v0: 1 - (y + RH) / c.height, v1: 1 - y / c.height, u1: w / W, aspect: w / RH });
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex, textos, info, pick: h => textos[Math.floor(h * TIPOS.length) % textos.length] && info.get(TIPOS[Math.floor(h * TIPOS.length) % TIPOS.length]) && TIPOS[Math.floor(h * TIPOS.length) % TIPOS.length] };
}

// sobrados históricos (casas teuto-brasileiras do centro): cores de reboco e acabamento claro
export const SOBRADO_CORES = [0xe9c98a, 0xb9d3b0, 0xe8b8a8, 0xa9c6d8, 0xf0dca0, 0xd7c2e0, 0xc9d9a6].map(c => new THREE.Color(c));
