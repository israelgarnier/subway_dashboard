import { processItems } from "../../../lib/process.mjs";

// Lee la ÚLTIMA corrida exitosa del actor/task en Apify y devuelve los datos
// ya procesados. Leer datasets en Apify NO tiene costo (solo correr el actor).
// El refresco lo mantiene el Schedule de Apify en la nube.

export const dynamic = "force-dynamic"; // siempre datos frescos
export const revalidate = 0;

export async function GET() {
  const token = process.env.APIFY_TOKEN;
  const actor = process.env.APIFY_ACTOR || "andok~google-news-scraper";
  const task = process.env.APIFY_TASK || ""; // opcional: id/nombre del task

  if (!token) {
    return Response.json(
      { error: "Falta APIFY_TOKEN en las variables de entorno." },
      { status: 500 }
    );
  }

  // Si hay un task definido, leemos la última corrida del task; si no, del actor.
  const base = task
    ? `https://api.apify.com/v2/actor-tasks/${task}/runs/last`
    : `https://api.apify.com/v2/acts/${actor}/runs/last`;

  try {
    // 1) Metadatos de la última corrida exitosa (para mostrar cuándo se actualizó).
    const runRes = await fetch(
      `${base}?token=${token}&status=SUCCEEDED`,
      { cache: "no-store" }
    );
    if (!runRes.ok) {
      return Response.json(
        { error: `Apify devolvió ${runRes.status} al leer la última corrida.` },
        { status: 502 }
      );
    }
    const runJson = await runRes.json();
    const run = runJson.data || {};

    // 2) Items del dataset de esa corrida.
    const itemsRes = await fetch(
      `${base}/dataset/items?token=${token}&status=SUCCEEDED&clean=true&limit=1000`,
      { cache: "no-store" }
    );
    const rawItems = itemsRes.ok ? await itemsRes.json() : [];

    const data = processItems(Array.isArray(rawItems) ? rawItems : []);

    return Response.json({
      ...data,
      meta: {
        lastRunAt: run.finishedAt || run.startedAt || null,
        runStatus: run.status || null,
        runId: run.id || null,
        rawCount: Array.isArray(rawItems) ? rawItems.length : 0,
        source: task ? `task:${task}` : `actor:${actor}`,
      },
    });
  } catch (e) {
    return Response.json(
      { error: "No se pudo consultar Apify: " + String(e) },
      { status: 502 }
    );
  }
}
