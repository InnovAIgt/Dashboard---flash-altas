/* =====================================================================
   reporte-flash-publico  —  Reporte semanal de altas (Flash) en HTML
   ---------------------------------------------------------------------
   Para qué sirve:
     Devuelve el correo YA ARMADO en HTML. El workflow de Activaciones
     llama a esta dirección, recibe el HTML y lo manda por correo.

   Cómo se llama:
     GET  .../reporte-flash-publico?pais=GT
     GET  .../reporte-flash-publico?pais=SV
     Opcional:  &mes=2026-10   (por defecto, el mes en curso en Guatemala)

   De dónde saca los datos (las MISMAS fuentes que el dashboard):
     Altas         -> https://innovaigt.github.io/Dashboard---flash-altas/datos.json
     Radicaciones  -> API de preofertas de Workflow

   ⚠️ IMPORTANTE — CUENTAS DUPLICADAS
   Los cálculos de este archivo son una COPIA de los de
   dashboards/ventas/flash-altas.html (normalizar, filtrados,
   indicadoresDatos, normalizarRad y radFiltradas).
   Si cambiás una regla allá, cambiala acá también o el correo y la
   pantalla van a decir cosas distintas.

   🔑 La llave de Workflow NO se escribe acá. Se guarda como secreto
   en Supabase con el nombre WORKFLOW_API_KEY.
   ===================================================================== */

const ALTAS_URL = "https://innovaigt.github.io/Dashboard---flash-altas/datos.json";
const RAD_URL = "https://workflow.red.com.gt/api/integraciones/dashboard/preofertas";
/* Los logos viven en la carpeta publica del repo de Flash, junto al datos.json.
   Tienen que estar en una direccion publica: un correo no puede mostrar una
   imagen que viva en un repositorio privado. */
const LOGOS = "https://innovaigt.github.io/Dashboard---flash-altas";
const WORKFLOW_API_KEY = (Deno.env.get("WORKFLOW_API_KEY") ?? "").trim();
/* Llave que tiene que mandar quien llame a ESTA función.
   Se guarda como secreto en Supabase con el nombre REPORTE_API_KEY.
   Si el secreto no existe, la función no responde a nadie: es preferible
   que no funcione a que quede abierta con los datos de ventas adentro. */
const REPORTE_API_KEY = (Deno.env.get("REPORTE_API_KEY") ?? "").trim();

const PAISES: Record<string, string> = { SV: "El Salvador", GT: "Guatemala" };
const MONEDA: Record<string, string> = { SV: "$", GT: "Q" };

/* Copiado de CONFIG.NOMBRES_EJECUTIVOS del dashboard */
const NOMBRES_EJECUTIVOS: Record<string, string> = {
  AHERNANDEZ: "Anyelo Hernandez", JFLORES: "Mabel Flores", PAGUILAR: "Pablo Aguilar",
  SCONDE: "Silvia Conde", CKREITZ: "Carlos Kreitz", ALONDONO: "Alexandra Londono",
  OHERNANDEZ: "Obed Hernandez", JGIRON: "Josue Giron", MCERON: "Mario Ceron",
  JSORIANO: "Jesus Soriano", EEVIDES: "Esau Vides", MPALACIOS: "Jonathan Palacios",
  RRAMIREZ: "Raul Ramirez", RFUENTES: "Chelsea Fuentes", CCHE: "Cristian Che",
  MDMARROQUIN: "Nilson Marroquin", KCARDONA: "Kleimy Cardona", GHERRERA: "Gabriela Herrera",
};

/* Copiado del dashboard: CAMPOS_API */
const CAMPOS_API: Record<string, string> = {
  "PAIS": "folpai", "FECHA ALTA": "fecalt", "VENDEDOR": "vndcod", "JEFE": "anajef",
  "NOMBRE CLIENTE": "clinam", "CODIGO CLIENTE": "clicod", "ANEXO": "folcod",
  "TIPO ALTA": "tipalt", "TECNOLOGIA": "tngnam", "NOMBRE EQUIPO": "nomeqp", "TIPO EQUIPO": "tipeqp",
  "CANTIDAD EQUIPO": "cnteqp", "CANTIDAD SIM": "cntsim", "VALOR TOTAL SERVICIOS": "valnet",
  "MESES CONTRATO": "cntmes",
};

