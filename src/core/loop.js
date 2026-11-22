// Passo fixo de simulação (60 Hz) com interpolação: a lógica não depende da taxa de quadros.
// skill game-detail-bar §11: acumulador, teto de passos por quadro, descarte após travamento longo.
export const STEP = 1 / 60;

export class FixedLoop {
  constructor(simulate, { step = STEP, maxSteps = 5 } = {}) {
    this.simulate = simulate;   // (h) → avança a simulação um passo
    this.step = step; this.maxSteps = maxSteps;
    this.acc = 0; this.alpha = 0; this.steps = 0;
  }
  /** Chamar uma vez por quadro com o tempo real decorrido (s). Devolve alpha de interpolação 0..1. */
  advance(dt) {
    this.acc += Math.min(dt, this.step * this.maxSteps);   // após travamento longo, não tenta recuperar segundos
    let n = 0;
    while (this.acc >= this.step && n < this.maxSteps) { this.simulate(this.step); this.acc -= this.step; n++; }
    if (n === this.maxSteps) this.acc = Math.min(this.acc, this.step);
    this.steps += n;
    this.alpha = this.acc / this.step;
    return this.alpha;
  }
}
