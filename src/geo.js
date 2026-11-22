// Configuração geográfica compartilhada pelos scripts e pelo jogo.
export const BBOX = { south: -29.605, west: -50.850, north: -29.520, east: -50.770 };
// Origem: Praça Dona Luísa
export const ORIGIN = { lat: -29.5730284, lon: -50.7919383 };
const R = 6378137, D2R = Math.PI / 180;
const kx = Math.cos(ORIGIN.lat * D2R) * R * D2R, kz = R * D2R;
// Projeção local equirretangular: x = leste (m), z = sul (m). Sistema destro do Three.js (y para cima), sem espelhar.
export const toXZ = (lat, lon) => [(lon - ORIGIN.lon) * kx, -(lat - ORIGIN.lat) * kz];
export const toLatLon = (x, z) => [ORIGIN.lat - z / kz, ORIGIN.lon + x / kx];
