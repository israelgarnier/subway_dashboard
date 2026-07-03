// Lógica compartida: normalización de medios, relevancia y deduplicación
// de los artículos que devuelve el actor andok/google-news-scraper.
// La usan tanto el dashboard (Next) como el script de GitHub Actions.

// Los 12 medios principales de Costa Rica (confirmados con el usuario).
export const TOP12 = [
  { key: "nacion.com",            name: "La Nación",            aliases: ["nacion.com", "la nación", "la nacion"] },
  { key: "crhoy.com",             name: "CRHoy",                aliases: ["crhoy.com", "crhoy"] },
  { key: "teletica.com",          name: "Teletica",             aliases: ["teletica.com", "teletica"] },
  { key: "repretel.com",          name: "Repretel",             aliases: ["repretel.com", "repretel"] },
  { key: "larepublica.net",       name: "La República",         aliases: ["larepublica.net", "la república", "la republica"] },
  { key: "elfinancierocr.com",    name: "El Financiero",        aliases: ["elfinancierocr.com", "el financiero"] },
  { key: "diarioextra.com",       name: "Diario Extra",         aliases: ["diarioextra.com", "diario extra"] },
  { key: "ameliarueda.com",       name: "Amelia Rueda",         aliases: ["ameliarueda.com", "amelia rueda"] },
  { key: "delfino.cr",            name: "Delfino",              aliases: ["delfino.cr", "delfino"] },
  { key: "elobservador.cr",       name: "El Observador",        aliases: ["elobservador.cr", "el observador cr", "el observador"] },
  { key: "semanariouniversidad.com", name: "Semanario Universidad", aliases: ["semanariouniversidad.com", "semanario universidad"] },
  { key: "elmundo.cr",            name: "El Mundo CR",          aliases: ["elmundo.cr", "el mundo cr"] },
];

// Señales de que la nota habla de la COMPRA/adquisición de Subway (no promos).
const ACQ_RE = /(coprocom|comisi[oó]n para promover|subs empire|subs cfa|grupo subs|franquicia maestra|cambio de due[ñn]o|cambio de propietario|traspaso|adquisic|adquir|compraventa|compra de la franquicia|venta de la franquicia|transferencia de propiedad|roark capital|fusi[oó]n|due[ñn]os de subway)/i;
// Ruido a excluir (promociones, aperturas, recetas, etc.).
const NOISE_RE = /(2x1|2 x 1|d[ií]a mundial|promoci|descuento|gratis|receta|sorteo|cup[oó]n|men[uú] del d[ií]a)/i;

function normalizePublisher(pub) {
  return String(pub || "").toLowerCase().replace(/^www\./, "").trim();
}

export function matchTop12(publisher) {
  const p = normalizePublisher(publisher);
  for (const m of TOP12) {
    if (m.aliases.some((a) => p === a || p.includes(a) || a.includes(p))) return m;
  }
  return null;
}

export function isRelevant(title) {
  const t = plain(title);
  if (!/subway/i.test(t)) return false;
  if (NOISE_RE.test(t)) return false;
  return ACQ_RE.test(t);
}

function toISO(pubDate) {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Posts del Facebook de Coprocom relevantes al caso Subway.
const FB_SUBWAY_RE = /(subway|subs empire|subs cfa|grupo subs)/i;
// Coprocom anuncia el caso SIN nombrar la marca, p.ej.:
// "concentración económica relacionada con el suministro de comidas rápidas
//  operadas bajo el modelo de franquicia". Se detecta por esa combinación.
const FB_CASE_RE = /concentraci[oó]n econ[oó]mica/i;
const FB_FASTFOOD_RE = /(comida[s]? r[aá]pida[s]?|s[aá]ndwich|sandwich|franquicia)/i;

// Normaliza texto con unicode estilizado (𝗦𝘂𝗯𝘄𝗮𝘆 -> Subway) para poder buscar.
function plain(s) {
  return String(s || "").normalize("NFKC");
}

function fbRelevant(text) {
  const t = plain(text);
  if (FB_SUBWAY_RE.test(t)) return true;
  return FB_CASE_RE.test(t) && FB_FASTFOOD_RE.test(t);
}

export function processFacebook(rawPosts) {
  const posts = (rawPosts || [])
    .map((p) => {
      const text = String(p.text || p.message || "").trim();
      return {
        text,
        date: toISO(p.time || p.timestamp || p.date),
        url: p.url || p.facebookUrl || p.topLevelUrl || "",
        reactions: p.likes ?? p.reactionLikeCount ?? p.topReactionsCount ?? 0,
        shares: p.shares ?? p.sharesCount ?? 0,
        relevant: fbRelevant(text),
      };
    })
    .filter((p) => p.url);
  posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return posts;
}

// Procesa los items crudos del dataset de Apify y entrega todo lo que el
// dashboard necesita, ya limpio.
export function processItems(rawItems) {
  const seen = new Set();
  const all = [];

  for (const it of rawItems || []) {
    const link = it.link || it.url || "";
    if (!link || seen.has(link)) continue;
    seen.add(link);
    const title = it.title || "";
    const medium = matchTop12(it.publisher || it.source || it.sourceName);
    all.push({
      title,
      link,
      publisher: normalizePublisher(it.publisher || it.source || it.sourceName),
      mediumKey: medium ? medium.key : null,
      mediumName: medium ? medium.name : null,
      isTop12: !!medium,
      relevant: isRelevant(title),
      date: toISO(it.pubDate || it.publishedAt || it.published || it.date),
    });
  }

  const relevant = all.filter((a) => a.relevant);
  const relevantSorted = [...relevant].sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
  );

  const coverage = TOP12.map((m) => {
    const arts = relevant.filter((a) => a.mediumKey === m.key);
    return {
      key: m.key,
      name: m.name,
      domain: m.key,
      count: arts.length,
      covered: arts.length > 0,
      latest: arts.map((a) => a.date).filter(Boolean).sort().slice(-1)[0] || null,
    };
  });

  const byDay = {};
  for (const a of relevant) {
    if (!a.date) continue;
    const day = a.date.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }
  const timeline = Object.entries(byDay)
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const top12Articles = relevantSorted.filter((a) => a.isTop12);
  const otherArticles = relevantSorted.filter((a) => !a.isTop12);

  return {
    kpis: {
      totalRelevant: relevant.length,
      top12Count: top12Articles.length,
      mediaCovered: coverage.filter((c) => c.covered).length,
      mediaTotal: TOP12.length,
      latestDate: relevantSorted.map((a) => a.date).filter(Boolean)[0] || null,
    },
    coverage,
    timeline,
    top12Articles,
    otherArticles,
  };
}
