// Geradores aleatórios com semente (mulberry32). Jogo e cosmético em fluxos separados:
// mudar um efeito visual nunca altera uma decisão de jogo (skill game-detail-bar §11).
export function mulberry32(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.state = () => a;
  return next;
}
export const RNG = {
  game: mulberry32(20261122),       // decisões de simulação (NPCs, trânsito, eventos)
  cosmetic: mulberry32(7),          // partículas, variações visuais, tom de som
};
