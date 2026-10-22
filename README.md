# HORUS · Supervisión de torres petroleras

Aplicación web en español para **RIG, PULLING y WORKOVER**: inicio de sesión, mapa de equipos, catálogo, cámaras, parámetros operativos y seguimiento de anomalías con imágenes. El emblema aportado se adaptó para conservar solamente el nombre **HORUS**.

## Ejecutar

Requisitos: **Node.js 24 o superior**, npm y, para las pruebas de navegador, Chromium.

```bash
cd /workspace/HORUS
npm ci
npm run dev
```

El frontend usa el puerto **5173** y la API el **3001**. En el formulario de acceso, el botón **Completar acceso de demostración** carga la cuenta de ejemplo; luego pulsa **Iniciar sesión**. No se necesita configurar servicios externos para explorar la demostración. La API también verifica la autenticación: ocultar la interfaz no es la protección de los datos.

La demostración contiene seis torres ubicadas en la cuenca neuquina, tres cámaras por torre, cuatro parámetros por equipo y cinco anomalías. Los datos y las imágenes son **ilustrativos**, no corresponden a instalaciones ni transmisiones reales. Las torres nuevas comienzan sin telemetría y con cámaras desconectadas.

## Funcionalidades

- Sesiones de servidor con cookies HttpOnly, expiración de ocho horas, cierre de sesión y contraseñas protegidas con scrypt. Permisos de administrador y observador en la API.
- Panel con cantidades calculadas desde la base de datos y actualización de datos cada 30 segundos mientras la página está visible.
- Mapa navegable con coordenadas, selección de torre, filtros y acceso al detalle. Incluye cartografía local de Argentina y Chile, límites provinciales y ríos para mantener las ubicaciones visibles sin mapas externos.
- Catálogo con búsqueda por equipo, ubicación u operador, filtros por tipo y estado, y formulario para incorporar torres.
- Ficha del equipo con cámaras, parámetros e historial gráfico, anomalías y ubicación.
- Cámaras configurables: imagen HTTPS o transmisión HLS, controles de video, reconexión y pantalla completa. El reproductor HLS se descarga solamente cuando hace falta.
- Inspección con dron por torre: enlace de YouTube configurable por administradores, reproductor integrado bajo demanda, pantalla completa y acceso alternativo a YouTube. Ver [la guía de uso](docs/INSPECCION-DRON.md).
- Anomalías con imagen, prioridad, fecha, cámara de origen y estado persistente: pendiente, revisada o resuelta.
- Interfaces adaptadas a escritorio y móvil; navegación por teclado y diálogos con foco contenido.

## Datos y configuración

SQLite guarda cuentas, sesiones, torres y anomalías en `.local/horus.sqlite`. Las pruebas usan bases temporales independientes. No borres `.local` para actualizar o reiniciar la aplicación. `.env`, bases de datos y resultados de pruebas están excluidos de Git.

Puedes crear un `.env` local a partir de `.env.example`, conservando cualquier configuración existente. `server/index.mjs` lo carga automáticamente. Las variables ya presentes en el proceso tienen prioridad.

