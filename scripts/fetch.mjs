// Genera docs/data.json combinando:
//  - Meltwater "Compra subway"  -> SIEMPRE (cada hora), fuente principal.
//  - Apify Google News + Facebook -> solo 3x/día (o en corrida manual FULL=1),
//    para controlar costo. Entre horas se preservan los datos previos.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { processItems, processFacebook, processMeltwater } from "../lib/process.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "docs");
const outPath = join(outDir, "data.json");

const token = process.env.APIFY_TOKEN;
const actor = process.env.APIFY_ACTOR || "andok~google-news-scraper";
const mwToken = process.env.MELTWATER_TOKEN;
const searchId = Number(process.env.MELTWATER_SEARCH_ID || 28806749);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Datos previos (para preservar Apify en corridas "solo Meltwater").
let prev = {};
try {
  prev = JSON.parse(readFileSync(outPath, "utf8"));
} catch {}

// ¿Corremos Apify en esta hora? Slots UTC 1,13,19 = 7pm,7am,1pm CR. Manual = FULL.
const hour = new Date().getUTCHours();
const FULL = process.env.FULL === "1";
let runApify = FULL || [1, 13, 19].includes(hour);
if (!prev.kpis) runApify = true; // bootstrap: si no hay datos previos, corre todo

// ---------------- Apify (Google News + Facebook) ----------------
let data;
if (runApify && token) {
  // Noticias
  const input = {
    queries: [
      "Subway Costa Rica adquisición OR compra OR venta OR traspaso",
      'Subway "Subs Empire Foods" OR "Grupo Subs CFA" OR "Subs CFA"',
      'Subway Coprocom OR "Comisión para Promover la Competencia"',
    ],
    maxItems: 20,
    language: "es-419",
  };
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
  );
  const items = res.ok ? await res.json() : [];
  data = processItems(Array.isArray(items) ? items : []);

  // Facebook Coprocom
  let fbPosts = [];
  try {
    const fbRes = await fetch(
      `https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startUrls: [{ url: "https://www.facebook.com/Coprocom" }], resultsLimit: 15 }),
      }
    );
    if (fbRes.ok) fbPosts = processFacebook(await fbRes.json());
  } catch (e) {
    console.error("Aviso Facebook:", String(e));
  }
  data.facebook = {
    pageUrl: "https://www.facebook.com/Coprocom",
    posts: fbPosts,
    relevantCount: fbPosts.filter((p) => p.relevant).length,
  };
} else {
  // Reusar lo previo de Apify (no lo tocamos en corridas solo-Meltwater).
  data = {
    kpis: prev.kpis,
    coverage: prev.coverage,
    timeline: prev.timeline,
    top12Articles: prev.top12Articles,
    otherArticles: prev.otherArticles,
    facebook: prev.facebook,
  };
}

// ---------------- Meltwater (SIEMPRE) ----------------
async function fetchMeltwater() {
  const H = { apikey: mwToken, "Content-Type": "application/json", Accept: "application/json" };
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const body = {
    onetime_export: {
      search_ids: [searchId],
      start_date: "2025-09-01T00:00:00Z",
      end_date: now,
      format: "JSON",
      template: { name: "api.json" },
    },
  };
  const cr = await fetch("https://api.meltwater.com/v3/exports/one-time", {
    method: "POST",
    headers: H,
    body: JSON.stringify(body),
  });
  if (!cr.ok) {
    console.error("Meltwater crear:", cr.status, (await cr.text()).slice(0, 200));
    return null;
  }
  const ex = (await cr.json()).onetime_export;
  let url = ex.data_url, st = ex.status;
  for (let i = 0; i < 24 && st !== "FINISHED"; i++) {
    await sleep(5000);
    const r = await fetch(`https://api.meltwater.com/v3/exports/one-time/${ex.id}`, { headers: H });
    const j = (await r.json()).onetime_export;
    st = j.status;
    url = j.data_url;
    if (st === "FAILED") { console.error("Meltwater export FAILED"); return null; }
  }
  if (st !== "FINISHED") { console.error("Meltwater no terminó:", st); return null; }
  const dd = await (await fetch(url)).json();
  return processMeltwater(dd.documents || []);
}

if (mwToken) {
  const mw = await fetchMeltwater();
  data.meltwater = mw || prev.meltwater || { total: 0, relevantCount: 0, totalReach: 0, mentions: [] };
} else {
  data.meltwater = prev.meltwater || { total: 0, relevantCount: 0, totalReach: 0, mentions: [] };
}

// ---------------- Meta + escribir ----------------
data.meta = {
  lastRunAt: new Date().toISOString(),
  apifyRefreshed: runApify,
  source: "meltwater+apify",
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(data, null, 2));

console.log(
  `OK -> Meltwater: ${data.meltwater.relevantCount} menciones (reach ${data.meltwater.totalReach}) | ` +
    `Apify ${runApify ? "actualizado" : "preservado"}: ${data.kpis ? data.kpis.totalRelevant : 0} notas, ` +
    `FB ${data.facebook ? data.facebook.relevantCount : 0}`
);
