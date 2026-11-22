// Dados do jogo empacotados em JSON: { "gzip_base64": "..." }. Funciona em qualquer hospedagem estática
// (só .json é servido em alguns servidores). O navegador descompacta com DecompressionStream.
export async function fetchPacked(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  const { gzip_base64 } = await r.json();
  const bin = Uint8Array.from(atob(gzip_base64), c => c.charCodeAt(0));
  const ds = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(ds).arrayBuffer());
}
export const fetchPackedJSON = async url => JSON.parse(new TextDecoder().decode(await fetchPacked(url)));