| Variable                                      | Uso                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DEMO_MODE`                                   | `true` permite la demostración. En desarrollo es el valor predeterminado; en producción debe ser explícito.                                                        |
| `DATA_DIR`                                    | Directorio persistente de SQLite. Utiliza directorios distintos para demostración y operación real.                                                                |
| `PORT`                                        | Puerto del servidor; predeterminado 3001. El proxy de desarrollo espera 3001.                                                                                      |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Creación inicial de la cuenta administradora para una instalación real. La contraseña debe tener entre 12 y 512 caracteres. No se sobrescriben cuentas existentes. |
| `PUBLIC_ORIGIN`                               | Origen HTTPS público exacto, sin ruta ni barra final, para validar solicitudes de escritura.                                                                       |
| `TRUST_PROXY`                                 | Usa `1` solamente detrás de un único proxy de confianza que controle los encabezados reenviados.                                                                   |
| `COOKIE_SECURE`                               | En producción es `true` de forma predeterminada; requiere HTTPS.                                                                                                   |

Para recuperar una cuenta administradora existente:

```bash
node server/reset-password.mjs
```

El comando pide correo y contraseña en una terminal interactiva, oculta la contraseña y revoca las sesiones anteriores. No acepta contraseñas como argumentos ni por tuberías.

## Conectar las instalaciones

1. Registra cada torre con sus coordenadas y datos operativos.
2. En **Equipo → Cámaras → Configurar**, introduce una imagen HTTPS o una dirección HLS `.m3u8`. La disponibilidad configurada no certifica la conexión: el reproductor muestra errores si la fuente falla. Una cámara RTSP requiere una pasarela RTSP → HLS. El navegador debe tener acceso a la red de cámaras, y HLS necesita CORS habilitado. No incluyas usuario y contraseña en la URL.
3. Un sistema de adquisición autenticado puede cargar parámetros y hallazgos mediante la API descrita en [docs/API.md](docs/API.md). No se implementa un detector automático de anomalías ni un conector específico de PLC/SCADA sin conocer los protocolos de campo.

Las imágenes de anomalías se referencian mediante HTTPS; la aplicación no almacena archivos de evidencia subidos. Utiliza un servicio de imágenes con control de acceso acorde a tus instalaciones. Las mediciones son las últimas recibidas, no un histórico industrial completo. La lectura automática de cámaras/sensores reales requiere sus direcciones y permisos; no se ha certificado ninguna instalación de campo.

## Validación

```bash
npm run build       # TypeScript y compilación de producción
npm test            # Integración HTTP, SQLite y controles de acceso
npm run test:e2e    # Recorridos completos sobre la compilación de producción
npm run check      # Las tres comprobaciones anteriores, en orden
npm audit          # Vulnerabilidades publicadas para las dependencias instaladas
```

Las pruebas E2E usan Chromium del sistema (`/usr/bin/chromium`) si existe. Se puede indicar otra ruta con `CHROMIUM_PATH` o instalar el navegador administrado por Playwright con `npx playwright install chromium` y sus dependencias de sistema. Las pruebas arrancan su propio servidor en el puerto 3101 y no modifican los datos de desarrollo. Ejecuta `npm run build` antes de ejecutar `test:e2e` de forma aislada.

El video de prueba HLS contiene un patrón sintético local; permite verificar reproducción real, pero no certifica una transmisión externa. Los resultados visuales quedan en `.local/audit`; los informes y trazas de Playwright en `playwright-report` y `test-results`.

Consulta [docs/VALIDACION.md](docs/VALIDACION.md) para conocer los resultados y límites de la revisión realizada.

## Despliegue

Compila con `npm run build` y arranca con `npm start`. Express sirve la aplicación compilada y la API en un mismo origen. Configura `DEMO_MODE=false`, credenciales iniciales propias, un `DATA_DIR` persistente diferente al de demostración y HTTPS mediante un proxy inverso. Ajusta `PUBLIC_ORIGIN` al dominio publicado. Las credenciales de ejemplo están bloqueadas para una instalación real.

Para comprobar únicamente la compilación en HTTP local, se puede ejecutar `DEMO_MODE=true COOKIE_SECURE=false npm start`. Esa combinación sirve para una demostración local, no para publicar datos reales.

Respalda SQLite de forma coherente con su modo WAL: usa el mecanismo de backup de SQLite o detén el servidor y copia la base junto con sus archivos WAL/SHM si existen. No copies únicamente el archivo principal mientras hay escrituras. Para varias instancias, gran volumen, SSO/MFA, auditoría normativa o retención industrial de telemetría será necesario ampliar la arquitectura de esta primera versión.

## Estructura y recursos

- `src/`: aplicación React/TypeScript, rutas, estilos y componentes de mapa/cámaras.
- `server/`: Express, SQLite, autenticación, validaciones y pruebas.
- `tests/`: pruebas E2E y segmentos sintéticos HLS.
- `public/assets/`: marca, imágenes ilustrativas y cartografía local; procedencia en [SOURCES.md](public/assets/SOURCES.md).
- `scripts/setup.sh`: instalación reproducible desde el lockfile y compilación.

Las fuentes tipográficas, imágenes y cartografía de respaldo están incluidas localmente. La cartografía en línea utiliza `a.basemaps.cartocdn.com` a `d.basemaps.cartocdn.com` con atribución a OpenStreetMap y CARTO. Si la red bloquea esos destinos, se muestra un aviso y se conserva el mapa local. Cada tarea en la nube ya está aislada; trabaja en este checkout existente, sin crear otro worktree salvo petición explícita.
