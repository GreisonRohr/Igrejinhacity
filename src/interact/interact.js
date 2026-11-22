// Interagíveis: cada fonte diz se há algo perto do jogador (distância, texto do aviso, ação).
// O botão E / Falar executa o mais próximo. Waldir e pedestres entram aqui; carro, lojas e missões depois.
export class Interactions {
  constructor() { this.sources = []; }
  /** source(px, pz) → { dist, label, touchLabel, button, run() } | null */
  add(source) { this.sources.push(source); }
  best(px, pz) {
    let best = null;
    for (const s of this.sources) { const c = s(px, pz); if (c && (!best || c.dist < best.dist)) best = c; }
    return best;
  }
}
