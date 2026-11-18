import { z } from "zod";
import { settings } from "./config.js";
import { database } from "./database.js";
import { hashPassword } from "./security.js";

const [role, email, name] = process.argv.slice(2);
const input = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    name: z.string().trim().min(2).max(80),
    role: z.enum(["ADMIN", "AGENT"]),
    password: z.string().min(16).max(128),
  })
  .safeParse({ role, email, name, password: process.env.PROVISION_PASSWORD });

if (!input.success || settings.DEMO_VIEW === "true") {
  console.error(
    "Indica ADMIN o AGENT, correo, nombre y PROVISION_PASSWORD de 16 a 128 caracteres. Usa una base privada.",
  );
  process.exit(1);
}
const db = database(settings.DATABASE_URL);
try {
  const { password, ...user } = input.data;
  await db.user.create({
    data: { ...user, passwordHash: await hashPassword(password) },
    select: { id: true },
  });
  console.log("Usuario de soporte creado.");
} catch {
  console.error(
    "No se pudo crear el usuario. Comprueba la conexión y que el correo esté disponible.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
