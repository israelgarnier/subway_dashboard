# 🥪 Compra de Subway — Monitoreo de medios

Dashboard online que sigue la cobertura sobre la **compra/adquisición de la
franquicia Subway en Costa Rica** (Coprocom · Subs Empire Foods · Grupo Subs
CFA) en los **12 medios principales** del país.

Todo corre **en la nube**, sin depender de tu computador:

- **Apify** (`andok/google-news-scraper`) scrapea Google News en la nube y un
  **Schedule** lo refresca automáticamente.
- **Vercel** hospeda este dashboard (URL pública 24/7).
- El dashboard lee la **última corrida** de Apify por API (leer no cuesta; solo
  correr el actor consume crédito).

## Arquitectura

```
Apify Schedule (1–2×/día) ──► corre andok/google-news-scraper ──► Dataset
                                                                     │
        Vercel (Next.js)  ◄──── /api/news lee la última corrida ◄────┘
              │
        URL pública (la consultas desde cualquier lado)
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `APIFY_TOKEN` | Token de API de Apify (Settings → API & Integrations). **Requerida.** |
| `APIFY_ACTOR` | Actor del scraper. Default `andok~google-news-scraper`. |
| `APIFY_TASK` | (Opcional) id/nombre de un Task agendado; si se define, se lee ese task. |

Copia `.env.example` a `.env.local` para correr local.

## Correr local

```bash
npm install
npm run dev
# http://localhost:3000
```

## Deploy a Vercel (vía GitHub)

1. Sube este repo a GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo.
3. En **Environment Variables** agrega `APIFY_TOKEN` (y opcional `APIFY_ACTOR`).
4. **Deploy.** Vercel te da una URL pública.

Cada `git push` a `main` redeploya automáticamente.

## Refresco automático (Apify Schedule)

El dato lo mantiene fresco Apify, no Vercel:

1. En Apify Console abre el actor `andok/google-news-scraper`, configura el
   input (queries del Subway, `maxItems`, `language: es-419`) y guárdalo como
   **Task** (`compra-subway`).
2. **Schedules → Create new** → agrega el task → frecuencia recomendada
   `0 8,18 * * *` (8am y 6pm). ~$1–2/mes.

El input usado para el monitoreo:

```json
{
  "queries": [
    "Subway Costa Rica adquisición OR compra OR venta OR traspaso",
    "Subway \"Subs Empire Foods\" OR \"Grupo Subs CFA\" OR \"Subs CFA\"",
    "Subway Coprocom OR \"Comisión para Promover la Competencia\""
  ],
  "maxItems": 20,
  "language": "es-419"
}
```

## Los 12 medios monitoreados

La Nación · CRHoy · Teletica · Repretel · La República · El Financiero ·
Diario Extra · Amelia Rueda · Delfino · El Observador · Semanario Universidad ·
El Mundo CR

La lógica de medios y relevancia está en [`lib/process.js`](lib/process.js).
