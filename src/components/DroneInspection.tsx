import { useState, type FormEvent } from "react";
import { Check, ExternalLink, Play, RotateCw, Settings2, X } from "lucide-react";
import { api } from "../lib/api";
import type { Tower } from "../types";
import "./drone-inspection.css";

export default function DroneInspection({
  tower,
  canEdit,
  onSaved,
}: {
  tower: Tower;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const source = tower.droneInspection;
  const [watching, setWatching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(source?.url || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const formId = `drone-config-${tower.id}`;
  const playerId = `drone-player-${tower.id}`;

  function configure() {
    setUrl(source?.url || "");
    setError("");
    setNotice("");
    setEditing(true);
  }

  async function save(nextUrl: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/towers/${tower.id}/drone-inspection`, {
        method: "PATCH",
        body: JSON.stringify({ url: nextUrl }),
      });
      await onSaved();
      setWatching(false);
      setEditing(false);
      setNotice(nextUrl.trim() ? "Transmisión guardada para este equipo." : "Enlace de la inspección eliminado.");
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

  return (
    <section className="drone-inspection" aria-labelledby={`drone-title-${tower.id}`}>
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
          <span className="drone-eyebrow">INSPECCIÓN AÉREA · {tower.name}</span>
          <h2 id={`drone-title-${tower.id}`}>Ver inspección con dron en vivo</h2>
          <p>Una mirada desde el aire a la inspección de esta torre.</p>
        </div>
        <span className={`drone-badge ${source ? "drone-configured" : ""}`}>
          {source ? "Enlace disponible" : "Sin transmisión configurada"}
        </span>
      </div>

      <div className="drone-body">
        <div className="drone-controls">
          <p>
            {source
              ? "Abrí el video aquí. YouTube indica si la inspección está en vivo, programada o finalizada."
              : canEdit
                ? "Vinculá el enlace de YouTube de la inspección para que tu equipo pueda seguirla desde aquí."
                : "Todavía no hay una transmisión vinculada. Una cuenta administradora puede configurar la inspección de esta torre."}
          </p>
          <div className="drone-actions">
            {source && (
              <button
                className="button button-primary"
                onClick={() => setWatching(!watching)}
                aria-expanded={watching}
                aria-controls={playerId}
              >
                {watching ? <X size={16} /> : <Play size={16} />}
                {watching ? "Cerrar transmisión" : "Ver transmisión"}
              </button>
            )}
            {canEdit && !editing && (
              <button className="button button-secondary" onClick={configure} aria-controls={formId}>
                <Settings2 size={16} /> {source ? "Editar transmisión" : "Configurar transmisión"}
              </button>
            )}
          </div>
        </div>

        {notice && <p className="drone-notice" role="status"><Check size={16} />{notice}</p>}

        {editing && canEdit && (
          <form id={formId} className="tower-form drone-form" onSubmit={submit} aria-label="Configurar inspección con dron">
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
              <button type="button" className="button button-secondary" disabled={busy} onClick={() => setEditing(false)}>
                Cancelar
              </button>
              <button className="button button-primary" disabled={busy}>
                <Check size={16} />{busy ? "Guardando…" : "Guardar transmisión"}
              </button>
            </div>
          </form>
        )}

        {watching && source && (
          <div id={playerId} className="drone-player">
            <div className="drone-video">
              <iframe
                key={`${source.videoId}-${retry}`}
                title={`Inspección con dron de ${tower.name}`}
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
