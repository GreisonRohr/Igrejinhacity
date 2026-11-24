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
if (!process.env.SKIP_BUILD) require('child_process').execSync('npx vite build --logLevel error && node scripts/pack-models.mjs', { cwd: ROOT, stdio: 'inherit' });   // mesmo build publicado
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
    // passarela de madeira da praça sobre o valão: atravessa por cima (não desce para o leito) e chega do outro lado
    for (const [qx, qz, dx, dz] of g.landmarks.footbridges) {
      const deck = g.landmarks.deckAt(qx, qz), ang = Math.atan2(dz, dx);
      for (const s of [-1, 1]) {
        const sx = qx - dx * s * 8, sz = qz - dz * s * 8;
        pl.x = sx; pl.z = sz; pl.surf = pl.groundAt(sx, sz, g.terrain.heightAt(sx, sz) + 2); pl.speed = 0; pl.ang = Math.atan2(dx * s, dz * s);
        let ymid = null, ymin = Infinity;
        for (let k = 0; k < 900 && Math.hypot(pl.x - sx, pl.z - sz) < 16; k++) { pl.update(1 / 60, { f: 1, t: 0, run: false }, Math.atan2(dx * s, dz * s)); if (Math.hypot(pl.x - qx, pl.z - qz) < 0.6) ymid = pl.y; if (Math.hypot(pl.x - qx, pl.z - qz) < 4) ymin = Math.min(ymin, pl.y); }
        res.push({ n: 'passarela da praça ' + JSON.stringify({ ymid: ymid && +ymid.toFixed(2), ymin: +ymin.toFixed(2), deck: +deck.toFixed(2), walk: +Math.hypot(pl.x - sx, pl.z - sz).toFixed(1), ang: +ang.toFixed(2), t0: +g.terrain.heightAt(sx, sz).toFixed(2), s0: g.landmarks.surfaceAt(sx, sz) }), ok: ymid !== null && Math.abs(ymid - deck) < 0.3 && ymin > deck - 0.7 && Math.hypot(pl.x - sx, pl.z - sz) > 14 });
      }
    }
    return res;
  });
  const bad = out.filter(o => !o.ok);
  assert(out.length >= 26, `só ${out.length} travessias`);
  assert(!bad.length, 'falharam: ' + bad.map(b => b.n).join(', '));
  await p.close();
  return `${out.length}/${out.length} travessias no tabuleiro (inclui a passarela da praça)`;
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

await suite('passo-fixo', async () => {
  // a mesma entrada durante 4 s precisa dar o mesmo resultado a 20, 30, 60 e 144 fps
  const p = await page();
  const r = await p.evaluate(() => {
    const g = __game, pl = g.player, Loop = g.sim.constructor;
    const x0 = pl.x, z0 = pl.z, s0 = pl.surf, out = [];
    for (const fps of [20, 30, 60, 144]) {
      Object.assign(pl, { x: x0, z: z0, surf: s0, ang: 0, speed: 0, runTime: 0, y0: 0, vy: 0, onGround: true, lean: 0, air: 0 });
      let t = 0;
      const loop = new Loop(h => { const ax = { f: 1, t: t < 2 ? 0.6 : -0.4, run: t > 1 }; if (Math.abs(t - 0.5) < 1e-9) pl.jump(); pl.step(h, ax, 0.3); t = Math.round((t + h) * 600) / 600; });
      loop.acc = loop.step / 2;                         // meio passo: evita perder o último por arredondamento
      for (let i = 0; i < 4 * fps; i++) loop.advance(1 / fps);
      out.push({ fps, x: pl.x, z: pl.z, steps: loop.steps, d: Math.hypot(pl.x - x0, pl.z - z0) });
    }
    Object.assign(pl, { x: x0, z: z0, surf: s0 });
    return out;
  });
  const ref = r[0];
  for (const q of r) {
    assert(q.steps === 240, `${q.fps} fps deu ${q.steps} passos (esperado 240)`);
    assert(Math.hypot(q.x - ref.x, q.z - ref.z) < 1e-6, `${q.fps} fps terminou ${Math.hypot(q.x - ref.x, q.z - ref.z).toFixed(4)} m longe de 20 fps`);
  }
  return `20/30/60/144 fps → mesma posição após ${ref.d.toFixed(1)} m (${ref.steps} passos)`;
});

