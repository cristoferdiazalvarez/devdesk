import { randomBytes } from "node:crypto";
import { settings } from "./config.js";
import { database } from "./database.js";
import { hashPassword } from "./security.js";
import type { Category, Priority, Role, Status } from "./generated/client.js";

const publicDemo = process.argv.includes("--public-demo");
if (
  settings.NODE_ENV === "production" &&
  (!publicDemo || settings.DEMO_VIEW !== "true")
) {
  throw new Error("El seed local solo se ejecuta fuera de producción.");
}
const password = publicDemo
  ? randomBytes(32).toString("hex")
  : process.env.LOCAL_DEMO_PASSWORD;
if (!password || password.length < 16 || password.length > 128) {
  throw new Error(
    "Configura LOCAL_DEMO_PASSWORD con entre 16 y 128 caracteres.",
  );
}
const db = database(settings.DATABASE_URL);
const people = [
  { email: "admin@devdesk.example", name: "Alex Rivera", role: "ADMIN" },
  { email: "agente@devdesk.example", name: "Mar Torres", role: "AGENT" },
  { email: "cliente@devdesk.example", name: "Leo Moreno", role: "CUSTOMER" },
  { email: "lucia@devdesk.example", name: "Lucía Vega", role: "CUSTOMER" },
] satisfies { email: string; name: string; role: Role }[];
const subjects: [string, Category, Priority, Status][] = [
  ["Error al iniciar sesión en el portal", "ACCESS", "HIGH", "IN_PROGRESS"],
  ["La exportación de informes queda pendiente", "TECHNICAL", "URGENT", "OPEN"],
  ["Actualizar el correo de facturación", "BILLING", "LOW", "WAITING"],
  ["Permisos para el espacio de trabajo", "ACCESS", "MEDIUM", "RESOLVED"],
  [
    "Los adjuntos no se abren en el navegador",
    "TECHNICAL",
    "HIGH",
    "IN_PROGRESS",
  ],
  ["Consulta sobre el historial de actividad", "OTHER", "LOW", "RESOLVED"],
  ["No aparece la factura de octubre", "BILLING", "MEDIUM", "OPEN"],
  ["Restablecer acceso al panel de soporte", "ACCESS", "HIGH", "WAITING"],
  ["El buscador no encuentra conversaciones", "TECHNICAL", "MEDIUM", "OPEN"],
  ["Cambiar el nombre del espacio de trabajo", "OTHER", "LOW", "RESOLVED"],
  ["Aviso duplicado al generar un informe", "TECHNICAL", "LOW", "OPEN"],
  ["Consulta sobre el cierre de solicitudes", "OTHER", "LOW", "RESOLVED"],
  ["Revisión de una incidencia de acceso", "ACCESS", "URGENT", "OPEN"],
  ["Aclaración sobre el resumen de cobros", "BILLING", "MEDIUM", "WAITING"],
];
try {
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const users = await Promise.all(
      people.map((person) =>
        tx.user.upsert({
          where: { email: person.email },
          update: { passwordHash },
          create: { ...person, passwordHash },
        }),
      ),
    );
    const [, agent, customer, other] = users;
    for (const [
      index,
      [subject, category, priority, status],
    ] of subjects.entries()) {
      const id = 1001 + index;
      const owner = index % 3 === 0 ? other : customer;
      const createdAt = new Date(Date.now() - index * 86_400_000 - 7200_000);
      await tx.ticket.upsert({
        where: { id },
        update: {},
        create: {
          id,
          demoData: true,
          subject,
          category,
          priority,
          status,
          ownerId: owner.id,
          assigneeId: index < 11 ? agent.id : null,
          description: `Solicitud ficticia de soporte: ${subject}. La incidencia se reproduce en el entorno de demostración. Se solicita revisar el comportamiento y confirmar los pasos a seguir.`,
          createdAt,
          updatedAt: createdAt,
          events: {
            create: [
              { actorId: owner.id, field: "CREATED", createdAt },
              ...(status === "OPEN"
                ? []
                : [
                    {
                      actorId: agent.id,
                      field: "status",
                      before: "OPEN",
                      after: status,
                      createdAt: new Date(createdAt.getTime() + 60_000),
                    },
                  ]),
            ],
          },
          comments:
            index === 0
              ? {
                  create: [
                    {
                      authorId: agent.id,
                      body: "He revisado el acceso. ¿Puedes confirmar si ocurre también en una ventana privada?",
                      createdAt,
                    },
                    {
                      authorId: agent.id,
                      body: "Comprobar el registro ficticio antes de actualizar el estado.",
                      internal: true,
                      createdAt: new Date(createdAt.getTime() + 120_000),
                    },
                  ],
                }
              : undefined,
        },
      });
    }
    await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('"Ticket"', 'id'), GREATEST((SELECT max(id) FROM "Ticket"), (SELECT last_value FROM "Ticket_id_seq")))`;
  });
  console.log("Datos ficticios disponibles.");
} finally {
  await db.$disconnect();
}