/* ---------- utilidades, copiadas del dashboard ---------- */
function num(v: unknown): number {
  if (v === "" || v == null) return 0;
  const n = parseFloat(String(v).replace(/[$Q\s]/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}
function leerFecha(s: string): string {
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]);
const fmt = (n: number) => n.toLocaleString("es-GT", { maximumFractionDigits: 0 });
/* «1 alta» y no «1 altas» */
const plural = (n: number, uno: string, varios: string) => `${fmt(n)} ${n === 1 ? uno : varios}`;
const fmtMon = (n: number, p: string) =>
  (MONEDA[p] || "") + n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nomVend = (c: string) =>
  NOMBRES_EJECUTIVOS[c] || String(c).charAt(0).toUpperCase() + String(c).slice(1).toLowerCase();
const fechaCorta = (iso: string) => {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-"); return `${d}/${m}/${a}`;
};

/* ¿Quien llama trae la llave correcta?
   Se acepta de tres formas, por comodidad de quien integre:
     x-api-key: <llave>            (la recomendada)
     Authorization: Bearer <llave>
     ?clave=<llave> en la dirección (solo para tus pruebas en el navegador:
       las direcciones con llave adentro quedan guardadas en el historial) */
function llaveValida(req: Request, url: URL): boolean {
  if (!REPORTE_API_KEY) return false;
  const h = req.headers;
  const bearer = (h.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const candidatas = [
    (h.get("x-api-key") || "").trim(),
    bearer,
    (url.searchParams.get("clave") || "").trim(),
  ];
  return candidatas.some((c) => c && c === REPORTE_API_KEY);
}

/* Todo lo que no sea una letra inglesa se escribe con su código: la «ó» se
   manda como &#243;. Así los acentos NO dependen de que Supabase, el correo o
   el navegador adivinen bien la codificación: el archivo es puro ASCII y se ve
   igual en todos lados. Cuesta unos KB y a cambio «Petición» nunca más se
   convierte en «PeticiÃ³n». */
const soloAscii = (t: string) =>
  t.replace(/[^\x00-\x7F]/g, (c) => `&#${c.codePointAt(0)};`);

const htmlResp = (cuerpo: string, status = 200) =>
  new Response(new TextEncoder().encode(soloAscii(cuerpo)), {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });

/* ---------- normalizar una fila de altas (copiado) ---------- */
interface Alta {
  pais: string; fecha: string; mes: string; vendedor: string; jefe: string;
  cliente: string; codCliente: string; anexo: string; tipoAlta: string;
  tecnologia: string; equipo: string; tipoEquipo: string;
  cantEquipo: number; cantSim: number; valor: number; meses: number;
}
function normalizar(r: Record<string, unknown>): Alta {
  const g = (k: string) => (r[k] ?? "").toString().trim();
  const fecha = leerFecha(g("FECHA ALTA"));
  return {
    pais: (g("PAIS") || "SV").toUpperCase(),
    fecha,
    mes: fecha ? fecha.slice(0, 7) : "",
    vendedor: g("VENDEDOR") || "(sin vendedor)",
    jefe: g("JEFE"),
    cliente: g("NOMBRE CLIENTE"),
    codCliente: g("CODIGO CLIENTE"),
    anexo: g("ANEXO"),
    tipoAlta: g("TIPO ALTA").toUpperCase(),
    tecnologia: g("TECNOLOGIA"),
    equipo: g("NOMBRE EQUIPO"),
    tipoEquipo: g("TIPO EQUIPO"),
    cantEquipo: num(g("CANTIDAD EQUIPO")),
    cantSim: num(g("CANTIDAD SIM")),
    valor: num(g("VALOR TOTAL SERVICIOS")),
    meses: num(g("MESES CONTRATO")),
  };
}
const normalizarApi = (r: Record<string, unknown>) =>
  normalizar(Object.fromEntries(Object.entries(CAMPOS_API).map(([excel, api]) => [excel, r[api]])));

/* ---------- normalizar una radicación (copiado) ---------- */
interface Rad {
  preOferta: string; fecha: string; mes: string; empresa: string; codigo: string;
  vendedor: string; pais: string; negocio: string; cantidad: number | null;
  etapaNumero: number | null; etapaNombre: string;
  horasEnEtapa: number | null; vencida: boolean | null; diasDesde: number | null;
}
function normalizarRad(r: Record<string, any>, ahora: number): Rad {
  const fecha = leerFecha(String(r.fecha ?? "").trim());
  const numero = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
  const etapa = r.proceso?.etapaActual || {};
  const inicio = etapa.fechaInicio ? Date.parse(etapa.fechaInicio) : NaN;
  const horasEnEtapa = isNaN(inicio) ? null : Math.round(Math.max(0, (ahora - inicio) / 3600000) * 10) / 10;
  const slaHoras = numero(etapa.slaHoras);
  const tRad = fecha ? Date.parse(fecha + "T00:00:00Z") : NaN;
  return {
    preOferta: String(r.preOferta ?? ""), fecha, mes: fecha.slice(0, 7),
    empresa: String(r.empresa ?? "").trim(), codigo: String(r.codigo ?? "").trim(),
    vendedor: String(r.vendedor ?? "").trim() || "(sin vendedor)",
    pais: String(r.pais || "").toUpperCase(), negocio: String(r.negocio ?? ""),
    cantidad: numero(r.cantidad),
    etapaNumero: numero(etapa.numero), etapaNombre: String(etapa.nombre ?? ""),
    horasEnEtapa,
    vencida: horasEnEtapa == null || slaHoras == null ? null : horasEnEtapa >= slaHoras,
    diasDesde: isNaN(tRad) ? null : Math.max(0, Math.floor((ahora - tRad) / 86400000)),
  };
}
const negocioRad = (r: Rad) =>
  r.negocio.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/* Igual que el dashboard: empresa vacía -> se muestra el código del cliente */
const empresaRad = (r: Rad) => r.empresa || (r.codigo ? `(sin nombre) ${r.codigo}` : "—");

/* ---------- traer los datos ---------- */
async function traerAltas(): Promise<{ filas: Alta[]; actualizado: string }> {
  const res = await fetch(ALTAS_URL + "?_=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error(`el archivo de altas respondió ${res.status}`);
  const json = await res.json();
  if (!json || json.ok === false) throw new Error(json?.message || "el archivo de altas vino vacío");
  const filas = Array.isArray(json) ? json : (json.data || []);
  return { filas: filas.map(normalizarApi), actualizado: json.actualizado || "" };
}

async function traerRadicaciones(): Promise<{ data: Rad[]; error: string }> {
  if (!WORKFLOW_API_KEY) return { data: [], error: "falta el secreto WORKFLOW_API_KEY" };
  try {
    const res = await fetch(RAD_URL, {
      headers: {
        "Authorization": "Bearer " + WORKFLOW_API_KEY,
        "DASHBOARD_API_KEY": WORKFLOW_API_KEY,
        "X-API-KEY": WORKFLOW_API_KEY,
        "Accept": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return { data: [], error: `la API de preofertas respondió ${res.status}` };
    const json = await res.json().catch(() => null);
    const lista = Array.isArray(json) ? json : (json?.data || []);
    const ahora = Date.now();
    const data = lista
      .filter((r: any) => r && typeof r === "object" && String(r.estado || "").trim().toLowerCase() === "en_proceso")
      .map((r: any) => normalizarRad(r, ahora));
    return { data, error: "" };
  } catch (_e) {
    return { data: [], error: "sin conexión con la API de preofertas" };
  }
}

/* ---------- mes en curso, hora de Guatemala ---------- */
function mesEnCurso(): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const y = f.find((p) => p.type === "year")!.value;
  const m = f.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}
function textoFechaHora(d = new Date()): string {
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala", weekday: "long", day: "numeric", month: "long",
    year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(d);
}
const NOMBRE_MES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const nombreDelMes = (ym: string) => {
  const [a, m] = ym.split("-"); return `${NOMBRE_MES[+m - 1]} de ${a}`;
};
const soloMes = (ym: string) => NOMBRE_MES[+ym.split("-")[1] - 1];

/* =====================================================================
   ARMAR EL HTML
   ===================================================================== */
interface Ejec {
  vendedor: string; jefe: string; total: number; nuevas: number; adiciones: number;
  unidades: number; uniNuevas: number; uniAdic: number;
  sims: number; valor: number; clientes: Set<string>; filas: Alta[];
}

function armarHtml(opts: {
  pais: string; mes: string; altas: Alta[]; rads: Rad[]; radsOtros: Rad[];
  radError: string; actualizado: string;
}): string {
  const { pais, mes, altas, rads, radsOtros, radError, actualizado } = opts;

  /* --- cifras principales (mismas cuentas que indicadoresDatos) --- */
  const nAltas = altas.length;
  const nuevas = altas.filter((r) => r.tipoAlta === "NUEVA").length;
  const adiciones = nAltas - nuevas;
  const unidades = altas.reduce((s, r) => s + r.cantEquipo, 0);
  const sims = altas.reduce((s, r) => s + r.cantSim, 0);
  const clientesDistintos = new Set(altas.map((r) => r.codCliente)).size;
  const hayRad = !radError;
  const nRad = rads.length;
  const radicadas = hayRad ? nAltas + nRad : null;

  /* --- agrupar por ejecutivo, guardando TODAS sus filas --- */
  const valorTotal = altas.reduce((t, r) => t + r.valor, 0);
  const porVend = new Map<string, Ejec>();
  for (const r of altas) {
    let e = porVend.get(r.vendedor);
    if (!e) {
      e = { vendedor: r.vendedor, jefe: r.jefe, total: 0, nuevas: 0, adiciones: 0,
            unidades: 0, uniNuevas: 0, uniAdic: 0, sims: 0, valor: 0,
            clientes: new Set(), filas: [] };
      porVend.set(r.vendedor, e);
    }
    e.total++; e.unidades += r.cantEquipo; e.sims += r.cantSim; e.valor += r.valor;
    e.clientes.add(r.codCliente);
    if (r.tipoAlta === "NUEVA") { e.nuevas++; e.uniNuevas += r.cantEquipo; }
    else { e.adiciones++; e.uniAdic += r.cantEquipo; }
    e.filas.push(r);
  }
  const ejecutivos = [...porVend.values()].sort((a, b) => b.total - a.total);
  // Dentro de cada ejecutivo, por cliente y luego por fecha: así las altas del
  // mismo cliente quedan juntas, como en el Excel de Activaciones.
  ejecutivos.forEach((e) => e.filas.sort((a, b) =>
    a.cliente === b.cliente ? a.fecha.localeCompare(b.fecha) : a.cliente.localeCompare(b.cliente)));

  /* --- agrupar radicaciones por ejecutivo --- */
  const radPorVend = new Map<string, Rad[]>();
  for (const r of rads) {
    const l = radPorVend.get(r.vendedor) || []; l.push(r); radPorVend.set(r.vendedor, l);
  }
  const radGrupos = [...radPorVend.entries()].sort((a, b) => b[1].length - a[1].length);

  /* --- estilos reutilizados --- */
  /* Los estilos de las dos tablas grandes van una sola vez arriba, en el bloque
     <style>, y acá solo se nombran. Con 139 filas x 11 columnas, escribirlos en
     cada celda hacía un correo de 222 KB y Gmail corta arriba de ~100 KB. */
  const TH = 'class="h"';
  const TD = 'class="d"';
  const TDb = 'class="db"';
  const TDn = 'class="dn"';
  const TOT = 'class="tt"';
  const pill = (cls: string, t: string) => `<span class="p ${cls}">${t}</span>`;
  const tipoPill = (n: number, a: number) =>
    n && a ? pill("px", "MIXTO") : n ? pill("pn", "NUEVA") : pill("pa", "ADICIÓN");
  const negocioPill = (g: string) =>
    g === "VENTA NUEVA" ? pill("pn", "VENTA NUEVA")
      : g === "ADICION" ? pill("pa", "ADICIÓN")
      : g === "RENOVACION" ? pill("pr", "RENOVACIÓN")
      : pill("pr", esc(g || "—"));

  /* Nota corta: cuáles de las que están en proceso vienen de meses anteriores.
     Sí se cuentan (son las que siguen abiertas), pero conviene señalarlas:
     son las que llevan más tiempo sin cerrarse. */
  const avisoOtros = (!hayRad || radsOtros.length === 0) ? "" : `
      <div style="margin-top:12px;border-left:4px solid #b45309;background:#fffbeb;border-radius:0 8px 8px 0;padding:10px 13px;color:#64748b;font-size:11px;line-height:1.5">
        <b style="color:#b45309">${plural(radsOtros.length, "de estas solicitudes se radicó", "de estas solicitudes se radicaron")} en ${radsOtros.length === 1 ? "un mes anterior" : "meses anteriores"}</b>
        y sigue${radsOtros.length === 1 ? "" : "n"} sin cerrarse. ${radsOtros.length === 1 ? "Está marcada" : "Están marcadas"} en la tabla con la etiqueta <b style="color:#b45309">MES ANTERIOR</b>.
      </div>`;

  const nombrePais = PAISES[pais] || pais;
  const mesCorto = soloMes(mes);

  /* --- Gráfica de barras hecha con celdas de tabla ---------------------
     Nada de imágenes ni SVG: los correos los bloquean o los borran. Una celda
     pintada con bgcolor la dibuja hasta Outlook, pesa unos bytes y no depende
     de que el destinatario permita nada.
     Cada barra es lo RADICADO por ese ejecutivo: nuevas + adiciones + en proceso. */
  const radPorVendCnt = new Map<string, number>();
  for (const r of rads) radPorVendCnt.set(r.vendedor, (radPorVendCnt.get(r.vendedor) || 0) + 1);

  // Un ejecutivo puede tener radicaciones en proceso y ninguna alta este mes:
  // también tiene que aparecer, o se pierde de vista lo que tiene pendiente.
  const soloRad = [...radPorVendCnt.keys()]
    .filter((v) => !porVend.has(v))
    .map((v) => ({ vendedor: v, total: 0, nuevas: 0, adiciones: 0 }));
  const filasGraf = [...ejecutivos.map((e) => ({ vendedor: e.vendedor, total: e.total, nuevas: e.nuevas, adiciones: e.adiciones })), ...soloRad]
    .map((e) => { const p = hayRad ? (radPorVendCnt.get(e.vendedor) || 0) : 0; return { ...e, proceso: p, radicadas: e.total + p }; })
    .sort((a, b) => b.radicadas - a.radicadas);

  /* Dibuja una gráfica de barras: una fila por ejecutivo, cada barra partida en
     tramos de color. Se usa para anexos y para unidades, así hay un solo lugar
     donde está el cómo se dibuja. */
  interface FilaG { nombre: string; segmentos: { n: number; color: string }[]; total: number; detalle: string; }
  function graficaBarras(filas: FilaG[]): string {
    const max = Math.max(1, ...filas.map((f) => f.total));
    const suma = filas.reduce((t, f) => t + f.total, 0);
    const tick = "color:#94a3b8;font-size:10px;padding-top:4px";
    const cuerpo = filas.map((f) => {
      const ancho = Math.max(2, Math.round(f.total / max * 100));
      const pct = (n: number) => f.total ? Math.round(n / f.total * 100) : 0;
      const vivos = f.segmentos.filter((x) => x.n > 0);
      const tramos = vivos.map((x, k) => {
        const primero = k === 0, ultimo = k === vivos.length - 1;
        const radio = `border-radius:${primero ? "4px" : "0"} ${ultimo ? "4px" : "0"} ${ultimo ? "4px" : "0"} ${primero ? "4px" : "0"}`;
        return `<td bgcolor="${x.color}" width="${pct(x.n)}%" style="background:${x.color};height:20px;line-height:20px;font-size:0;${radio}">&nbsp;</td>`;
      }).join("");
      return `<tr>
      <td style="padding:6px 12px 6px 0;color:#0f172a;font-size:11px;font-weight:700;white-space:nowrap;vertical-align:middle;text-align:right">${esc(f.nombre)}
        <div style="color:#94a3b8;font-size:10px;font-weight:400;margin-top:1px">${f.detalle}</div></td>
      <td width="100%" valign="middle" bgcolor="#f1f5f9" style="background:#f1f5f9;padding:0;border-left:2px solid #cbd5e1;border-radius:4px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${ancho}%" style="border-collapse:collapse;width:${ancho}%"><tr>${tramos}</tr></table>
      </td>
      <td align="right" valign="middle" style="padding:6px 0 6px 12px;color:#0f172a;font-size:15px;font-weight:900;white-space:nowrap">${fmt(f.total)}</td>
      <td align="right" valign="middle" style="padding:6px 0 6px 8px;color:#94a3b8;font-size:10px;white-space:nowrap">${suma ? Math.round(f.total / suma * 100) : 0}%</td>
    </tr>
    <tr><td colspan="4" style="height:6px;line-height:6px;font-size:0">&nbsp;</td></tr>`;
    }).join("");
    const eje = `<tr><td></td>
      <td style="border-top:1px solid #cbd5e1;padding:0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse"><tr>
          <td align="left" style="${tick}">0</td>
          <td align="center" style="${tick}">${fmt(Math.round(max / 2))}</td>
          <td align="right" style="${tick}">${fmt(max)}</td>
        </tr></table></td>
      <td colspan="2"></td></tr>`;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">${cuerpo}${eje}</table>`;
  }

  const grafAnexos = graficaBarras(filasGraf.map((e) => ({
    nombre: nomVend(e.vendedor),
    segmentos: [{ n: e.nuevas, color: "#15803d" }, { n: e.adiciones, color: "#1d4ed8" }, { n: e.proceso, color: "#b45309" }],
    total: e.radicadas,
    detalle: [e.nuevas ? `${fmt(e.nuevas)} nuevas` : "", e.adiciones ? `${fmt(e.adiciones)} adiciones` : "",
              e.proceso ? `${fmt(e.proceso)} en proceso` : ""].filter(Boolean).join(" &middot; "),
  })));

  /* Columnas verticales: para que esta gráfica no se confunda con la de arriba.
     Se dibujan con celdas de alto fijo en píxeles, que es lo que entienden los
     correos. Con muchos ejecutivos se apretarían, así que ahí vuelve a barras. */
  function graficaColumnas(filas: FilaG[]): string {
    const ALTO = 150;
    const max = Math.max(1, ...filas.map((f) => f.total));
    const ancho = Math.floor(100 / Math.max(1, filas.length));
    const col = filas.map((f) => {
      const vivos = f.segmentos.filter((x) => x.n > 0);
      const bloques = vivos.map((x, k) =>
        `<tr><td bgcolor="${x.color}" height="${Math.max(3, Math.round(x.n / max * ALTO))}" style="background:${x.color};height:${Math.max(3, Math.round(x.n / max * ALTO))}px;line-height:1px;font-size:0;${k === 0 ? "border-radius:4px 4px 0 0" : ""}">&nbsp;</td></tr>`
      ).reverse().join("");
      return `<td valign="bottom" align="center" width="${ancho}%" style="padding:0 6px">
        <div style="color:#0f172a;font-size:15px;font-weight:900;margin-bottom:5px">${fmt(f.total)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="46" style="border-collapse:collapse;width:46px;margin:0 auto">${bloques}</table>
      </td>`;
    }).join("");
    const pies = filas.map((f) => `<td align="center" width="${ancho}%" style="padding:7px 4px 0;border-top:2px solid #cbd5e1">
        <div style="color:#0f172a;font-size:11px;font-weight:700;line-height:1.25">${esc(f.nombre)}</div>
        <div style="color:#94a3b8;font-size:10px;margin-top:2px;line-height:1.3">${f.detalle}</div>
      </td>`).join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
      <tr>${col}</tr><tr>${pies}</tr></table>`;
  }

  /* Solo equipos ENTREGADOS. Lo que está en proceso no entra acá: la cantidad
     que trae Workflow son líneas pedidas en una solicitud sin resolver, y en una
     renovación ni siquiera son equipos nuevos. Mezclarlo inflaba la barra de
     quien tiene renovaciones grandes esperando. El «en proceso» se mira en la
     gráfica de anexos, donde se comparan solicitudes contra solicitudes. */
  const filasUni = ejecutivos
    .filter((e) => e.unidades > 0)
    .map((e) => ({ vendedor: e.vendedor, nuevas: e.uniNuevas, adic: e.uniAdic, total: e.unidades }))
    .sort((a, b) => b.total - a.total);

  const dibujarUni = filasUni.length <= 7 ? graficaColumnas : graficaBarras;
  const grafUnidades = dibujarUni(filasUni.map((f) => ({
    nombre: nomVend(f.vendedor),
    segmentos: [{ n: f.nuevas, color: "#15803d" }, { n: f.adic, color: "#1d4ed8" }],
    total: f.total,
    detalle: [f.nuevas ? `${fmt(f.nuevas)} nuevas` : "", f.adic ? `${fmt(f.adic)} adiciones` : ""].filter(Boolean).join("<br>"),
  })));

  const pNuevasTot = nAltas ? Math.round(nuevas / nAltas * 100) : 0;
  const cuadro = (c: string) => `<span style="display:inline-block;width:9px;height:9px;background:${c};border-radius:2px"></span>`;
  const leyenda = `${cuadro("#15803d")} nuevas &nbsp;&nbsp;${cuadro("#1d4ed8")} adiciones${hayRad ? ` &nbsp;&nbsp;${cuadro("#b45309")} en proceso` : ""}`;
  const bloqueGraficas = (!nAltas && !nRad) ? "" : `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-top:16px"><tr>
    <td style="border:1px solid #e2e8f0;border-radius:10px;padding:14px">
      <h2 style="margin:0;color:#0f172a;font-size:15px">Anexos por ejecutivo</h2>
      <p style="margin:5px 0 12px;color:#64748b;font-size:11px;line-height:1.45">Cada alta es un anexo. La barra es todo lo radicado por esa persona.<br>${leyenda}</p>
      ${grafAnexos}

      <div style="margin-top:18px;background:#f8fafc;border:1px solid #eef2f7;border-radius:10px;padding:14px">
        <h2 style="margin:0;color:#0f172a;font-size:15px">Unidades por ejecutivo</h2>
        <p style="margin:5px 0 12px;color:#64748b;font-size:11px;line-height:1.45">Equipos ya entregados, no anexos: un solo anexo puede llevar varios equipos. No incluye lo que sigue en proceso.<br>${cuadro("#15803d")} nuevas &nbsp;&nbsp;${cuadro("#1d4ed8")} adiciones</p>
        ${grafUnidades}
      </div>

      ${!nAltas ? "" : `<div style="margin-top:18px;padding-top:14px;border-top:1px solid #e2e8f0">
        <h2 style="margin:0 0 8px;color:#0f172a;font-size:15px">Nuevas frente a adiciones</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse"><tr>
          ${nuevas ? `<td bgcolor="#15803d" width="${pNuevasTot}%" style="background:#15803d;height:26px;line-height:26px;color:#fff;font-size:11px;font-weight:800;text-align:center">${pNuevasTot}%</td>` : ""}
          ${adiciones ? `<td bgcolor="#1d4ed8" width="${100 - pNuevasTot}%" style="background:#1d4ed8;height:26px;line-height:26px;color:#fff;font-size:11px;font-weight:800;text-align:center">${100 - pNuevasTot}%</td>` : ""}
        </tr></table>
        <p style="margin:7px 0 0;color:#64748b;font-size:11px">${fmt(nuevas)} de clientes nuevos &middot; ${fmt(adiciones)} de clientes que ya teníamos</p>
      </div>`}
    </td>
  </tr></table>
`;

  /* --- Tabla 1: resumen por ejecutivo (equivale a su hoja RESUMEN ALTAS) --- */
  const filasResumen = ejecutivos.map((e, i) => `<tr${i % 2 ? ' class="z"' : ""}>
      <td ${TDb}>${esc(nomVend(e.vendedor))}</td>
      <td ${TD}>${esc(e.vendedor)}</td>
      <td align="right" ${TD}>${fmt(e.nuevas)}</td>
      <td align="right" ${TD}>${fmt(e.adiciones)}</td>
      <td align="right" ${TDn}>${fmt(e.total)}</td>
      <td align="right" ${TD}>${fmt(e.clientes.size)}</td>
      <td align="right" ${TD}>${fmt(e.unidades)}</td>
      <td align="right" ${TD}>${fmt(e.sims)}</td>
      <td align="right" ${TD}>${esc(fmtMon(e.valor, pais))}</td>
      <td align="right" ${TD}>${nAltas ? Math.round(e.total / nAltas * 100) : 0}%</td>
    </tr>`).join("");

  /* --- Tabla 2: detalle de altas, agrupando lo que se repite ---------------
     Un cliente que compra 12 equipos iguales el mismo día genera 12 anexos: 12
     filas idénticas salvo el número. Se juntan en una sola, con la cuenta, la
     suma y los números de anexo listados, así no se pierde nada y se lee. */
  interface Grupo {
    anexos: string[]; fecha: string; codCliente: string; cliente: string;
    tipoAlta: string; tecnologia: string;
    cant: number; valor: number; meses: Set<number>;
  }
  const filasAltas = ejecutivos.map((e) => {
    const cab = `<tr><td colspan="9" class="g ga" bgcolor="#4a5d80" style="background:#4a5d80;padding:11px 12px">
      <span class="gn" style="display:inline-block;border-radius:999px;background:#28374f;color:#ffffff;padding:7px 14px;font-size:12px;font-weight:800;letter-spacing:.2px">&#128100; ${esc(nomVend(e.vendedor))} &middot; ${esc(e.vendedor)}</span>
      <span class="gs" style="color:#cdd9ee;font-size:11px;font-weight:600;padding-left:10px">${plural(e.total, "anexo", "anexos")} &middot; ${plural(e.clientes.size, "cliente", "clientes")} &middot; ${nAltas ? Math.round(e.total / nAltas * 100) : 0}% del total</span>
    </td></tr>`;

    const grupos = new Map<string, Grupo>();
    for (const r of e.filas) {
      const k = [r.codCliente, r.fecha, r.tipoAlta, r.tecnologia].join("|");
      let g = grupos.get(k);
      if (!g) {
        g = { anexos: [], fecha: r.fecha, codCliente: r.codCliente, cliente: r.cliente,
              tipoAlta: r.tipoAlta, tecnologia: r.tecnologia,
              cant: 0, valor: 0, meses: new Set<number>() };
        grupos.set(k, g);
      }
      if (r.anexo) g.anexos.push(r.anexo);
      g.cant += r.cantEquipo; g.valor += r.valor;
      if (r.meses) g.meses.add(r.meses);
    }
    // Primero todas las NUEVAS y después las ADICIONES, y dentro de cada bloque
    // por cliente y fecha. Así la tabla se lee por tipo y no salteada.
    const rango = (t: string) => t === "NUEVA" ? 0 : t === "ADICION" ? 1 : 2;
    const lista = [...grupos.values()].sort((a, b) =>
      rango(a.tipoAlta) !== rango(b.tipoAlta) ? rango(a.tipoAlta) - rango(b.tipoAlta)
      : a.cliente !== b.cliente ? a.cliente.localeCompare(b.cliente)
      : a.fecha.localeCompare(b.fecha));

    const chico = 'style="color:#94a3b8;font-size:10px;margin-top:2px"';
    const cuerpo = lista.map((g, i) => {
      const n = g.anexos.length;
      // Siempre la cantidad, nunca el número: mostrar a veces una cosa y a
      // veces otra confunde. Quien necesite los números los busca en SAN.
      const anexoCel = plural(n, "anexo", "anexos");
      return `<tr${i % 2 ? ' class="z"' : ""}>
      <td ${TDb} style="white-space:nowrap">${anexoCel}</td>
      <td ${TD}>${fechaCorta(g.fecha)}</td>
      <td ${TD}>${esc(g.codCliente || "—")}</td>
      <td ${TD}>${esc(g.cliente || "—")}</td>
      <td ${TD}>${g.tipoAlta === "NUEVA" ? pill("pn", "NUEVA") : pill("pa", "ADICIÓN")}</td>
      <td ${TD}>${esc(g.tecnologia || "—")}</td>
      <td align="right" ${TD}>${fmt(g.cant)}</td>
      <td align="right" ${TD}>${esc(fmtMon(g.valor, pais))}</td>
      <td align="right" ${TD}>${g.meses.size === 0 ? "—" : g.meses.size === 1 ? fmt([...g.meses][0]) : "varios"}</td>
    </tr>`;
    }).join("");
    return cab + cuerpo;
  }).join("");

  /* --- filas de la tabla de radicaciones --- */
  const filasRad = radGrupos.map(([v, lista]) => {
    const cab = `<tr><td colspan="7" class="g gr" bgcolor="#8a7448" style="background:#8a7448;padding:11px 12px">
      <span class="gn" style="display:inline-block;border-radius:999px;background:#28374f;color:#ffffff;padding:7px 14px;font-size:12px;font-weight:800;letter-spacing:.2px">&#128100; ${esc(nomVend(v))} &middot; ${esc(v)}</span>
      <span class="gs" style="color:#ead9bc;font-size:11px;font-weight:600;padding-left:10px">${plural(lista.length, "radicación", "radicaciones")} en curso</span>
    </td></tr>`;
    const cuerpo = lista.sort((a, b) => (b.diasDesde ?? 0) - (a.diasDesde ?? 0)).map((r, i) => `<tr${i % 2 ? ' class="z"' : ""}>
      <td ${TDb}>${esc(r.preOferta || "—")}</td>
      <td ${TD}>${fechaCorta(r.fecha)}${r.mes !== mes ? " " + pill("pm", "MES ANTERIOR") : ""}</td>
      <td ${TD}>${esc(r.codigo || "—")}</td>
      <td ${TD}>${esc(empresaRad(r))}</td>
      <td class="d">${negocioPill(negocioRad(r))}</td>
      <td align="right" ${TD}>${r.cantidad == null ? "—" : fmt(r.cantidad)}</td>
      <td ${TD}>${esc(r.etapaNombre || "—")}${r.vencida === true ? " " + pill("pv", "VENCIDA") : ""}
        <div style="color:#94a3b8;font-size:10px;margin-top:2px">${r.diasDesde == null ? "" : plural(r.diasDesde, "día", "días") + " desde la radicación"}</div></td>
    </tr>`).join("");
    return cab + cuerpo;
  }).join("");

  const bloqueRad = hayRad
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1">
        <thead><tr>
          <th align="left" ${TH}>PREOFERTA</th>
          <th align="left" ${TH}>FECHA</th>
          <th align="left" ${TH}>CÓDIGO CLIENTE</th>
          <th align="left" class="h" style="min-width:300px">EMPRESA</th>
          <th align="left" ${TH}>TIPO DE NEGOCIO</th>
          <th align="right" ${TH}>CANTIDAD</th>
          <th align="left" ${TH}>ETAPA ACTUAL</th>
        </tr></thead>
        <tbody>${filasRad || `<tr><td colspan="7" style="padding:14px;color:#64748b;font-size:11px">No hay radicaciones en curso en ${esc(nombrePais)}.</td></tr>`}
          <tr><td colspan="5" ${TOT}>TOTAL EN CURSO &middot; ${esc(nombrePais)}</td>
              <td align="right" ${TOT}>${fmt(rads.reduce((s, r) => s + (r.cantidad ?? 0), 0))}</td>
              <td style="padding:9px 8px;background:#1e293b;color:#cbd5e1;font-size:11px">${plural(nRad, "radicación", "radicaciones")}</td></tr>
        </tbody></table>`
    : `<div style="border:1px solid #fecaca;background:#fef2f2;border-radius:8px;padding:12px;color:#b91c1c;font-size:11px">
         No se pudieron consultar las radicaciones en curso: ${esc(radError)}. Las cifras de altas sí son correctas.</div>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reporte semanal de altas · ${esc(nombrePais)}</title>
<style>
/* Encabezado de columnas: oscuro, como la hoja de Excel de Activaciones */
.h{background:#0f172a;color:#cbd5e1;padding:9px 8px;font-size:9px;letter-spacing:.4px;border-right:1px solid #1e293b}
/* Banda de cada ejecutivo: del color de la sección, para que salte a la vista */
.g{padding:0;border:0}
.ga{background:#4a5d80}
.gr{background:#8a7448}
.gn{color:#ffffff;font-size:13px;font-weight:800;letter-spacing:.2px}
.gs{color:#cdd9ee;font-size:11px;font-weight:600}
/* Celdas */
.d{padding:7px 8px;border-bottom:1px solid #eef2f7;border-right:1px solid #f4f7fb;color:#475569;font-size:11px}
.db{padding:7px 8px;border-bottom:1px solid #eef2f7;border-right:1px solid #f4f7fb;color:#0f172a;font-size:11px;font-weight:700}
.dn{padding:7px 8px;border-bottom:1px solid #eef2f7;border-right:1px solid #f4f7fb;color:#0f172a;font-size:11px;font-weight:800;background:#f7f8fa}
.tt{padding:10px 8px;background:#0f172a;color:#ffffff;font-size:11px;font-weight:800;border-right:1px solid #1e293b}
.z{background:#fbfcfe}
/* Pastillas */
.p{display:inline-block;font-size:9px;font-weight:800;padding:3px 7px;border-radius:999px;white-space:nowrap}
.pn{background:#e8f1ea;color:#43755c}
.pa{background:#e9edf4;color:#4c6a96}
.pr{background:#eeeaf4;color:#6b5a8a}
.pv{background:#f6e7e7;color:#9c4b4b}
.pm{background:#f6eedc;color:#8a6a33}
.px{background:#f1f3f6;color:#5b6a7d}
</style></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background:#eef2f7">
<tr><td align="center" style="padding:18px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:1480px;border-collapse:collapse">
<tr><td align="center" style="padding:0;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;border-radius:10px 10px 0 0;overflow:hidden">
  <tr><td style="background:#2147c6;background-image:linear-gradient(90deg,#102654 0%,#2247c6 58%,#2e62e8 100%);padding:14px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse"><tr>
      <td width="60" align="left" valign="middle" style="width:60px">
        <img src="${LOGOS}/logo-red.png" alt="RED" width="42" height="42" style="display:block;width:42px;height:42px;border:0;outline:none;text-decoration:none">
      </td>
      <td align="center" valign="middle" style="padding:0 10px;">
        <div style="margin:0;color:#ffffff;font-size:24px;line-height:1.15;font-weight:900;letter-spacing:-0.3px;">
          Reporte semanal de altas &middot; ${esc(nombrePais)} &middot; ${radicadas == null ? plural(nAltas, "alta", "altas") : fmt(radicadas) + " radicadas"} en ${esc(mesCorto)}
        </div>
        <div style="margin-top:6px;color:#e0e7ff;font-size:11px;line-height:1.35;">Red Intelfon — Ventas &middot; Flash de Altas &middot; ${esc(nombreDelMes(mes))}</div>
      </td>
      <td width="60" align="right" valign="middle" style="width:60px">
        <img src="${LOGOS}/bandera-${esc(pais.toLowerCase())}.png" alt="${esc(pais)}" width="38" height="38" style="display:block;width:38px;height:38px;border:0;outline:none;text-decoration:none;margin-left:auto">
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#1f2d46;padding:12px 24px;color:#e5e7eb;font-size:11px;line-height:1.35;">
    <span style="display:inline-block;margin-right:18px;">&#128336; Reporte generado: ${esc(textoFechaHora())}</span>
    <span style="display:inline-block;">Altas actualizadas: ${actualizado ? esc(textoFechaHora(new Date(actualizado))) : "no se sabe"}</span>
  </td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
<tr><td style="background:#ffffff;padding:22px 24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 10px 10px">

  <p style="margin:0 0 10px;color:#334155;font-size:14px">Hola,</p>
  <p style="margin:0 0 16px;color:#475569;font-size:12px;line-height:1.55">
    Este es el reporte semanal de <strong>altas de ${esc(nombrePais)} del mes en curso</strong>. Incluye las altas ya registradas en ${esc(nombreDelMes(mes))} y las radicaciones que siguen en curso en Workflow.
  </p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-bottom:16px"><tr>
    <td style="border:1px solid #bfdbfe;background:#eff6ff;background-image:linear-gradient(135deg,#eff6ff,#eef2ff);border-radius:10px;padding:14px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse"><tr>
        <td valign="middle">
          <div style="color:#1d4ed8;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.55px">Radicadas en ${esc(mesCorto)}</div>
          <div style="margin-top:5px;color:#475569;font-size:11px;line-height:1.4">${plural(nAltas, "alta registrada", "altas registradas")}${hayRad ? ` + ${plural(nRad, "radicación en curso", "radicaciones en curso")} en Workflow${radsOtros.length ? ` (${fmt(radsOtros.length)} de ${radsOtros.length === 1 ? "un mes anterior" : "meses anteriores"})` : ""}` : ""}</div>
          <div style="margin-top:3px;color:#64748b;font-size:10px">Todo lo que entró, sin importar si ya se resolvió o sigue en trámite.</div>
        </td>
        <td align="right" valign="middle" width="125" style="width:125px">
          <div style="color:#1d4ed8;font-size:36px;line-height:1;font-weight:900">${radicadas == null ? "—" : fmt(radicadas)}</div>
          <div style="margin-top:4px;color:#64748b;font-size:9px">${hayRad ? `${fmt(nAltas)} + ${fmt(nRad)} = ${fmt(radicadas!)}` : "sin radicaciones"}</div>
        </td>
      </tr></table>
    </td>
  </tr></table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-bottom:16px"><tr>
    <td style="border:1px solid #dbeafe;background:#eff6ff;border-radius:8px;padding:11px 13px">
      <p style="margin:0;color:#1e40af;font-size:11px;line-height:1.55"><strong>Cómo leer el reporte:</strong> <strong>altas</strong> son las que ya quedaron registradas en el mes, separadas en nuevas (cliente que no teníamos) y adiciones (lo que se le suma a un cliente existente); <strong>en proceso</strong> son las solicitudes radicadas en ese mismo mes que siguen avanzando en Workflow y todavía no se resuelven, e incluyen ventas nuevas, adiciones y renovaciones; <strong>radicadas</strong> es la suma de las dos, es decir todo lo que entró en el mes. Si quedan solicitudes de meses anteriores sin resolver, se avisan aparte al final.</p>
    </td>
  </tr></table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-bottom:14px"><tr>
    <td width="33%" valign="top" style="padding:0 4px 8px 0">
      <div style="min-height:70px;border:1px solid #dbeafe;border-left:4px solid #1d4ed8;background:#dbeafe;border-radius:8px;padding:11px">
        <div style="color:#1d4ed8;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.4px">Altas de ${esc(mesCorto)}</div>
        <div style="margin-top:4px;color:#0f172a;font-size:23px;line-height:1.15;font-weight:800">${fmt(nAltas)}</div>
        <div style="margin-top:4px;color:#64748b;font-size:10px">${fmt(nuevas)} nuevas &middot; ${fmt(adiciones)} adiciones</div>
      </div></td>
    <td width="33%" valign="top" style="padding:0 4px 8px">
      <div style="min-height:70px;border:1px solid #fef3c7;border-left:4px solid #b45309;background:#fef3c7;border-radius:8px;padding:11px">
        <div style="color:#b45309;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.4px">En proceso</div>
        <div style="margin-top:4px;color:#0f172a;font-size:23px;line-height:1.15;font-weight:800">${hayRad ? fmt(nRad) : "—"}</div>
        <div style="margin-top:4px;color:#64748b;font-size:10px">${hayRad ? (radsOtros.length ? `en curso en Workflow &middot; ${plural(radsOtros.length, "de otro mes", "de otros meses")}` : "en curso en Workflow &middot; al día de hoy") : esc(radError)}</div>
      </div></td>
    <td width="33%" valign="top" style="padding:0 0 8px 4px">
      <div style="min-height:70px;border:1px solid #dcfce7;border-left:4px solid #15803d;background:#dcfce7;border-radius:8px;padding:11px">
        <div style="color:#15803d;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.4px">Radicadas</div>
        <div style="margin-top:4px;color:#0f172a;font-size:23px;line-height:1.15;font-weight:800">${radicadas == null ? "—" : fmt(radicadas)}</div>
        <div style="margin-top:4px;color:#64748b;font-size:10px">${hayRad ? "altas + en proceso" : esc(radError)}</div>
      </div></td>
  </tr></table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-bottom:14px"><tr>
    <td width="50%" valign="top" style="padding:0 4px 8px 0">
      <div style="min-height:56px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:10px 11px">
        <table role="presentation" width="100%" style="width:100%;border-collapse:collapse"><tr>
          <td style="color:#475569;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px">Unidades (equipos)<div style="color:#94a3b8;font-size:10px;font-weight:400;text-transform:none;letter-spacing:0;margin-top:3px">${fmt(sims)} SIM entregadas</div></td>
          <td align="right" valign="middle" style="color:#0f172a;font-size:20px;font-weight:800">${fmt(unidades)}</td>
        </tr></table></div></td>
    <td width="50%" valign="top" style="padding:0 0 8px 4px">
      <div style="min-height:56px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:10px 11px">
        <table role="presentation" width="100%" style="width:100%;border-collapse:collapse"><tr>
          <td style="color:#475569;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px">Clientes<div style="color:#94a3b8;font-size:10px;font-weight:400;text-transform:none;letter-spacing:0;margin-top:3px">${plural(ejecutivos.length, "ejecutivo", "ejecutivos")} con altas</div></td>
          <td align="right" valign="middle" style="color:#0f172a;font-size:20px;font-weight:800">${fmt(clientesDistintos)}</td>
        </tr></table></div></td>
  </tr></table>

  ${bloqueGraficas}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-top:16px"><tr>
    <td style="border:1px solid #e2e8f0;border-radius:10px;padding:14px">
      <div style="margin:0 0 9px"><span style="display:inline-block;padding:6px 10px;border:1px solid #3b82f6;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:900;letter-spacing:.55px;text-transform:uppercase">Altas</span></div>
      <h2 style="margin:0;color:#0f172a;font-size:15px">Resumen por ejecutivo &middot; ${plural(nAltas, "alta", "altas")} en ${esc(mesCorto)}</h2>
      <p style="margin:5px 0 12px;color:#64748b;font-size:11px;line-height:1.45">Altas de ${esc(nombrePais)} registradas en ${esc(nombreDelMes(mes))}, por ejecutivo. Se muestran por separado las NUEVAS y las ADICIONES.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:18px">
        <thead><tr>
          <th align="left" class="h" style="min-width:160px">EJECUTIVO</th>
          <th align="left" ${TH}>CÓDIGO</th>
          <th align="right" ${TH}>NUEVAS</th>
          <th align="right" ${TH}>ADICIONES</th>
          <th align="right" ${TH}>TOTAL</th>
          <th align="right" ${TH}>CLIENTES</th>
          <th align="right" ${TH}>UNIDADES</th>
          <th align="right" ${TH}>SIM</th>
          <th align="right" ${TH}>VALOR SERVICIOS</th>
          <th align="right" ${TH}>%</th>
        </tr></thead>
        <tbody>${filasResumen || `<tr><td colspan="10" style="padding:14px;color:#64748b;font-size:11px">No hay altas registradas en ${esc(nombrePais)} en ${esc(nombreDelMes(mes))}.</td></tr>`}
          <tr><td colspan="2" ${TOT}>TOTAL ${esc(nombrePais.toUpperCase())}</td>
              <td align="right" ${TOT}>${fmt(nuevas)}</td>
              <td align="right" ${TOT}>${fmt(adiciones)}</td>
              <td align="right" ${TOT}>${fmt(nAltas)}</td>
              <td align="right" ${TOT}>${fmt(clientesDistintos)}</td>
              <td align="right" ${TOT}>${fmt(unidades)}</td>
              <td align="right" ${TOT}>${fmt(sims)}</td>
              <td align="right" ${TOT}>${esc(fmtMon(valorTotal, pais))}</td>
              <td align="right" ${TOT}>100%</td></tr>
        </tbody></table>

      <h2 style="margin:0;color:#0f172a;font-size:15px">Detalle de altas &middot; una fila por anexo</h2>
      <p style="margin:5px 0 12px;color:#64748b;font-size:11px;line-height:1.45">Los ${fmt(nAltas)} anexos del mes, agrupados por ejecutivo y por cliente. Cuando varios anexos del mismo cliente comparten fecha, equipo y precio, se muestran en una sola fila con sus números listados y los montos sumados.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1">
        <thead><tr>
          <th align="left" ${TH}>ANEXO</th>
          <th align="left" ${TH}>FECHA</th>
          <th align="left" ${TH}>CÓD. CLIENTE</th>
          <th align="left" class="h" style="min-width:300px">CLIENTE</th>
          <th align="left" ${TH}>TIPO ALTA</th>
          <th align="left" ${TH}>TECNOLOGÍA</th>
          <th align="right" ${TH}>CANT.</th>
          <th align="right" ${TH}>VALOR</th>
          <th align="right" ${TH}>MESES</th>
        </tr></thead>
        <tbody>${filasAltas || `<tr><td colspan="9" style="padding:14px;color:#64748b;font-size:11px">No hay altas registradas en ${esc(nombrePais)} en ${esc(nombreDelMes(mes))}.</td></tr>`}
          <tr><td colspan="6" ${TOT}>TOTAL ${esc(nombrePais.toUpperCase())} &middot; ${esc(mesCorto)}</td>
              <td align="right" ${TOT}>${fmt(unidades)}</td>
              <td align="right" ${TOT}>${esc(fmtMon(valorTotal, pais))}</td>
              <td style="padding:9px 8px;background:#1e293b;color:#cbd5e1;font-size:11px">${fmt(nAltas)}</td></tr>
        </tbody></table>
    </td>
  </tr></table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-top:16px"><tr>
    <td style="border:1px solid #e2e8f0;border-radius:10px;padding:14px">
      <div style="margin:0 0 9px"><span style="display:inline-block;padding:6px 10px;border:1px solid #f59e0b;border-radius:999px;background:#fef3c7;color:#b45309;font-size:10px;font-weight:900;letter-spacing:.55px;text-transform:uppercase">En proceso</span></div>
      <h2 style="margin:0;color:#0f172a;font-size:15px">Detalle de radicaciones en curso${hayRad ? ` &middot; ${fmt(nRad)} ${nRad === 1 ? "actual" : "actuales"}` : ""}</h2>
      <p style="margin:5px 0 12px;color:#64748b;font-size:11px;line-height:1.45">Solicitudes de ${esc(nombrePais)} radicadas en ${esc(nombreDelMes(mes))} que siguen avanzando en Workflow y todavía no se resuelven, agrupadas por ejecutivo.</p>
      ${bloqueRad}
      ${avisoOtros}
    </td>
  </tr></table>

  <p style="margin:16px 0 0;color:#94a3b8;font-size:10px;line-height:1.5">
    Reporte generado automáticamente desde el dashboard de Flash de Altas. Las altas provienen del API de Flash (SAN); las radicaciones en curso, del API de preofertas de Workflow.
    Cualquier diferencia con otros sistemas debe revisarse directamente en Workflow.
  </p>

</td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

/* =====================================================================
   SERVIDOR
   ===================================================================== */
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const pais = (url.searchParams.get("pais") || "").trim().toUpperCase();
  const mes = (url.searchParams.get("mes") || "").trim() || mesEnCurso();

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
      },
    });
  }

  if (!llaveValida(req, url)) {
    /* Mensaje distinto según el caso, para poder arreglarlo sin adivinar.
       Nunca se muestra la llave, solo si existe y cuántos caracteres tiene. */
    const detalle = !REPORTE_API_KEY
      ? "La función no tiene configurado el secreto <code>REPORTE_API_KEY</code> en Supabase. Agregalo en Edge Functions → Secrets."
      : `La llave que mandaste no coincide con la guardada. La guardada tiene ${REPORTE_API_KEY.length} caracteres. Revisá que no se haya colado un espacio al copiarla.`;
    return htmlResp(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"></head>
       <body style="font-family:Arial;padding:24px;color:#b91c1c">
       <h2>Acceso no autorizado</h2>
       <p>${detalle}</p>
       </body></html>`, 401);
  }

  if (!PAISES[pais]) {
    return htmlResp(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"></head>
       <body style="font-family:Arial;padding:24px;color:#b91c1c">
       <h2>Falta indicar el país</h2>
       <p>Agregá <code>?pais=GT</code> o <code>?pais=SV</code> al final de la dirección.</p></body></html>`, 400);
  }
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return htmlResp(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"></head>
       <body style="font-family:Arial;padding:24px;color:#b91c1c">
       <h2>El mes está mal escrito</h2><p>Se escribe así: <code>&amp;mes=2026-10</code></p></body></html>`, 400);
  }

  try {
    const [altasRes, radRes] = await Promise.all([traerAltas(), traerRadicaciones()]);
    const altas = altasRes.filas.filter((r) => r.pais === pais && r.mes === mes);
    // TODAS las que siguen abiertas en ese país entran en la cuenta, sean del
    // mes pedido o de antes: así el número coincide con lo que dice Workflow.
    // radsOtros son solo las de otros meses, para poder señalarlas aparte.
    const rads = radRes.data.filter((r) => r.pais === pais);
    const radsOtros = rads.filter((r) => r.mes !== mes);
    return htmlResp(armarHtml({
      pais, mes, altas, rads, radsOtros, radError: radRes.error, actualizado: altasRes.actualizado,
    }));
  } catch (e) {
    return htmlResp(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"></head>
       <body style="font-family:Arial;padding:24px;color:#b91c1c">
       <h2>No se pudo armar el reporte</h2><p>${esc((e as Error).message)}</p></body></html>`, 502);
  }
});
