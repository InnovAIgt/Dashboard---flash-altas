/* =====================================================================
   Flash de altas — "robot" que actualiza los datos
   Qué hace: le pide a la API de SAN las altas de cada país y cada mes,
   las junta y las guarda en  docs/datos.json  (el archivo que lee el dashboard).
   La llave se lee de la variable FLASH_API_KEY (archivo .env en tu compu,
   o "Secrets" en GitHub). Nunca se escribe en datos.json.
   Uso:  node actualizar.js
   ===================================================================== */
const fs = require('fs');
const path = require('path');

(function cargarEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const linea of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !linea.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const CFG = {
  LLAVE: process.env.FLASH_API_KEY || '',
  SERVIDOR: (process.env.FLASH_API_SERVIDOR || 'http://san.red.com.gt').replace(/\/+$/, ''),
  PAISES: (process.env.FLASH_PAISES || 'SV,GT').split(',').map(s => s.trim()).filter(Boolean),
  DESDE: process.env.FLASH_DESDE || '2026-01',
  SALIDA: path.join(__dirname, 'docs', 'datos.json'),
};
// Solo se publican los campos que el dashboard usa (no IMEI ni otros datos técnicos)
const CAMPOS = ['altcod', 'folpai', 'fecalt', 'vndcod', 'anajef', 'clinam', 'clicod', 'folcod', 'tipalt', 'tngnam', 'nomeqp', 'tipeqp', 'cnteqp', 'cntsim', 'valnet', 'cntmes'];
const FORMAS = ['{s}/flashApi/{endpoint}.html', '{s}/flashApi/{endpoint}', '{s}/index.php/flashApi/{endpoint}', '{s}/index.php?r=flashApi/{endpoint}'];

async function pedir(forma, endpoint, params = {}) {
  let url = forma.replace('{s}', CFG.SERVIDOR).replace('{endpoint}', endpoint);
  const q = new URLSearchParams(params).toString();
  if (q) url += (url.includes('?') ? '&' : '?') + q;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(url, { headers: { 'X-API-Key': CFG.LLAVE, 'Accept': 'application/json' }, signal: ctrl.signal });
    const txt = await r.text(); let json = null;
    try { json = JSON.parse(txt); } catch (e) { /* no era JSON */ }
    return { status: r.status, json };
  } finally { clearTimeout(t); }
}
async function detectarForma() {
  for (const f of FORMAS) {
    let r; try { r = await pedir(f, 'catalogos'); } catch (e) { continue; }
    if (r.json && r.json.ok === true) return f;
    if (r.status === 401 || (r.json && r.json.ok === false && /autoriz/i.test(r.json.message || ''))) throw new Error('SAN respondió "No autorizado": revisa la llave FLASH_API_KEY');
  }
  throw new Error('No se pudo llegar a la API de Flash en ' + CFG.SERVIDOR + ' (¿este equipo puede abrir SAN?)');
}
function meses() {
  const [a0, m0] = CFG.DESDE.split('-').map(Number), hoy = new Date(), l = [];
  for (let a = a0, m = m0; a < hoy.getFullYear() || (a === hoy.getFullYear() && m <= hoy.getMonth() + 1); m === 12 ? (a++, m = 1) : m++) l.push([a, m]);
  return l;
}

(async () => {
  if (!CFG.LLAVE) throw new Error('Falta la llave FLASH_API_KEY (archivo .env o Secret de GitHub)');
  const forma = await detectarForma();
  console.log('✔ API encontrada en', forma.replace('{s}', CFG.SERVIDOR));
  const tareas = []; for (const pais of CFG.PAISES) for (const [anio, mes] of meses()) tareas.push({ pais, anio, mes });
  const data = [], resumen = {};
  for (let i = 0; i < tareas.length; i += 4) {
    const partes = await Promise.all(tareas.slice(i, i + 4).map(async t => {
      const { status, json } = await pedir(forma, 'altas', t);
      // Si un solo mes falla, se cancela todo: es mejor dejar el archivo anterior que publicar datos incompletos
      if (!json || json.ok !== true || !Array.isArray(json.data)) throw new Error(`SAN no devolvió ${t.pais} ${t.anio}-${t.mes} (código ${status})`);
      resumen[t.pais] = (resumen[t.pais] || 0) + json.data.length;
      return json.data.map(r => Object.fromEntries(CAMPOS.map(c => [c, r[c] ?? null])));
    }));
    partes.forEach(p => data.push(...p));
  }
  if (!data.length) throw new Error('SAN devolvió 0 altas: no se actualiza el archivo');
  // Protección: si de pronto llegan muchas menos altas que antes, algo anda mal y no se pisa el archivo
  let antes = null; try { antes = JSON.parse(fs.readFileSync(CFG.SALIDA, 'utf8')); } catch (e) { /* primera vez */ }
  if (antes && antes.total && data.length < antes.total * 0.9) throw new Error(`Llegaron ${data.length} altas y antes había ${antes.total}: se cancela para no perder datos`);
  const igual = antes && JSON.stringify(antes.data) === JSON.stringify(data);
  fs.mkdirSync(path.dirname(CFG.SALIDA), { recursive: true });
  fs.writeFileSync(CFG.SALIDA, JSON.stringify({ ok: true, actualizado: new Date().toISOString(), total: data.length, data }));
  console.log(`✔ datos.json guardado: ${data.length} altas`, resumen, igual ? '(sin altas nuevas desde la última vez)' : '');
})().catch(e => { console.error('✖', e.message); process.exit(1); });
