// Gera uma visão de cima do mapa (relevo sombreado + dados do OSM, se houver) em preview/mapa.png
import fs from 'node:fs'; import zlib from 'node:zlib'; import { createRequire } from 'node:module';
const req = createRequire(import.meta.url); let chromium;
try { ({ chromium } = req('playwright')); } catch { ({ chromium } = req(req('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
import { toXZ } from '../src/geo.js'; import { LANDMARKS } from '../src/landmarks.js';
const meta = JSON.parse(fs.readFileSync('public/data/terrain.json'));
const hraw = zlib.gunzipSync(fs.readFileSync('public/data/terrain.bin.gz'));
const hq = new Int16Array(hraw.buffer.slice(hraw.byteOffset, hraw.byteOffset + hraw.byteLength));
if (meta.delta) for (let j = 0; j < meta.nz; j++) { let a = 0; for (let i = 0; i < meta.nx; i++) { a += hq[j * meta.nx + i]; hq[j * meta.nx + i] = a; } }
const hb = Buffer.from(hq.buffer);
const world = fs.existsSync('public/data/world.json.gz') ? JSON.parse(zlib.gunzipSync(fs.readFileSync('public/data/world.json.gz'))) : null;
const lm = LANDMARKS.map(l => { const [x, z] = toXZ(l.lat, l.lon); return { ...l, x, z }; });
const out = process.argv[2] || 'preview/mapa.png', zoom = process.argv[3]; // zoom: "centro" para recorte do centro
fs.mkdirSync('preview', { recursive: true });
const html = `<canvas id=c></canvas><script>
const meta=${JSON.stringify(meta)},h=new Int16Array(Uint8Array.from(atob("${hb.toString('base64')}"),c=>c.charCodeAt(0)).buffer);
const world=${JSON.stringify(world)},lm=${JSON.stringify(lm)},zoom=${JSON.stringify(zoom || null)};
const {nx,nz,cell,x0,z0}=meta;
let vx0=x0,vz0=z0,vw=(nx-1)*cell,vh=(nz-1)*cell,S=0.2/1.4*2.0; if(zoom==='centro'){vx0=-1500;vz0=-1300;vw=2700;vh=3100;S=0.6} else if(zoom){const[a,b,c]=zoom.split(',').map(Number);vx0=a-c/2;vz0=b-c/2;vw=vh=c;S=900/c} const W=Math.round(vw*S),H=Math.round(vh*S);
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
 for(const a of world.areas){poly(a.p,true);g.fillStyle={park:'#5fa84a',water:'#3f86bd',residential:'rgba(230,220,200,.35)',industrial:'rgba(190,170,200,.45)',commercial:'rgba(240,180,160,.45)',forest:'rgba(40,90,40,.5)',grass:'#7cb35a',farmland:'rgba(210,200,120,.35)',pitch:'#4f9a3a',cemetery:'rgba(170,170,160,.6)',parking:'rgba(120,120,120,.5)',pool:'#4fb6e0',retail:'rgba(240,180,160,.45)',quarry:'rgba(200,190,170,.7)'}[a.k]||'rgba(0,0,0,0)';g.fill()}
 g.lineCap=g.lineJoin='round';
 for(const w of world.water){poly(w.p,false);g.strokeStyle='#3f86bd';g.lineWidth=Math.max(1.5,(w.w||4)*S);g.stroke()}
 for(const r of world.roads){poly(r.p,false);g.strokeStyle=r.main?'#f4b41a':/Independ/.test(r.n||'')?'#ff8a3d':/Sturmer/.test(r.n||'')?'#ff5a5a':r.k==='track'||r.k==='path'?'#c9a06b':'#eeeae0';g.lineWidth=Math.max(zoom?1:0.7,(r.main||/Independ|Sturmer/.test(r.n||'')?Math.max(r.w,zoom?10:22):r.w)*S);g.stroke()}
 for(const [x,z,y,w,d,r,h,k] of world.gen||[]){const c=Math.cos(r),sn=Math.sin(r);const P=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+u*c+v*sn,z-u*sn+v*c]);poly(P,true);g.fillStyle=k==='c'?'#e0a030':k==='i'?'#7a6a9a':'#d77a5a';g.fill()}
 for(const b of world.buildings){poly(b.p,true);g.fillStyle=/industrial|warehouse|shed/.test(b.kind)?'#7a6a9a':'#b5553a';g.fill();if(zoom&&zoom!=='centro'){g.strokeStyle='#fff';g.lineWidth=1;g.stroke()}}
 if(zoom&&zoom!=='centro'){g.fillStyle='#fff';g.font='10px sans-serif';for(const r of world.roads){if(!r.n)continue;const m=r.p[r.p.length>>1];const[a,b]=T(m[0],m[1]);g.fillText(r.n,a,b)}}
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