await suite('navegacao', async () => {
  const p = await page();
  const r = await p.evaluate(() => {
    const nav = __game.nav;
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const res = { car: { ok: 0, n: 0, ms: 0, t: [], contramao: 0 }, ped: { ok: 0, n: 0, ms: 0, t: [], contramao: 0 } };
    for (const mode of ['car', 'ped']) for (let k = 0; k < 150; k++) {
      // pares dentro da área urbana (até 2,5 km da praça)
      const a = nav.nearest((rnd() - 0.5) * 5000, (rnd() - 0.5) * 5000, mode), b = nav.nearest((rnd() - 0.5) * 5000, (rnd() - 0.5) * 5000, mode);
      if (a < 0 || b < 0 || a === b) continue;
      const R = res[mode]; R.n++;
      const t0 = performance.now(), path = nav.route(a, b, mode), dt = performance.now() - t0; R.ms = Math.max(R.ms, dt); R.t.push(dt);
      if (!path) continue; R.ok++;
      // cada trecho da rota precisa ser permitido (carro nunca na contramão nem em calçada)
      for (let i = 1; i < path.length; i++) {
        let fine = false; for (const ei of nav.adj[path[i - 1]]) { const e = nav.edges[ei]; const v = e.a === path[i - 1] ? e.b : e.a; if (v === path[i] && nav.canUse(e, path[i - 1], mode)) fine = true; }
        if (!fine) R.contramao++;
      }
      const pl = nav.polyline(path); let L = 0; for (let i = 1; i < pl.length; i++) L += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
      const [ax, az] = nav.nodePos(a), [bx, bz] = nav.nodePos(b);
      if (L < Math.hypot(bx - ax, bz - az) - 0.5) R.contramao++;
    }
    for (const R of Object.values(res)) { R.t.sort((x, y) => x - y); R.p95 = R.t[Math.floor(R.t.length * 0.95)] || 0; delete R.t; }
    return { res, nodes: nav.nodeCount, edges: nav.edges.length };
  });
  for (const m of ['car', 'ped']) {
    const R = r.res[m];
    assert(R.contramao === 0, `${m}: ${R.contramao} trechos proibidos na rota`);
    assert(R.ok / R.n >= (m === 'ped' ? 0.97 : 0.85), `${m}: só ${R.ok}/${R.n} rotas encontradas`);
    // p95: o pior caso isolado varia com o carregamento em segundo plano (texturas) e com o coletor de lixo
    assert(R.p95 < 30, `${m}: 95% das rotas abaixo de ${R.p95.toFixed(0)} ms (limite 30)`);
  }
  const c = r.res.car, w = r.res.ped;
  return `${r.nodes} nós; carro ${c.ok}/${c.n} rotas (p95 ${c.p95.toFixed(0)} ms, pior ${c.ms.toFixed(0)}), a pé ${w.ok}/${w.n} (p95 ${w.p95.toFixed(0)} ms), 0 contramão`;
});

await suite('pedestres', async () => {
  const p = await page();
  const r = await p.evaluate(async () => {
    const g = __game, P = g.peds, nav = g.nav;
    g.sky.tod = 10 / 24;
    let worst = 0, tot = 0, viol = { predio: 0, pista: 0, chao: 0 }, samples = 0;
    // está no meio da pista de carro (fora de travessia)?
    const inLane = (x, z) => {
      for (const e of nav.edges) {
        if (!(e.f & nav.CAR) || e.br) continue;
        const pts = [nav.nodePos(e.a)]; for (let j = 0; j < e.m.length; j += 2) pts.push([e.m[j], e.m[j + 1]]); pts.push(nav.nodePos(e.b));
        const half = (e.med > 0 ? Math.max(3.5, (e.w - e.med) / 2) : e.w) / 2;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
          const t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2; if (t < 0.15 || t > 0.85) continue;   // longe dos cruzamentos
          if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < half - 0.6) return true;
        }
      }
      return false;
    };
    for (let i = 0; i < 1800; i++) {
      const t0 = performance.now(); P.step(1 / 60); const dt = performance.now() - t0; worst = Math.max(worst, dt); tot += dt;
      if (i % 120 === 119) for (const a of P.agents) {
        samples++;
        if (g.spatial.blocked(a.x, a.z, 0)) viol.predio++;
        if (a.state === 'andar' && !a.cross && inLane(a.x, a.z)) viol.pista++;
        if (Math.abs(a.y - a.lift - g.player.groundAt(a.x, a.z, g.terrain.heightAt(a.x, a.z))) > 0.05) viol.chao++;
      }
    }
    const dia = P.agents.length, st = {}; for (const a of P.agents) st[a.state] = (st[a.state] || 0) + 1;
    g.sky.tod = 3 / 24; const madrugada = P.targetCount(g.player.x, g.player.z); g.sky.tod = 10 / 24;
    // conversa: chega perto de alguém e aperta E
    const a = P.agents.find(a => a.state === 'andar' || a.state === 'sentado');
    g.player.x = a.x + 1.2; g.player.z = a.z; g.player.prev.x = g.player.x; g.player.prev.z = g.player.z;
    await new Promise(r => setTimeout(r, 300));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    await new Promise(r => setTimeout(r, 100));
    return { dia, madrugada, st, viol, samples, ms: tot / 1800, worst, fala: document.getElementById('toast').textContent, falando: P.agents.some(o => o.state === 'falar') ? 'falar' : a.state };
  });
  assert(!p.errors.length, 'erros: ' + p.errors[0]);
  assert(r.dia >= 40, `só ${r.dia} pessoas no centro às 10 h`);
  assert(r.madrugada <= 10, `${r.madrugada} pessoas às 3 h`);
  assert(r.viol.predio === 0, `${r.viol.predio} dentro de prédio`);
  assert(r.viol.pista <= r.samples * 0.01, `${r.viol.pista} de ${r.samples} amostras no meio da pista`);
  assert(r.viol.chao === 0, `${r.viol.chao} fora do chão`);
  assert(r.ms < 2, `passo ${r.ms.toFixed(2)} ms`);
  assert(r.fala.length > 3 && r.falando === 'falar', 'conversa não respondeu');
  return `${r.dia} pessoas às 10 h (alvo às 3 h: ${r.madrugada}); ${JSON.stringify(r.st)}; pista ${r.viol.pista}/${r.samples}; passo ${r.ms.toFixed(2)} ms (pior ${r.worst.toFixed(1)}); “${r.fala.slice(1, 40)}”`;
});

