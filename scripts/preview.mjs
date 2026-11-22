// Gera uma visão de cima do mapa (relevo sombreado + dados do OSM, se houver) em preview/mapa.png
import fs from 'node:fs'; import { createRequire } from 'node:module';
const req = createRequire(import.meta.url); let chromium;
try { ({ chromium } = req('playwright')); } catch { ({ chromium } = req(req('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
import { toXZ } from './geo.mjs'; import { LANDMARKS } from './landmarks.mjs';
const meta = JSON.parse(fs.readFileSync('public/data/terrain.json'));
const hb = fs.readFileSync('public/data/terrain.bin');
const world = fs.existsSync('public/data/world.json') ? JSON.parse(fs.readFileSync('public/data/world.json')) : null;
const lm = LANDMARKS.map(l => { const [x, z] = toXZ(l.lat, l.lon); return { ...l, x, z }; });
const out = process.argv[2] || 'preview/mapa.png', zoom = process.argv[3]; // zoom: "centro" para recorte do centro
fs.mkdirSync('preview', { recursive: true });
const html = `<canvas id=c></canvas><script>
const meta=${JSON.stringify(meta)},h=new Int16Array(Uint8Array.from(atob("${hb.toString('base64')}"),c=>c.charCodeAt(0)).buffer);
const world=${JSON.stringify(world)},lm=${JSON.stringify(lm)},zoom=${JSON.stringify(zoom || null)};
const {nx,nz,cell,x0,z0}=meta;
let vx0=x0,vz0=z0,vw=(nx-1)*cell,vh=(nz-1)*cell; if(zoom){vx0=-1500;vz0=-1300;vw=2700;vh=3100;}
const S=zoom?0.6:0.2/1.4*2.0; const W=Math.round(vw*S),H=Math.round(vh*S);
const c=document.getElementById('c');c.width=W;c.height=H;const g=c.getContext('2d');
const im=g.createImageData(W,H);const hh=(i,j)=>h[Math.max(0,Math.min(nz-1,j))*nx+Math.max(0,Math.min(nx-1,i))]/10;
for(let py=0;py<H;py++)for(let px=0;px<W;px++){const x=vx0+px/S,z=vz0+py/S;const i=Math.round((x-x0)/cell),j=Math.round((z-z0)/cell);
 const e=hh(i,j),dx=hh(i+1,j)-hh(i-1,j),dz=hh(i,j+1)-hh(i,j-1);const sh=Math.max(0.35,Math.min(1.25,0.9+(-dx*0.7-dz*0.7)/(2*cell)*1.6));
 const ramp=[[20,[168,204,120]],[60,[120,176,86]],[150,[78,140,64]],[300,[66,110,52]],[450,[120,110,70]],[600,[160,140,110]],[750,[220,210,195]]];
 let r,gg,b;for(let q=0;q<ramp.length-1;q++){const[a0,c0]=ramp[q],[a1,c1]=ramp[q+1];if(e<=a1||q===ramp.length-2){const u=Math.max(0,Math.min(1,(e-a0)/(a1-a0)));r=(c0[0]+(c1[0]-c0[0])*u)*sh;gg=(c0[1]+(c1[1]-c0[1])*u)*sh;b=(c0[2]+(c1[2]-c0[2])*u)*sh;break}}
 const k=(py*W+px)*4;im.data[k]=r;im.data[k+1]=gg;im.data[k+2]=b;im.data[k+3]=255}
g.putImageData(im,0,0);
const T=(x,z)=>[(x-vx0)*S,(z-vz0)*S];
const poly=(pts,close)=>{g.beginPath();pts.forEach((p,i)=>{const[a,b]=T(p[0],p[1]);i?g.lineTo(a,b):g.moveTo(a,b)});if(close)g.closePath()};
if(world){
 for(const a of world.areas){poly(a.p,true);g.fillStyle={park:'#5fa84a',water:'#3f86bd',residential:'rgba(230,220,200,.35)',industrial:'rgba(190,170,200,.45)',commercial:'rgba(240,180,160,.45)',forest:'rgba(40,90,40,.5)',grass:'#7cb35a',farmland:'rgba(210,200,120,.35)'}[a.k]||'rgba(0,0,0,0)';g.fill()}
 g.lineCap=g.lineJoin='round';
 for(const w of world.water){poly(w.p,false);g.strokeStyle='#3f86bd';g.lineWidth=Math.max(1.5,(w.w||4)*S);g.stroke()}
 for(const r of world.roads){poly(r.p,false);g.strokeStyle=r.main?'#f4b41a':r.k==='track'||r.k==='path'?'#c9a06b':'#eeeae0';g.lineWidth=Math.max(zoom?1:0.7,r.w*S);g.stroke()}
 g.fillStyle='#b5553a';for(const b of world.buildings){poly(b.p,true);g.fill()}
}
g.font='bold '+(zoom?13:11)+'px sans-serif';
for(const l of lm){const[a,b]=T(l.x,l.z);if(a<0||b<0||a>W||b>H)continue;g.fillStyle='#1d4e9e';g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();g.arc(a,b,zoom?6:5,0,7);g.fill();g.stroke();
 g.lineWidth=3;g.strokeStyle='rgba(0,0,0,.7)';g.strokeText(l.nome,a+7,b+4);g.fillStyle='#fff';g.fillText(l.nome,a+7,b+4)}
// escala e norte
const sb=1000*S;g.fillStyle='#fff';g.fillRect(16,H-24,sb,5);g.fillText('1 km',16,H-30);g.font='bold 18px sans-serif';g.fillText('N ↑',W-50,30);
document.title='ok';
</script>`;
const br = await chromium.launch(); const p = await br.newPage();
await p.setContent(html); await p.waitForFunction(() => document.title === 'ok');
await (await p.$('#c')).screenshot({ path: out }); await br.close(); console.log('salvo', out);
