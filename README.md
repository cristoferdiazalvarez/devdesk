# DevDesk

Mesa de ayuda para gestionar tickets, conversaciones y actividad de soporte. Incluye una demo de portfolio en español y tres roles con permisos aplicados por la API.

## Arquitectura

| Ruta                       | Contenido                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/web`                 | SPA React, TypeScript, Vite, Tailwind CSS y TanStack Query                                            |
| `apps/api`                 | Express, TypeScript, Zod, Prisma y PostgreSQL                                                         |
| `apps/api/prisma`          | Esquema, migración versionada y relaciones entre usuarios, tickets, comentarios, historial y sesiones |
| `tests`                    | Vitest, Supertest y Playwright                                                                        |
| `.github/workflows/ci.yml` | Verificación automática con PostgreSQL y Chromium                                                     |

El navegador llama a `/api` en su mismo origen. Vite reenvía las peticiones en local y Vercel las reescribe hacia Render. El servidor decide qué tickets puede consultar cada sesión. Los cambios de gestión e historial se guardan en la misma transacción.

| Rol           | Tickets visibles       | Acciones                                                                                        |
| ------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| Cliente       | Propios                | Crear y comentar públicamente                                                                   |
| Agente        | Asignados a su usuario | Crear para sí mismo, actualizar estado, categoría y prioridad, comentar y añadir notas internas |
| Administrador | Todos                  | Acciones de agente y asignación a agentes                                                       |

## Arranque local

Necesitas Node.js 22.12 o posterior, npm y PostgreSQL. Compose permite iniciar PostgreSQL de forma reproducible. Si ya tienes PostgreSQL, crea una base dedicada y ajusta `DATABASE_URL`.

```bash
# Solo en un workspace nuevo, antes de crear .env.
test ! -e .env && (
  umask 077
  db_password="$(openssl rand -hex 24)"
  demo_password="$(openssl rand -hex 24)"
  sed -e "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$db_password/" \
      -e "s/^LOCAL_DEMO_PASSWORD=$/LOCAL_DEMO_PASSWORD=$demo_password/" \
      -e "s|^DATABASE_URL=$|DATABASE_URL=postgresql://devdesk:$db_password@127.0.0.1:5432/devdesk|" \
      .env.example > .env
)
docker compose up -d --wait
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). La comprobación de salud está en [http://localhost:4000/api/health](http://localhost:4000/api/health).

### Datos ficticios

Ejecutar el seed otra vez conserva las solicitudes existentes. Los usuarios ficticios comparten el valor de `LOCAL_DEMO_PASSWORD` que se generó en tu `.env` local. Repetir el seed actualiza sus contraseñas.

| Correo ficticio           | Rol           |
| ------------------------- | ------------- |
| `admin@devdesk.example`   | Administrador |
| `agente@devdesk.example`  | Agente        |
| `cliente@devdesk.example` | Cliente       |

La demo pública usa una base exclusiva y `DEMO_VIEW=true`. El inicio carga datos ficticios con contraseñas aleatorias y la API ofrece una vista pública de agente de solo lectura. Las rutas de escritura, registro, login y logout están bloqueadas. El listado y el detalle solo muestran tickets marcados por el seed y omiten las notas internas. Usa una base diferente para cualquier instalación con usuarios reales.

### Variables

| Variable              | Uso                                                                           |
| --------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`        | Conexión de PostgreSQL. Solo en la API, Prisma y tareas de datos              |
| `WEB_ORIGIN`          | Origen exacto autorizado, sin barra final. HTTPS en producción                |
| `PORT`                | Puerto de Express. Vite reenvía al 4000 en desarrollo                         |
| `NODE_ENV`            | `development`, `test` o `production`                                          |
| `ALLOW_REGISTRATION`  | Habilita registro como cliente. Por defecto está apagado en producción        |
| `TRUST_PROXY_HOPS`    | Saltos de proxy confiables para los límites por IP. Local `0`                 |
| `DEMO_VIEW`           | Activa la demo pública de solo lectura                                        |
| `POSTGRES_PASSWORD`   | Contraseña de la instancia local de Compose                                   |
| `LOCAL_DEMO_PASSWORD` | Contraseña local compartida por los usuarios ficticios y usada por Playwright |
| `TEST_DATABASE_URL`   | Base dedicada ya migrada para integración                                     |

## Pruebas y capturas

Usa una base de pruebas separada. Sustituye el valor de ejemplo por su conexión local.

```bash
export DATABASE_URL="postgresql://devdesk:<contraseña-local>@127.0.0.1:5432/devdesk_test"
export TEST_DATABASE_URL="$DATABASE_URL"
npm run db:migrate
npm run typecheck
npm run lint
npm test
npm run build
npm run db:seed
npx playwright install chromium
npm run e2e
```

E2E utiliza los puertos 4400 y 4173, separados del servidor de desarrollo. Playwright inicia los artefactos compilados y prueba escritorio y móvil. Guarda las capturas del resumen en `test-results` y el informe en `playwright-report`. E2E crea solicitudes ficticias en la base indicada. `npm run format` aplica Prettier. Para desarrollar una nueva migración, usa `npm exec -w apps/api -- prisma migrate dev --name nombre` contra la base de desarrollo.

## API REST

Consulta [el contrato de la API](docs/api.md).

## Despliegue preparado

1. Una vez autorizado el despliegue, usa `render.yaml` en un Blueprint de Render para crear el servicio web y PostgreSQL en modalidad gratuita. Configura `WEB_ORIGIN` con el origen HTTPS previsto para Vercel. Render ejecuta la migración al iniciar y genera los datos ficticios de la demo. [Referencia del Blueprint](https://render.com/docs/blueprint-spec)
2. En Vercel, deja la raíz del proyecto en la raíz del monorepo, selecciona Node.js 22 y verifica que `vercel.json` apunta al origen HTTPS del servicio Render. El archivo compila la web y configura las reescrituras. [Configuración de Vercel](https://vercel.com/docs/project-configuration/vercel-json)
3. Comprueba desde el origen final la salud, la lista, el detalle y el bloqueo de escrituras. Para una instalación privada aparte, usa una base propia, desactiva `DEMO_VIEW`, crea los usuarios de soporte con el comando siguiente y habilita registro solo si corresponde.

Consulta [los límites de los planes gratuitos, la restauración y las verificaciones de publicación](docs/publicacion.md).

### Alta privada de administradores y agentes

Desde un entorno de confianza conectado a la base privada, exporta su `DATABASE_URL` y usa una contraseña única de al menos 16 caracteres. Ejemplo en Bash, con lectura sin eco:

```bash
read -rs PROVISION_PASSWORD
PROVISION_PASSWORD="$PROVISION_PASSWORD" npm run db:user -- ADMIN admin@example.invalid "Nombre de administración"
unset PROVISION_PASSWORD
```

Sustituye `ADMIN` por `AGENT` para provisionar un agente. El comando crea una cuenta nueva y rechaza correos ya existentes.

### Seguridad y límites conocidos

- Las contraseñas se derivan con scrypt y sal aleatoria. Los tokens de sesión aleatorios se almacenan por hash y caducan a las ocho horas. La cookie usa HttpOnly, SameSite=Lax y Secure en producción. Las escrituras requieren JSON y un origen exacto.
- Los límites de solicitudes son por IP y proceso. Al operar detrás de un proxy compartido, varios visitantes pueden compartir cuota. Verifica la IP observada antes de habilitar registro público. Las sesiones vencidas se eliminan al iniciar una nueva sesión.
- Una instalación representa un solo espacio de soporte. Quedan fuera la administración de cuentas desde la interfaz, la recuperación de contraseña, el envío de email, los adjuntos y la facturación del producto.
- Consulta [la revisión de dependencias y el riesgo residual](docs/dependencias.md).
- Los planes gratuitos de Render tienen límites y pueden entrar en reposo. Comprueba sus condiciones y disponibilidad antes de conectar el repositorio. [Render Free](https://render.com/docs/free)

Licencia [MIT](LICENSE).
