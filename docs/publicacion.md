# Publicación y recuperación de la demo

## Presupuesto cero

- Usa Vercel Hobby para el portfolio personal no comercial y el dominio `.vercel.app`. Hobby es gratuito y aplica límites de uso. [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- Usa una instancia Render Free y un workspace sin método de pago. Render concede 750 horas al mes por workspace y el servicio entra en reposo después de 15 minutos de inactividad. Sin método de pago, el exceso de ancho de banda suspende los servicios y el exceso de minutos de build pausa nuevas compilaciones. Si el workspace permite cargos, detén el alta. [Render Free](https://render.com/docs/free) · [Facturación de Render](https://render.com/docs/faq)
- Para una demo temporal, el Blueprint incluye PostgreSQL Free de Render, con 1 GB y caducidad a los 30 días. Para una URL de portfolio que deba durar más, usa una base Neon Free exclusiva (100 CU-horas, 1 GB de almacenamiento y 5 GB de transferencia por proyecto) y un servicio web en Render configurado manualmente con los comandos del Blueprint. Render puede suspender un servicio Free si genera mucho tráfico hacia bases externas. [Render Free](https://render.com/docs/free) · [Planes de Neon](https://neon.com/docs/introduction/plans)

## Configuración y restauración

1. Usa una base PostgreSQL dedicada exclusivamente a la demo. Guarda la conexión en `DATABASE_URL` mediante la configuración privada de Render. En Neon usa la conexión directa con TLS para el arranque y las migraciones.
2. Configura `WEB_ORIGIN` con el origen HTTPS exacto de Vercel y comprueba que la reescritura de API en `vercel.json` apunta al origen HTTPS del servicio de Render. Activa `DEMO_VIEW=true` y configura `ALLOW_REGISTRATION=false` en Render.
3. El comando `npm run start:render` aplica las migraciones y crea los datos ficticios. El público accede con un perfil virtual de solo lectura. Las cuentas con contraseña conocida solo se usan en local. En la base pública se generan contraseñas aleatorias y se bloquean login, registro, escrituras y notas internas.
4. Para una restauración completa, provisiona una base vacía y gratuita para la demo, actualiza el secreto `DATABASE_URL` y reinicia el servicio. El arranque reconstruye el estado inicial. Reiniciar sobre la misma base recupera los registros ficticios ausentes y conserva los existentes. Mantén la base anterior hasta comprobar la nueva.

## Comprobación tras el despliegue

Desde la URL de Vercel, verifica HTTPS, carga directa de un detalle, métricas, filtros, paginación y diseño móvil. Comprueba `/api/health`, que la respuesta del detalle omite notas internas y que solicitudes de escritura y registro devuelven 403. Confirma que el proxy conserva el origen y que las respuestas de la API usan `Cache-Control: no-store`. Comprueba las cookies y roles con la instalación privada de pruebas, ya que el modo público no emite sesiones. Verifica que el workflow de GitHub Actions termina en verde en el commit publicado.
