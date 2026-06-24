"use client";

import { useEffect, useState } from "react";

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function Page() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOthers, setShowOthers] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Error al cargar");
      setData(json);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const maxBar =
    data && data.timeline.length
      ? Math.max(...data.timeline.map((t) => t.count))
      : 0;

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1 className="title">🥪 Compra de Subway · Monitoreo de medios</h1>
          <p className="subtitle">
            Cobertura sobre la adquisición de la franquicia Subway en Costa Rica
            (Coprocom · Subs Empire Foods · Grupo Subs CFA) en los 12 medios
            principales.
          </p>
        </div>
        <div>
          <div className="updated">
            Actualizado:{" "}
            <b>{data ? fmtDateTime(data.meta?.lastRunAt) : "…"}</b>
          </div>
          <button className="refresh-btn" onClick={load}>
            ↻ Recargar
          </button>
        </div>
      </div>

      {loading && <div className="loading">Cargando datos de Apify…</div>}

      {error && (
        <div className="error">
          <b>No se pudo cargar:</b> {error}
          <br />
          Verifica que <code>APIFY_TOKEN</code> esté configurado y que el actor
          haya tenido al menos una corrida exitosa.
        </div>
      )}

      {data && !loading && (
        <>
          <div className="kpis">
            <div className="kpi">
              <div className="num">{data.kpis.totalRelevant}</div>
              <div className="lbl">Notas sobre la compra</div>
            </div>
            <div className="kpi">
              <div className="num">
                {data.kpis.mediaCovered}
                <span style={{ fontSize: 16, color: "var(--muted)" }}>
                  {" "}
                  / {data.kpis.mediaTotal}
                </span>
              </div>
              <div className="lbl">Medios (de 12) que cubrieron</div>
            </div>
            <div className="kpi">
              <div className="num">{data.kpis.top12Count}</div>
              <div className="lbl">Notas en los 12 principales</div>
            </div>
            <div className="kpi">
              <div className="num" style={{ fontSize: 20, paddingTop: 6 }}>
                {fmtDate(data.kpis.latestDate)}
              </div>
              <div className="lbl">Último artículo</div>
            </div>
          </div>

          <div className="section">
            <h2>Cobertura en los 12 medios principales</h2>
            <div className="media-grid">
              {data.coverage.map((m) => (
                <div className="media" key={m.key}>
                  <div>
                    <div className="name">{m.name}</div>
                    <div className="dom">{m.domain}</div>
                  </div>
                  <div
                    className={"badge " + (m.covered ? "yes" : "no")}
                    title={m.latest ? "Último: " + fmtDate(m.latest) : ""}
                  >
                    {m.covered ? `✓ ${m.count}` : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {data.timeline.length > 0 && (
            <div className="section">
              <h2>Línea de tiempo de la cobertura</h2>
              <div className="timeline">
                {data.timeline.map((t) => (
                  <div className="bar-wrap" key={t.day}>
                    <div className="bar-num">{t.count}</div>
                    <div
                      className="bar"
                      style={{
                        height:
                          maxBar > 0
                            ? Math.max(6, (t.count / maxBar) * 90) + "px"
                            : "6px",
                      }}
                    />
                    <div className="bar-day">{t.day.slice(5)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="section">
            <h2>Artículos en los 12 medios principales</h2>
            {data.top12Articles.length === 0 ? (
              <div className="empty">
                Aún no hay artículos de los 12 medios sobre la compra.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Medio</th>
                    <th>Titular</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top12Articles.map((a, i) => (
                    <tr key={i}>
                      <td className="medium">{a.mediumName}</td>
                      <td>
                        <a href={a.link} target="_blank" rel="noreferrer">
                          {a.title}
                        </a>
                      </td>
                      <td className="date">{fmtDate(a.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {data.otherArticles.length > 0 && (
            <div className="section">
              <h2>
                Otros medios{" "}
                <span className="pill">{data.otherArticles.length}</span>
              </h2>
              <button
                className="toggle"
                onClick={() => setShowOthers((s) => !s)}
              >
                {showOthers ? "Ocultar" : "Mostrar"} cobertura fuera de los 12
              </button>
              {showOthers && (
                <table style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Medio</th>
                      <th>Titular</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.otherArticles.map((a, i) => (
                      <tr key={i}>
                        <td className="medium">{a.publisher}</td>
                        <td>
                          <a href={a.link} target="_blank" rel="noreferrer">
                            {a.title}
                          </a>
                        </td>
                        <td className="date">{fmtDate(a.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <p className="subtitle" style={{ marginTop: 24 }}>
            Fuente: Google News vía Apify ({data.meta?.source}). Refresco
            automático en la nube vía Apify Schedule.
          </p>
        </>
      )}
    </div>
  );
}
