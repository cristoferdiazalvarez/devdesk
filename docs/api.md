# API REST

Prefijo `/api`. Las respuestas son JSON salvo el cierre de sesión, que devuelve 204. Las escrituras requieren `Content-Type: application/json` y `Origin` igual a `WEB_ORIGIN`. El navegador conserva la cookie de sesión.

| Método | Ruta                    | Acceso y respuesta                                                                            |
| ------ | ----------------------- | --------------------------------------------------------------------------------------------- |
| GET    | `/health`               | Estado de PostgreSQL. 200 o 503                                                               |
| GET    | `/config`               | Pública. Indica si el registro está disponible                                                |
| POST   | `/auth/register`        | Si está habilitado, crea un cliente e inicia sesión. 201                                      |
| POST   | `/auth/login`           | Inicia sesión y devuelve id, nombre, correo y rol. 200                                        |
| GET    | `/auth/me`              | Devuelve el usuario de sesión. 200                                                            |
| POST   | `/auth/logout`          | Revoca la sesión y elimina la cookie. Enviar `{}`. 204                                        |
| GET    | `/dashboard`            | Total, recuentos por estado, urgentes sin resolver y seis tickets recientes dentro del ámbito |
| GET    | `/tickets`              | Lista paginada con `items`, `total`, `page`, `pageSize`                                       |
| POST   | `/tickets`              | Crea un ticket y un evento de creación. 201                                                   |
| GET    | `/tickets/:id`          | Detalle, comentarios e historial según el rol                                                 |
| PATCH  | `/tickets/:id`          | Actualiza gestión y registra valores anteriores y nuevos                                      |
| POST   | `/tickets/:id/comments` | Añade un comentario o una nota interna. 201                                                   |
| GET    | `/agents`               | Identificadores y nombres de agentes. Solo administradores                                    |

- Registro recibe `name`, `email` y `password` de 12 a 128 caracteres. Login recibe `email` y `password`.
- Crear ticket recibe `subject` (5–140), `description` (10–6000), `priority` y `category`. El identificador de URL es numérico y la interfaz lo presenta como `DD-1001`.
- El listado admite `q` por texto o ID, `status`, `priority`, `category` y `page` desde 1. Devuelve 10 tickets por página.
- PATCH recibe uno o más de `status`, `priority`, `category` y `assigneeId`. Solo el administrador puede enviar `assigneeId` con el UUID de un agente o `null`.
- Comentarios recibe `body` de hasta 4000 caracteres e `internal`, booleano opcional. Agentes con acceso al ticket y administradores pueden enviar notas internas.
- Estados `OPEN`, `IN_PROGRESS`, `WAITING`, `RESOLVED`. Prioridades `LOW`, `MEDIUM`, `HIGH`, `URGENT`. Categorías `ACCESS`, `TECHNICAL`, `BILLING`, `OTHER`.

Los errores devuelven `{ "error": "mensaje" }` y, para validación, `fields`. Los códigos incluyen 401 sin sesión, 403 para acciones fuera del rol, 404 para un ticket ausente o fuera del ámbito, 409 por conflicto, 422 para entradas inválidas y 429 por cuota.
