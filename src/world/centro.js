// Região central (padrão de qualidade do jogo): Praça Dona Luísa, Rua Coberta e as quadras do entorno imediato.
// Coordenadas do jogo (metros a partir da praça; x = leste, z = sul). Quadra da praça: Av. Pres. Castelo Branco (O,
// x ≈ −52), R. Gen. Ernesto Dorneles (L, x ≈ 36), R. Oswaldo Cruz / Rua Coberta (N, z ≈ −46), R. João Corrêa (S,
// z ≈ 73). A região pega uma quadra a mais em cada direção (inclui a Casa do Artesão e a Igreja do Relógio).
export const CENTRO = { x0: -190, x1: 170, z0: -175, z1: 200 };
/** Ponto dentro do centro (margem em metros: positiva amplia, negativa encolhe). */
export function inCentro(x, z, m = 0) { return x > CENTRO.x0 - m && x < CENTRO.x1 + m && z > CENTRO.z0 - m && z < CENTRO.z1 + m; }
