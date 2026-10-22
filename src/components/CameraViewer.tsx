import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import {
  Camera as CameraIcon,
  Maximize2,
  RefreshCw,
  VideoOff,
} from "lucide-react";
import type { Camera } from "../types";
import "./monitoring.css";

interface CameraViewerProps {
  camera: Camera;
  towerName: string;
}

export default function CameraViewer({ camera, towerName }: CameraViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const offline = camera.status === "offline" || !camera.url;

  useEffect(() => {
    setError(null);
    setImageReady(false);
    if (camera.kind !== "hls" || offline || !videoRef.current) return;
    const video = videoRef.current;
    const onVideoError = () =>
      setError(
        "No se pudo reproducir esta cámara. Revisa la conexión y la URL configurada.",
      );
    video.addEventListener("error", onVideoError);
    let hls: Hls | undefined;
    let cancelled = false;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = camera.url;
    } else {
      import("hls.js")
        .then(({ default: HlsPlayer }) => {
          if (cancelled) return;
          if (!HlsPlayer.isSupported()) {
            setError(
              "Este navegador no permite reproducir transmisiones HLS. Usa una versión reciente de Chrome, Firefox o Safari.",
            );
            return;
          }
          hls = new HlsPlayer({ enableWorker: true, maxBufferLength: 20 });
          hls.on(HlsPlayer.Events.MEDIA_ATTACHED, () =>
            hls?.loadSource(camera.url),
          );
          hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
            if (data.fatal && !cancelled) {
              setError(
                "La transmisión no está disponible. Comprueba la URL HLS y los permisos de acceso de la cámara.",
              );
              hls?.destroy();
            }
          });
          hls.attachMedia(video);
        })
        .catch(() => {
          if (!cancelled)
            setError(
              "No se pudo cargar el reproductor. Vuelve a intentar la conexión.",
            );
        });
    }
    return () => {
      cancelled = true;
      video.removeEventListener("error", onVideoError);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [camera.id, camera.kind, camera.url, offline, attempt]);

  async function openFullscreen() {
    setFullscreenError(false);
    try {
      if (document.fullscreenElement === containerRef.current)
        await document.exitFullscreen();
      else if (containerRef.current?.requestFullscreen)
        await containerRef.current.requestFullscreen();
      else setFullscreenError(true);
    } catch {
      setFullscreenError(true);
    }
  }

  function retry() {
    setError(null);
    setAttempt((value) => value + 1);
  }

  return (
    <div className="camera-viewer" ref={containerRef}>
      <div className="camera-picture">
        {!offline && camera.kind === "hls" && (
          <video
            ref={videoRef}
            className={
              error ? "camera-video camera-video-hidden" : "camera-video"
            }
            controls
            playsInline
            preload="metadata"
            aria-label={`${camera.name} de ${towerName}`}
          />
        )}
        {!offline && camera.kind !== "hls" && !error && (
          <img
            key={`${camera.id}-${attempt}-${camera.url}`}
            src={camera.url}
            alt={`${camera.name} · ${towerName}${camera.kind === "demo" ? " · imagen ilustrativa de demostración" : ""}`}
            className={`camera-image${imageReady ? " camera-image-ready" : ""}`}
            onLoad={() => setImageReady(true)}
            onError={() =>
              setError("No se pudo cargar la imagen de esta cámara.")
            }
          />
        )}
        {(offline || error) && (
          <div className="camera-unavailable" role="status">
            <VideoOff size={31} strokeWidth={1.2} />
            <strong>
              {offline ? "Cámara sin conexión" : "Imagen no disponible"}
            </strong>
            <p>
              {offline
                ? "Configura una fuente de video para visualizar esta cámara."
                : error}
            </p>
            {!offline && (
              <button type="button" onClick={retry}>
                <RefreshCw size={14} /> Reintentar
              </button>
            )}
          </div>
        )}
        {!offline && !error && camera.kind !== "hls" && !imageReady && (
          <div className="camera-loading">Cargando imagen…</div>
        )}
        <div className="camera-topline">
          <span className="camera-label">
            <CameraIcon size={13} />
            {camera.name}
          </span>
          <span
            className={`camera-state${offline || error ? " camera-state-offline" : ""}`}
          >
            <i />
            {offline
              ? "SIN CONEXIÓN"
              : error
                ? "NO DISPONIBLE"
                : camera.kind === "demo"
                  ? "DEMO"
                  : camera.kind === "hls"
                    ? "FUENTE HLS"
                    : "IMAGEN"}
          </span>
        </div>
        {!offline && !error && camera.kind === "demo" && (
          <div className="camera-demo-notice">
            IMAGEN DE DEMOSTRACIÓN · SIN TRANSMISIÓN
          </div>
        )}
      </div>
      <div className="camera-bottomline">
        <span>
          {towerName}
          <span className="camera-source">
            {camera.kind === "demo"
              ? "Vista ilustrativa"
              : camera.kind === "hls"
                ? "Video HLS"
                : "Captura de cámara"}
          </span>
        </span>
        <div className="camera-actions">
          <button
            type="button"
            title="Actualizar cámara"
            aria-label={`Actualizar ${camera.name}`}
            onClick={retry}
            disabled={offline}
          >
            <RefreshCw size={15} />
          </button>
          <button
            type="button"
            title="Pantalla completa"
            aria-label={`Ver ${camera.name} en pantalla completa`}
            onClick={openFullscreen}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      {fullscreenError && (
        <p className="camera-fullscreen-error" role="status">
          La pantalla completa no está disponible en este navegador.
        </p>
      )}
    </div>
  );
}
