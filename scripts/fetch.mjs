// Corre el scraper de Apify, procesa los resultados y escribe docs/data.json.
// Lo ejecuta GitHub Actions en cada corrida programada (o manual).

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { processItems } from "../lib/process.mjs";

const token = process.env.APIFY_TOKEN;
const actor = process.env.APIFY_ACTOR || "andok~google-news-scraper";

if (!token) {
  console.error("ERROR: falta la variable APIFY_TOKEN");
  process.exit(1);
}

// Queries enfocadas SOLO en la compra/adquisición de Subway en Costa Rica.
const input = {
  queries: [
    "Subway Costa Rica adquisición OR compra OR venta OR traspaso",
    'Subway "Subs Empire Foods" OR "Grupo Subs CFA" OR "Subs CFA"',
    'Subway Coprocom OR "Comisión para Promover la Competencia"',
  ],
  maxItems: 20,
  language: "es-419",
};

const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`;

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),
});

if (!res.ok) {
  console.error("ERROR Apify:", res.status, (await res.text()).slice(0, 400));
  process.exit(1);
}

const items = await res.json();
const arr = Array.isArray(items) ? items : [];
const data = processItems(arr);
data.meta = {
  lastRunAt: new Date().toISOString(),
  rawCount: arr.length,
  source: `actor:${actor}`,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "docs");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "data.json");
writeFileSync(outPath, JSON.stringify(data, null, 2));

console.log(
  `OK: ${data.kpis.totalRelevant} notas relevantes, ` +
    `${data.kpis.mediaCovered}/${data.kpis.mediaTotal} medios, ` +
    `${arr.length} crudos -> ${outPath}`
);
