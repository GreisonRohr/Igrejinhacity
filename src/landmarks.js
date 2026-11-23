// Pontos marcantes (coordenadas do Google Maps)
export const LANDMARKS = [
  { id: 'praca', icon: 'P', cor: '#3d8a2e', nome: 'Praça Dona Luísa', lat: -29.5730284, lon: -50.7919383 },
  { id: 'ruacoberta', icon: 'R', cor: '#5fa8d3', nome: 'Rua Coberta Ary Delmar Koppe', lat: -29.5726129, lon: -50.7920396 },
  { id: 'igreja', icon: '✝', cor: '#ffffff', nome: 'Igreja Gabriel (do Relógio)', lat: -29.5718543, lon: -50.7931363 },
  { id: 'oktober', icon: 'O', cor: '#1d4e9e', nome: 'Parque da Oktoberfest', lat: -29.5665774, lon: -50.7940274 },
  { id: 'waldir', icon: 'W', cor: '#d6322c', nome: 'Bar do Waldir', lat: -29.5723825, lon: -50.7879606 },
  { id: 'piccfab', icon: 'F', cor: '#7a5bd1', nome: 'Piccadilly (fábrica)', lat: -29.5723332, lon: -50.7916414 },
  { id: 'piccloja', icon: 'L', cor: '#7a5bd1', nome: 'Loja Piccadilly', lat: -29.5716525, lon: -50.7863334 },
  { id: 'beirario', icon: 'B', cor: '#8a5a32', nome: 'Calçados Beira Rio', lat: -29.5666900, lon: -50.7923664 },
  { id: 'usaflex', icon: 'U', cor: '#8a5a32', nome: 'Usaflex', lat: -29.5960054, lon: -50.8056278 },
  { id: 'prefeitura', icon: '★', cor: '#f4b41a', nome: 'Prefeitura (Centro Administrativo)', lat: -29.5869806, lon: -50.8040685 },
  { id: 'avenida', icon: 'A', cor: '#f4b41a', nome: 'Av. Pres. Castelo Branco', lat: -29.5769738, lon: -50.7935843 },
  { id: 'ponte', icon: '=', cor: '#9a9a92', nome: 'Ponte do Centro', lat: -29.5699278, lon: -50.7930803 },
  { id: 'passarela', icon: '=', cor: '#9a9a92', nome: 'Passarela do Paranhana', lat: -29.5868318, lon: -50.8118363 },
  { id: 'cruz', icon: '✝', cor: '#ffffff', nome: 'Monte da Fé (Morro da Cruz)', lat: -29.5371338, lon: -50.8294916 },   // igrejinha.tur.br
  { id: 'cascata', icon: '≋', cor: '#4fb6e0', nome: 'Cascata da Solitária', lat: -29.557934, lon: -50.842511 },
  { id: 'viaduto', icon: '=', cor: '#9a9a92', nome: 'Viaduto (ERS-115)', lat: -29.574674, lon: -50.784972 },
  { id: 'paludo', icon: 'L', cor: '#d6322c', nome: 'Paludo', lat: -29.570062, lon: -50.792077 },
  { id: 'suci', icon: 'S', cor: '#1d4e9e', nome: 'SUCI', lat: -29.572130, lon: -50.794145 },
  { id: 'asadelta', icon: '▲', cor: '#ff7a1a', nome: 'Morro Alto da Pedra (voo livre)', lat: -29.5284708, lon: -50.8408725 },
  { id: 'casapedra', icon: 'H', cor: '#9a8f80', nome: 'Casa de Pedra (Stein Haus)', lat: -29.5982670, lon: -50.8145238 },
  { id: 'kinder', icon: 'K', cor: '#d6322c', nome: 'Kinder Park (Alles Blau)', lat: -29.6042518, lon: -50.8016180 },
];

import { toXZ } from './geo.js';
for (const l of LANDMARKS) [l.x, l.z] = toXZ(l.lat, l.lon);
export const byId = Object.fromEntries(LANDMARKS.map(l => [l.id, l]));

// ícones das categorias de lugares do OSM (escolas, bancos…) no minimapa
export const PLACE_STYLE = {
  escola: { icon: 'E', cor: '#2e8b57' }, banco: { icon: '$', cor: '#2f6fd0' }, posto: { icon: 'G', cor: '#f08a24' },
  farmacia: { icon: '+', cor: '#d6322c' }, saude: { icon: 'H', cor: '#d6322c' }, cascata: { icon: '≋', cor: '#4fb6e0' },
  social: { icon: 'S', cor: '#1d4e9e' }, loja: { icon: 'L', cor: '#8a5a32' },
  praca: { icon: 'P', cor: '#3d8a2e' }, bombeiros: { icon: 'B', cor: '#d6322c' }, ponte: { icon: '=', cor: '#9a9a92' },
  mirante: { icon: '▲', cor: '#ff7a1a' }, turismo: { icon: '★', cor: '#f2c12e' }, gastro: { icon: 'R', cor: '#e2683c' }, hotel: { icon: 'h', cor: '#6a5acd' }, evento: { icon: '♪', cor: '#c2185b' }, patrimonio: { icon: 'H', cor: '#9a5a32' }, feira: { icon: 'F', cor: '#3d8a2e' }, ref: { icon: '•', cor: '#ffffff' }, localidade: { icon: '◆', cor: '#f4b41a' }, onibus: { icon: '▪', cor: '#f4b41a' },
};
