// Busca um arquivo que pode estar compactado em gzip (.gz). Se o servidor já descompactou
// (Content-Encoding: gzip), usa direto; senão descompacta no navegador (DecompressionStream).
export async function fetchBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return buf;
  const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(ds).arrayBuffer());
}
export const fetchJSON = async url => JSON.parse(new TextDecoder().decode(await fetchBytes(url)));