await suite('mapa', async () => {
  const p = await page();
  const r = await p.evaluate(async () => {
    const g = __game, M = g.bigmap, out = {};
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM' }));
    out.abriu = M.open && !document.getElementById('bigmap').hidden;
    out.ruas = M.index.filter(e => e.t === 'rua').length; out.enderecos = [...M.addr.values()].reduce((a, l) => a + l.length, 0);
    const res = M.search('independencia 478'); out.busca = res[0] && res[0].n;
    out.buscaPonto = (M.search('casa de pedra')[0] || {}).n;
    const d = res[0]; M.setDest(d.x, d.z, d.n); out.rota = M.route.length; out.dist = Math.round(M.routeLen);
    // anda pela rota: o restante diminui e a chegada limpa o destino
    const pl = g.player, path = M.route.slice(); let L0 = M.routeLen;
    pl.x = path[Math.floor(path.length / 2)][0]; pl.z = path[Math.floor(path.length / 2)][1]; M.update(0.1); out.diminuiu = M.routeLen < L0;
    pl.x = d.x + 3; pl.z = d.z; out.chegou = (M.update(0.1) || {}).arrived; out.limpo = !M.dest;
    // desenho e fechar com Esc
    M.view.s = 1.2; M.draw(); const px = M.cv.getContext('2d').getImageData(M.cv.width >> 1, M.cv.height >> 1, 1, 1).data; out.desenhou = px[3] > 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); out.fechou = !M.open;
    return out;
  });
  assert(!p.errors.length, 'erros: ' + p.errors[0]);
  assert(r.abriu && r.fechou, 'abrir/fechar');
  assert(r.ruas > 100 && r.enderecos > 1000, `índice pequeno: ${r.ruas} ruas, ${r.enderecos} endereços`);
  assert(/Independ/.test(r.busca || '') && /478/.test(r.busca), 'busca de endereço: ' + r.busca);
  assert(/Casa de Pedra/.test(r.buscaPonto || ''), 'busca de ponto: ' + r.buscaPonto);
  assert(r.rota > 2 && r.diminuiu && r.chegou && r.limpo, 'GPS: ' + JSON.stringify(r));
  await p.screenshot({ path: OUT + '/mapa.png' }).catch(() => {});
  await p.close();
  return `${r.ruas} ruas, ${r.enderecos} endereços; "${r.busca}" → rota de ${r.dist} m; chegada ok`;
});

