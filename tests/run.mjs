// Testes automatizados do Igrejinha City (navegador headless).
// Uso: npm test            (sobe o Vite em :5179, roda tudo, salva capturas em tests/out/)
//      npm test -- pontes  (só as suítes cujo nome contém "pontes")
// Orçamentos em tests/budget.json: falha se piorar além deles.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const ROOT = path.resolve(path.dirname(new globalThis.URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'tests/out'); fs.mkdirSync(OUT, { recursive: true });
const BUDGET = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/budget.json'), 'utf8'));
const PORT = 5179, BASE_URL = `http://localhost:${PORT}/`;
const filter = process.argv[2] || '';

// testa o build de produção (o que o jogador recebe), não o servidor de desenvolvimento
if (!process.env.SKIP_BUILD) require('child_process').execSync('npx vite build --logLevel error', { cwd: ROOT, stdio: 'inherit' });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* já encerrado */ } };
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { await fetch(BASE_URL); break; } catch { await new Promise(r => setTimeout(r, 500)); } }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const results = [];
let openPages = [];
async function page(q = 'autostart', size = [844, 390]) {
  const p = await browser.newPage({ viewport: { width: size[0], height: size[1] } }); openPages.push(p);
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  await p.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: true }); });
  p.t0 = Date.now();
  await p.goto(BASE_URL + '?' + q);
  await p.waitForFunction(() => window.__game, null, { timeout: 240000 });
  p.loadMs = Date.now() - p.t0;
  await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.style.visibility = 'hidden'; });
  return p;
}
async function suite(name, fn) {
  if (filter && !name.includes(filter)) return;
  const t0 = Date.now();
  try { const info = await fn(); results.push({ name, ok: true, info, s: ((Date.now() - t0) / 1000).toFixed(0) }); }
  catch (e) { results.push({ name, ok: false, info: e.message.split('\n')[0], s: ((Date.now() - t0) / 1000).toFixed(0) }); }
  finally { for (const p of openPages) await p.close().catch(() => {}); openPages = []; }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };

// ---------------------------------------------------------------------------------------------
await suite('carga', async () => {
  // mede só a fase de carregamento (até o botão Jogar): depois disso o custo é a rasterização por
  // software deste ambiente, que não representa uma GPU de celular (ver ROADMAP P0-1)
  const p = await browser.newPage({ viewport: { width: 844, height: 390 } }); openPages.push(p);
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  await p.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); });
  const t0 = Date.now(); await p.goto(BASE_URL);
  await p.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 240000, polling: 50 });
  p.loadMs = Date.now() - t0;
  const lt = await p.evaluate(() => Math.round(Math.max(0, ...window.__lt.filter(([s]) => s < window.__readyAt).map(([, d]) => d))));
  await p.screenshot({ path: path.join(OUT, 'menu.png') });
  assert(!p.errors.length, 'erros: ' + p.errors.slice(0, 3).join(' | '));
  assert(lt <= BUDGET.maiorTravamentoMs, `travamento de ${lt} ms > ${BUDGET.maiorTravamentoMs}`);
  await p.close();
  return `pronto em ${p.loadMs} ms; maior travamento ${lt} ms`;
});

await suite('orcamento', async () => {
  const p = await page();
  await p.waitForTimeout(10000);
  await p.evaluate(() => { gc(); gc(); });
  const r = await p.evaluate(() => {
    const g = __game; g.player.x = -20; g.player.z = 5; g.cam.yaw = 2.6; g.cam.dist = 8; g.cam.pitch = 0.2; g.cam.first = true;
    g.camera.updateMatrixWorld(); const c = g.camera.position;
    g.terrain.update(c.x, c.z); g.city.update(c.x, c.z); g.street.update(c.x, c.z); g.landmarks.cull(c.x, c.z, g.city.buildDist * 0.45);
    g.renderer.render(g.scene, g.camera); const calls = g.renderer.info.render.calls, tris = g.renderer.info.render.triangles;
    gc(); return { heap: Math.round(performance.memory.usedJSHeapSize / 1048576), calls, tris: Math.round(tris / 1000) };
  });
  assert(!p.errors.length, 'erros: ' + p.errors[0]);
  assert(r.heap <= BUDGET.heapMB, `heap ${r.heap} MB > ${BUDGET.heapMB}`);
  assert(r.calls <= BUDGET.drawCallsPraca, `draw calls ${r.calls} > ${BUDGET.drawCallsPraca}`);
  assert(r.tris <= BUDGET.triangulosMilPraca, `triângulos ${r.tris}k > ${BUDGET.triangulosMilPraca}k`);
  await p.close();
  return `heap ${r.heap} MB, ${r.calls} draw calls, ${r.tris}k triângulos`;
});

