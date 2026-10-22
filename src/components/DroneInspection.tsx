import { useState, type FormEvent } from "react";
import { Check, ExternalLink, Play, RotateCw, X } from "lucide-react";
import { api } from "../lib/api";
import type { DroneInspectionSource } from "../types";
import "./drone-inspection.css";

export default function DroneInspection({ source }: { source: DroneInspectionSource | null }) {
  const [watching, setWatching] = useState(false);
  const [retry, setRetry] = useState(0);
  const playerId = "drone-player";
  return (
    <section className="drone-inspection" aria-labelledby="drone-title">
      <div className="drone-header">
        <div className="drone-symbol" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="7" r="5" /><circle cx="25" cy="7" r="5" />
            <circle cx="7" cy="25" r="5" /><circle cx="25" cy="25" r="5" />
            <path d="m7 7 7 7m11-7-7 7M7 25l7-7m11 7-7-7" />
            <rect x="12" y="12" width="8" height="8" rx="3" />
            <path d="M14 22h4" />
          </svg>
        </div>
        <div className="drone-heading">
          <span className="drone-eyebrow">INSPECCIÓN AÉREA · HORUS</span>
          <h2 id="drone-title">Ver inspección con dron en vivo</h2>
          <p>Seguí el vuelo y la inspección actual desde un solo lugar.</p>
        </div>
        <span className={`drone-badge ${source ? "drone-configured" : ""}`}>
          {source ? "Enlace disponible" : "Próxima inspección"}
        </span>
      </div>

      <div className="drone-body">
        <div className="drone-controls">
          <p>{source
            ? "Mirá la inspección aquí. YouTube indica si el vuelo está en vivo, programado o finalizado."
            : "Cuando haya una inspección disponible, podrás seguir el vuelo desde aquí."}</p>
          {source && <button className="button button-primary" onClick={() => setWatching(!watching)} aria-expanded={watching} aria-controls={playerId}>
            {watching ? <X size={16} /> : <Play size={16} />}
            {watching ? "Cerrar transmisión" : "Ver transmisión"}
          </button>}
        </div>
        {watching && source && (
          <div id={playerId} className="drone-player">
            <div className="drone-video">
              <iframe
                key={`${source.videoId}-${retry}`}
                title="Inspección con dron en vivo"
                src={`https://www.youtube-nocookie.com/embed/${source.videoId}?autoplay=1&mute=1&playsinline=1&rel=0`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <div className="drone-player-footer">
              <p>El video comienza sin sonido; podés activarlo en el reproductor. Si no se reproduce aquí, abrilo en YouTube.</p>
              <div className="drone-actions">
                <button className="button button-secondary" onClick={() => setRetry(retry + 1)}>
                  <RotateCw size={15} /> Recargar video
                </button>
                <a className="button button-secondary" href={source.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15} /> Abrir en YouTube
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function DroneInspectionSettings({ source, onSaved }: {
  source: DroneInspectionSource | null;
  onSaved: () => Promise<void>;
}) {
  const [url, setUrl] = useState(source?.url || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const formId = "drone-settings";
  async function save(nextUrl: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { inspection } = await api<{ inspection: DroneInspectionSource | null }>("/drone-inspection", {
        method: "PATCH", body: JSON.stringify({ url: nextUrl }),
      });
      setUrl(inspection?.url || "");
      await onSaved();
      setNotice(inspection ? "Transmisión guardada para el inicio de HORUS." : "Enlace de la inspección eliminado.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(url);
  }
  return <section className="panel">
    {notice && <p className="drone-notice drone-settings-notice" role="status"><Check size={16} />{notice}</p>}
          <form id={formId} className="tower-form drone-settings-form" onSubmit={submit} aria-label="Configurar inspección con dron">
            <label htmlFor={`${formId}-url`}>Enlace de YouTube</label>
            <input
              id={`${formId}-url`}
              name="youtubeUrl"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/live/…"
              maxLength={2048}
              required
              autoFocus
              disabled={busy}
              aria-describedby={`${formId}-help`}
              aria-invalid={error ? true : undefined}
            />
            <p id={`${formId}-help`} className="form-note">
              En YouTube, abrí la transmisión y copiá su enlace desde Compartir.
              Debe ser pública o no listada y permitir la inserción en otros sitios.
              Usá el enlace del video, no el del canal ni la clave de transmisión.
            </p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="drone-form-actions">
              {source && (
                <button type="button" className="button button-secondary" disabled={busy} onClick={() => void save("")}>
                  Quitar enlace
                </button>
              )}
              <button type="button" className="button button-secondary" disabled={busy} onClick={() => setUrl(source?.url || "")}>
                Restablecer
              </button>
              <button className="button button-primary" disabled={busy}>
                <Check size={16} />{busy ? "Guardando…" : "Guardar transmisión"}
              </button>
            </div>
          </form>

  </section>;
}
