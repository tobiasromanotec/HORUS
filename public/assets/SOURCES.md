# Procedencia de las imágenes

## Marca HORUS

`horus-logo.png` es una adaptación del archivo `HORUS_logo-2018 (2).png` aportado por el usuario. Se conservó el emblema de ojo negro y amarillo y se retiraron los textos «DRON» e «IMÁGENES AÉREAS», dejando «HORUS». Adaptación realizada con la herramienta de edición de imágenes de OpenAI sobre la referencia del usuario. Fondo transparente. Los derechos de la marca y del original permanecen con su titular.

## Imágenes ilustrativas de equipos petroleros

| Archivo | Contenido |
| --- | --- |
| `rig-1.jpg` | Ilustración fotorrealista de una torre de perforación RIG en un paisaje inspirado en Vaca Muerta. |
| `rig-2.jpg` | Ilustración fotorrealista de una unidad WORKOVER sobre un pozo existente. |
| `rig-3.jpg` | Ilustración fotorrealista de una unidad PULLING para servicio de pozo. |

Estas tres imágenes fueron generadas mediante OpenAI el 21 de octubre de 2026 específicamente para la demostración de HORUS. **No son fotografías de torres reales, capturas de cámaras, evidencia de anomalías ni mediciones de campo.** Las escenas, vehículos, personal y localizaciones son ilustrativos. Su aparición en las cámaras y anomalías de demostración debe seguir identificada como tal en la interfaz.

Los PNG originales generados se conservaron en `/workspace/generated_images`; los JPG se obtuvieron mediante conversión de formato sin alterar la composición. Los recursos de producción están almacenados localmente y no requieren un servidor de imágenes externo.

## Cartografía local

`region.geojson` contiene geometría de Natural Earth, escala 1:10m, de dominio público. Los países Argentina y Chile provienen de `world-atlas`; límites provinciales y ríos provienen del repositorio público `nvkelso/natural-earth-vector`. El archivo declara su procedencia en la propiedad `source`. Las etiquetas de ciudades se posicionan por coordenadas geográficas. Es un respaldo cartográfico general, no un plano de ingeniería ni una herramienta de navegación de campo. El mapa en línea atribuye OpenStreetMap y CARTO cuando se solicita su cartografía.

Se intentó obtener fotografías públicas de Unsplash y Wikimedia mediante HTTPS con verificación TLS; la política de salida del entorno rechazó ambos destinos. No se descargaron ni incorporaron fotografías de terceros.