await suite('pontes', async () => {
  const p = await page();
  const out = await p.evaluate(() => {
    const g = __game, pl = g.player, res = [];
    pl.update = pl.constructor.prototype.update.bind(pl);
    for (const r of g.world.roads) if (r.br && r.w > 5) {
      const a = r.p[0], e = r.p[r.p.length - 1], L = Math.hypot(e[0] - a[0], e[1] - a[1]), ux = (e[0] - a[0]) / L, uz = (e[1] - a[1]) / L;
      for (const [sx, sz, dx, dz] of [[a[0] - ux * 12, a[1] - uz * 12, ux, uz], [e[0] + ux * 12, e[1] + uz * 12, -ux, -uz]]) {
        pl.x = sx; pl.z = sz; pl.surf = g.terrain.heightAt(sx, sz); pl.speed = 0; pl.ang = Math.atan2(dx, dz);
        let walked = 0, ymid = null; const need = L + 24;
        for (let k = 0; k < 4000 && walked < need; k++) {
          const x0 = pl.x, z0 = pl.z; pl.update(1 / 60, { f: 1, t: 0, run: false }, Math.atan2(dx, dz)); walked += Math.hypot(pl.x - x0, pl.z - z0);
          if (Math.hypot(pl.x - (a[0] + e[0]) / 2, pl.z - (a[1] + e[1]) / 2) < 3) ymid = pl.y;
        }
        const deck = g.city.deckAt((a[0] + e[0]) / 2, (a[1] + e[1]) / 2);
        res.push({ n: r.n || '-', ok: ymid !== null && deck !== null && Math.abs(ymid - deck) < 0.6 });
      }
    }
    return res;
  });
  const bad = out.filter(o => !o.ok);
  assert(out.length >= 26, `só ${out.length} travessias`);
  assert(!bad.length, 'falharam: ' + bad.map(b => b.n).join(', '));
  await p.close();
  return `${out.length}/${out.length} travessias no tabuleiro`;
});

await suite('colisao', async () => {
  const p = await page();
  const r = await p.evaluate(() => {
    const g = __game, pl = g.player; pl.update = pl.constructor.prototype.update.bind(pl);
    // anda em direção ao centro de um prédio grande do centro e verifica que não entra
    // escolhe um prédio grande do centro e um ponto de partida livre (na rua), 8–40 m de distância
    let cx, cz, sx, sz;
    for (const b of g.world.buildings) {
      if (!b.rect || b.rect[4] < 6 || b.rect[5] < 6 || Math.hypot(b.rect[0], b.rect[1]) > 600) continue;
      [cx, cz] = b.rect; if (!pl.blocked(cx, cz, 0.1)) continue;
      for (let a = 0; a < 16 && sx === undefined; a++) for (let d = 8; d <= 40; d += 2) {
        const x = cx + Math.cos(a / 16 * 6.283) * d, z = cz + Math.sin(a / 16 * 6.283) * d;
        if (!pl.blocked(x, z, 0.8)) { sx = x; sz = z; break; }
      }
      if (sx !== undefined) break;
    }
    pl.x = sx; pl.z = sz; pl.surf = g.terrain.heightAt(sx, sz); pl.speed = 0;
    for (let k = 0; k < 600; k++) pl.update(1 / 60, { f: 1, t: 0, run: false }, Math.atan2(cx - sx, cz - sz));
    const inside = pl.blocked(pl.x, pl.z, 0.05);
    return { inside, moved: Math.hypot(pl.x - sx, pl.z - sz) };
  });
  assert(!r.inside, 'jogador entrou no prédio');
  assert(r.moved > 1, 'jogador nem se moveu');
  await p.close();
  return `parou na parede após ${r.moved.toFixed(1)} m`;
});

await suite('waldir', async () => {
  const p = await page();
  const ok = await p.evaluate(async () => {
    const g = __game, w = g.waldir;
    if (!w) return 'sem waldir';
    g.player.x = w.position.x + 1.5; g.player.z = w.position.z; g.player.surf = g.terrain.heightAt(g.player.x, g.player.z);
    await new Promise(r => setTimeout(r, 300));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    await new Promise(r => setTimeout(r, 100));
    return document.getElementById('toast').textContent;
  });
  assert(/Waldir/.test(ok), 'Waldir não respondeu: ' + ok);
  await p.close();
  return ok.slice(0, 60);
});

await suite('capturas', async () => {
  const p = await page('autostart', [1280, 720]);
  const views = [['praca', -20, 5, 2.4, 14, 0.15, 10], ['rua', 150, 200, 2, 10, 0.12, 15], ['oktoberfest', -190, -612, 3.14, 22, 0.12, 15], ['noite', -60, -20, 2.9, 22, 0.25, 21]];
  for (const [n, x, z, yaw, d, pi, h] of views) {
    await p.evaluate(([x, z, yaw, d, pi, h]) => { const g = __game; g.player.x = x; g.player.z = z; g.player.surf = g.terrain.heightAt(x, z); g.cam.yaw = yaw; g.cam.dist = d; g.cam.pitch = pi; g.cam.first = true; g.cam.idle = -1e9; g.sky.tod = h / 24; }, [x, z, yaw, d, pi, h]);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(OUT, n + '.png') });
  }
  assert(!p.errors.length, 'erros: ' + p.errors[0]);
  await p.close();
  return `${views.length} capturas em tests/out/`;
});

await browser.close(); stop();
console.log('\nResultado:');
for (const r of results) console.log(`${r.ok ? 'OK   ' : 'FALHA'} ${r.name.padEnd(12)} ${r.s.padStart(4)} s  ${r.info}`);
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} suíte(s) falharam.` : '\nTodas as suítes passaram.');
process.exit(failed ? 1 : 0);