await suite('dirigir', async () => {
  const p = await page();
  const r = await p.evaluate(async () => {
    const g = __game, out = {}, wait = ms => new Promise(res => setTimeout(res, ms)), key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
    // carro estacionado mais perto da praça com rua livre à frente
    let c = null, bd = 1e9; for (const q of g.street.cars) { const d = Math.hypot(q.x, q.z); if (d < bd && g.city.surfOffset(q.x + Math.sin(q.yaw) * 8, q.z + Math.cos(q.yaw) * 8) > 0) { bd = d; c = q; } }
    g.player.x = c.x + 1.5; g.player.z = c.z; await wait(200);
    key('KeyF', true); key('KeyF', false); await wait(300);
    out.dentro = !!g.drive.car; const v = g.drive.car; if (!v) return out;
    const x0 = v.x, z0 = v.z; key('KeyW', true); await wait(4000); key('KeyW', false);
    out.kmh = Math.round(v.kmh);                                   // o teclado acelera (o navegador de teste roda poucos passos por segundo)
    for (let i = 0; i < 240; i++) v.step(1 / 60, { f: 1, t: 0 }, false);   // 4 s de simulação
    out.andou = Math.round(Math.hypot(v.x - x0, v.z - z0));
    out.noChao = Math.abs(v.y - g.player.groundAt(v.x, v.z, v.y + 0.5)) < 0.6;
    const v0 = v.v; for (let i = 0; i < 60; i++) v.step(1 / 60, { f: -1, t: 0 }, false); out.freou = v.v < v0 * 0.3; for (let i = 0; i < 240; i++) v.step(1 / 60, { f: -1, t: 0 }, false); out.re = v.v < -1; v.v = 0;
    key('KeyF', true); key('KeyF', false); await wait(300); out.saiu = !g.drive.car && g.player.mesh.visible;
    out.erros = 0; return out;
  });
  assert(!p.errors.length, 'erros: ' + p.errors[0]);
  assert(r.dentro && r.kmh > 1 && r.andou > 10 && r.noChao && r.freou && r.re && r.saiu, JSON.stringify(r));
  await p.close();
  return `entrou, andou ${r.andou} m em 4 s, freou, deu ré e saiu`;
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

await suite('personagem', async () => {
  const p = await page();
  const r = await p.evaluate(() => {
    const g = __game, h = window.__hero, pl = g.player;
    if (!h || !h.cloth) return { erro: 'protagonista não é o modelo CC0' };
    const W = () => { const o = {}; let s = 0; for (const [n, a] of Object.entries(h.actions)) { const w = a.getEffectiveWeight(); if (w > 0.01) o[n] = +w.toFixed(2); s += w; } return { o, s }; };
    const out = {};
    // velocidades intermediárias: dois ciclos ao mesmo tempo, mesma fase da passada, peso total ~1
    for (const v of [0, 0.8, 2.2, 4.5, 9]) { for (let i = 0; i < 120; i++) h.play(1 / 60, { speed: v, mode: v > 5 ? 'sprint' : 'walk', air: 0 }); out[v] = W(); }
    const wj = h.actions.Walk_Loop, jg = h.actions.Jog_Fwd_Loop;
    const fase = Math.abs(wj.time / wj.getClip().duration - jg.time / jg.getClip().duration);
    // giro gradual: virar 180° parado leva mais de um passo e menos de 1 s; correndo, a virada é mais aberta
    pl.speed = 0; pl.ang = 0; let n0 = 0; while (Math.abs(Math.atan2(Math.sin(pl.ang - Math.PI), Math.cos(pl.ang - Math.PI))) > 0.05 && n0 < 300) { pl.step(1 / 60, { f: -1, t: 0, run: false }, 0); n0++; }
    // seleção: Anna (dirndl, saia presa à pelve) e volta ao Lukas (lederhosen, chapéu na cabeça), com animação
    const tr = {};
    for (const k of ['f', 'm']) {
      g.setHero(k); const H = window.__hero; H.play(1 / 60, { speed: 1.35, air: 0 });
      let saia = false, chapeu = false; H.root.traverse(o => { if (o.name === 'traje_dirndl') saia = true; });
      H.bones.pelvis?.traverse(o => { if (o.isMesh && o.parent && o.parent.parent?.parent === H.bones.pelvis) saia = saia || o.visible; });
      H.bones.Head?.traverse(o => { if (o.isMesh && o.visible) chapeu = true; });
      tr[k] = { fem: !!H.look.female, traje: H.cloth.uCostume.value, chapeu, noJogador: H.root.parent === pl.mesh };
    }
    return { out, fase, n0, tr };
  });
  assert(!r.erro, r.erro);
  assert(!p.errors.length, 'erros: ' + p.errors[0]);
  for (const [v, w] of Object.entries(r.out)) assert(Math.abs(w.s - 1) < 0.05, `peso total ${w.s.toFixed(2)} a ${v} m/s`);
  assert(Object.keys(r.out['2.2'].o).length === 2, 'a 2,2 m/s deveria misturar andar e trote: ' + JSON.stringify(r.out['2.2'].o));
  assert(r.fase < 0.01, 'ciclos fora de fase: ' + r.fase);
  assert(r.n0 > 3 && r.n0 < 60, `meia-volta em ${r.n0} passos`);
  assert(r.tr.f.fem && r.tr.f.traje === 2 && r.tr.f.noJogador, 'Anna (dirndl) não ficou no jogador: ' + JSON.stringify(r.tr.f));
  assert(!r.tr.m.fem && r.tr.m.traje === 1 && r.tr.m.chapeu && r.tr.m.noJogador, 'Lukas (lederhosen + chapéu) não ficou no jogador: ' + JSON.stringify(r.tr.m));
  await p.close();
  return `Lukas e Anna (trajes da Oktoberfest); mistura ${JSON.stringify(r.out['2.2'].o)} a 2,2 m/s, fase comum; meia-volta em ${(r.n0 / 60).toFixed(2)} s`;
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
