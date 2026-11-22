// Pontos marcantes (coordenadas do Google Maps)
export const LANDMARKS = [
  { id: 'praca', icon: 'P', cor: '#3d8a2e', nome: 'Praça Dona Luísa', lat: -29.5730284, lon: -50.7919383 },
  { id: 'ruacoberta', icon: 'R', cor: '#5fa8d3', nome: 'Rua Coberta Ary Delmar Koppe', lat: -29.5726129, lon: -50.7920396 },
  { id: 'igreja', icon: '✝', cor: '#ffffff', nome: 'Igreja do Relógio', lat: -29.5718543, lon: -50.7931363 },
  { id: 'oktober', icon: 'O', cor: '#1d4e9e', nome: 'Parque da Oktoberfest', lat: -29.5665774, lon: -50.7940274 },
  { id: 'waldir', icon: 'W', cor: '#d6322c', nome: 'Bar do Waldir', lat: -29.5723825, lon: -50.7879606 },
  { id: 'piccfab', icon: 'F', cor: '#7a5bd1', nome: 'Piccadilly (fábrica)', lat: -29.5723332, lon: -50.7916414 },
  { id: 'piccloja', icon: 'L', cor: '#7a5bd1', nome: 'Loja Piccadilly', lat: -29.5716525, lon: -50.7863334 },
  { id: 'beirario', icon: 'B', cor: '#8a5a32', nome: 'Calçados Beira Rio', lat: -29.5666900, lon: -50.7923664 },
  { id: 'usaflex', icon: 'U', cor: '#8a5a32', nome: 'Usaflex', lat: -29.5960054, lon: -50.8056278 },
  { id: 'prefeitura', icon: '★', cor: '#f4b41a', nome: 'Prefeitura', lat: -29.5869806, lon: -50.8040685 },
  { id: 'avenida', icon: 'A', cor: '#f4b41a', nome: 'Av. Pres. Castelo Branco', lat: -29.5769738, lon: -50.7935843 },
  { id: 'ponte', icon: '=', cor: '#9a9a92', nome: 'Ponte do Centro', lat: -29.5699278, lon: -50.7930803 },
  { id: 'passarela', icon: '=', cor: '#9a9a92', nome: 'Passarela do Paranhana', lat: -29.5868318, lon: -50.8118363 },
  { id: 'cruz', icon: '✝', cor: '#ffffff', nome: 'Morro da Cruz', lat: -29.5398227, lon: -50.8366944 },
  { id: 'asadelta', icon: '▲', cor: '#ff7a1a', nome: 'Morro da Asa Delta', lat: -29.5281898, lon: -50.8420120 },
];

import { toXZ } from './geo.js';
for (const l of LANDMARKS) [l.x, l.z] = toXZ(l.lat, l.lon);
export const byId = Object.fromEntries(LANDMARKS.map(l => [l.id, l]));
