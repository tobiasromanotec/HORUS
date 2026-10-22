# Publicar la demostración en Render

La raíz del repositorio incluye `render.yaml`, que define un servicio web gratuito con Node.js 24. La aplicación, la API y las imágenes se sirven desde un único dominio HTTPS.

## Activación en la cuenta del propietario

1. Inicia sesión o crea tu cuenta de Render.
2. Conecta GitHub y permite acceso al repositorio `tobiasromanotec/HORUS`.
3. Crea un **Blueprint** desde ese repositorio y selecciona la rama `main`. Render leerá `render.yaml`.
4. Comprueba que el servicio sea `horus-demo` y el plan sea **Free** antes de confirmar el despliegue.
5. Cuando el servicio aparezca como **Live**, abre la dirección HTTPS que Render le haya asignado. La dirección exacta depende de la disponibilidad del nombre y debe copiarse del panel; no se presupone un dominio concreto.

En la pantalla inicial, pulsa **Completar acceso de demostración** y después **Iniciar sesión**.

## Configuración incluida

- Instala desde el lockfile y compila React/TypeScript durante el despliegue.
- Arranca Express usando el puerto que proporciona Render.
- Comprueba disponibilidad con `/api/health`.
- Activa modo demostración y cookies HTTPS. Usa `RENDER_EXTERNAL_URL` como origen de confianza para las escrituras.
- Guarda SQLite en `/tmp/horus-demo`, separado de la base local de desarrollo.
- No necesita subir `.env`, cuentas de desarrollo, bases de datos o claves privadas.

## Alcance del plan gratuito

Esta configuración sirve para mostrar y probar HORUS con datos de ejemplo. El almacenamiento es temporal: los cambios, las cuentas y las sesiones pueden reiniciarse cuando Render sustituya o reinicie la instancia. El servicio también puede suspenderse por inactividad y tardar en responder al volver a abrirse, según las condiciones del plan.

Para usar datos reales hace falta elegir un almacenamiento persistente, configurar credenciales propias y conectar las fuentes de campo. No cambies el servicio a un plan de pago sin revisar y aceptar sus costes en Render.

## Verificación después del despliegue

- `/api/health` devuelve `{"status":"ok","demo":true}`.
- El login de demostración permite entrar y la cookie `horus_session` es HttpOnly, SameSite=Strict y Secure.
- Se ven las seis torres, el logo sin texto, las cámaras ilustrativas y las anomalías.
- Las escrituras del mismo dominio funcionan y el cierre de sesión invalida el acceso a la API.

El repositorio y el Blueprint preparados no equivalen a un sitio publicado. La publicación solamente está confirmada cuando Render entrega un dominio activo y estas comprobaciones pasan desde ese dominio.
