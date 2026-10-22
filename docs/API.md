# API de integración

Todas las rutas usan JSON y el prefijo `/api`. Excepto `GET /health`, `POST /auth/login` y `POST /auth/logout`, requieren una sesión válida. Las escrituras de torres, cámaras, parámetros y anomalías requieren rol `admin`. El navegador usa la cookie de sesión automáticamente; un proceso de integración debe conservar la cookie recibida por `POST /auth/login` y renovarla al expirar. No hay tokens permanentes para dispositivos.

Las peticiones con cuerpo requieren `Content-Type: application/json`, con un límite de 32 KiB. Si se envía `Origin`, debe coincidir con el origen configurado. Los errores devuelven `{ "error": "Descripción" }` con estado 400, 401, 403, 404, 409, 413, 415 o 429 según el caso. Los datos privados tienen `Cache-Control: no-store`.

## Sesión y catálogo

| Método y ruta       | Entrada / respuesta                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `GET /health`       | `{status: "ok", demo: boolean}`                                                             |
| `POST /auth/login`  | `{email, password}` → `{user}` y cookie HttpOnly. No registres el cuerpo de esta solicitud. |
| `GET /auth/me`      | `{user}`                                                                                    |
| `POST /auth/logout` | Revoca la sesión → `{ok: true}`                                                             |
| `GET /towers`       | `{towers: Tower[]}`                                                                         |
| `GET /towers/:id`   | `{tower}`                                                                                   |
| `POST /towers`      | `{name, type, location, operator, well, lat, lng}` → 201 `{tower}`                          |

`type`: `RIG`, `PULLING` o `WORKOVER`. `lat` y `lng` deben ser números, con rangos −90..90 y −180..180. El nombre debe ser único. Una torre nueva no tiene parámetros y sus tres cámaras están desconectadas.

## Cámara

`PATCH /towers/:id/cameras/:cameraId` recibe uno o varios campos:

```json
{
  "name": "Piso de perforación",
  "kind": "hls",
  "url": "https://camaras.example.com/rig-101/stream.m3u8",
  "status": "online"
}
```

`kind`: `hls`, `image` o `demo`; `status`: `online` u `offline`. Las fuentes reales deben usar HTTPS sin credenciales embebidas. Las de demostración usan imágenes locales `/assets/archivo.jpg`. Se permite una URL vacía solamente con la cámara deshabilitada. Respuesta: `{camera}`. El servidor guarda la configuración; el navegador solicita el contenido directamente a la fuente, sin proxy de video ni servidor RTSP incorporado.

## Inspección con dron por YouTube

`PATCH /towers/:id/drone-inspection` requiere una cuenta administradora:

```json
{ "url": "https://www.youtube.com/live/ID_DEL_VIDEO" }
```

Usa el enlace de una transmisión o video real (su identificador tiene 11 caracteres). Se admiten enlaces HTTPS de YouTube `watch?v=…`, `/live/…`, `youtu.be/…`, `/embed/…` y `/shorts/…`. Se rechazan otros dominios, URLs de canal, credenciales, HTML y campos adicionales. Los parámetros de seguimiento y reproducción se eliminan al guardar. `{ "url": "" }` quita la asociación sin afectar cámaras, mediciones, estados ni fechas de telemetría.

Respuesta: `{tower}`, con `droneInspection: {videoId, url, updatedAt}` o `null` al quitar el enlace. Las torres anteriores pueden omitir este campo: no necesitan migración ni cambios en sus datos. La configuración se guarda en la misma base SQLite y pertenece únicamente a la torre indicada; los observadores pueden consultarla, pero no cambiarla.

El navegador carga el reproductor de `www.youtube-nocookie.com` solamente cuando el usuario pulsa **Ver transmisión**. YouTube informa el estado real del video: HORUS no certifica que un enlace configurado esté emitiendo en vivo. La transmisión debe permitir inserción y ser accesible al visitante. No se necesita una clave de API ni la clave de transmisión del canal. El atributo `referrerPolicy` del iframe envía el origen del sitio a YouTube para identificar al reproductor, sin enviar la ruta de la torre.

## Parámetros

`PATCH /towers/:id/telemetry` reemplaza atómicamente las mediciones actuales y actualiza `updatedAt`:

```json
{
  "status": "operativo",
  "parameters": [
    {
      "key": "hook_load",
      "label": "Carga de gancho",
      "value": 78,
      "unit": "t",
      "min": 0,
      "max": 120,
      "history": [70, 74, 78]
    }
  ]
}
```

Se admiten de 1 a 12 parámetros, claves únicas, números finitos y entre 1 y 60 muestras por historial. `min` debe ser menor que `max`. Los límites son referencias de visualización, no una validación de ingeniería ni un interbloqueo. Se admiten valores fuera de referencia para que puedan representarse fallas reales. El estado es opcional (`operativo`, `atencion`, `desconectado`); no se deduce automáticamente del valor o de la disponibilidad de las cámaras. Respuesta: `{tower}`.

El integrador debe producir el historial y las unidades adecuadas a cada equipo. Esta ruta conserva la identidad de demostración y la configuración de cámaras.

## Anomalías

`POST /towers/:id/anomalies` registra un hallazgo:

```json
{
  "title": "Presión de bomba elevada",
  "description": "Revisar el circuito de bombeo según el procedimiento de la instalación.",
  "severity": "critica",
  "camera": "identificador-de-una-camara-del-equipo",
  "image": "https://imagenes.example.com/evidencia.jpg",
  "timestamp": "2026-01-15T14:30:00.000Z"
}
```

`severity`: `critica`, `media` o `baja`. `camera` acepta un identificador o nombre de cámara del mismo equipo. `timestamp` es opcional, en ISO 8601 UTC terminado en `Z`; si falta, se usa la hora del servidor. Se rechazan fechas inexistentes o futuras con más de un minuto de tolerancia. La imagen debe ser una URL HTTPS sin credenciales o una imagen local de demostración. La respuesta es 201 `{anomaly}` con estado inicial `pendiente`.

- `GET /anomalies`: todos los hallazgos, ordenados del más reciente al más antiguo.
- `GET /anomalies?towerId=:id`: hallazgos del equipo indicado.
- `PATCH /anomalies/:id` con `{ "status": "resuelta" }`: guarda el estado; también admite `pendiente` y `revisada`.

No se ejecuta detección por visión artificial: los registros provienen de la demostración o de un sistema que use esta API. Las direcciones `example.com` de esta documentación son marcadores de ejemplo, no servicios operativos.
