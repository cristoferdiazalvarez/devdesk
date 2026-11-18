import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../apps/api/src/app";
import { database } from "../apps/api/src/database";
import { hashPassword } from "../apps/api/src/security";
import type { Role } from "../apps/api/src/generated/client";

const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error(
    "Configura TEST_DATABASE_URL con una base de pruebas migrada.",
  );
const db = database(url);
const origin = "http://localhost:5173";
const app = createApp(db, { origin, allowRegistration: true });
const password = randomUUID();
const emails: string[] = [];
const ids: number[] = [];
const marker = randomUUID();
const demoData = {
  subject: "Incidencia de prueba " + marker,
  description: "Descripción reproducible para la prueba de integración.",
  category: "TECHNICAL",
  priority: "HIGH",
};
let customer: ReturnType<typeof request.agent>;
let admin: ReturnType<typeof request.agent>;
let agent: ReturnType<typeof request.agent>;
let outside: ReturnType<typeof request.agent>;
let agentId: string;
let ticketId: number;

async function account(role: Role, passwordHash: string) {
  const email = role.toLowerCase() + "-" + randomUUID() + "@devdesk.example";
  emails.push(email);
  const user = await db.user.create({
    data: { email, name: role, passwordHash, role },
  });
  const session = request.agent(app);
  await session
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email, password })
    .expect(200);
  return { session, user };
}
beforeAll(async () => {
  const hash = await hashPassword(password);
  const [a, b, c, d] = await Promise.all([
    account("ADMIN", hash),
    account("AGENT", hash),
    account("CUSTOMER", hash),
    account("CUSTOMER", hash),
  ]);
  admin = a.session;
  agent = b.session;
  customer = c.session;
  outside = d.session;
  agentId = b.user.id;
  const result = await customer
    .post("/api/tickets")
    .set("Origin", origin)
    .send(demoData)
    .expect(201);
  ticketId = result.body.id;
  ids.push(ticketId);
});
afterAll(async () => {
  await db.ticket.deleteMany({ where: { id: { in: ids } } });
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.$disconnect();
});

describe("API REST sobre PostgreSQL", () => {
  it("registra un cliente, usa cookie HttpOnly y revoca la sesión", async () => {
    const session = request.agent(app);
    const email = "registro-" + randomUUID() + "@devdesk.example";
    emails.push(email);
    const body = { name: "Cliente ficticio", email, password };
    await session
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ ...body, role: "ADMIN" })
      .expect(422);
    const response = await session
      .post("/api/auth/register")
      .set("Origin", origin)
      .send(body)
      .expect(201);
    expect(response.body.role).toBe("CUSTOMER");
    expect(response.body).not.toHaveProperty("passwordHash");
    expect(response.headers["set-cookie"][0]).toMatch(/HttpOnly.*SameSite=Lax/);
    const staleCookie = response.headers["set-cookie"][0].split(";")[0];
    await session.get("/api/auth/me").expect(200);
    await session
      .post("/api/auth/logout")
      .set("Origin", origin)
      .send({})
      .expect(204);
    await request(app)
      .get("/api/auth/me")
      .set("Cookie", staleCookie)
      .expect(401);
    await session
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email, password: "incorrecta" })
      .expect(401);
    const production = createApp(db, { origin, production: true });
    const secure = await request(production)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email, password })
      .expect(200);
    expect(secure.headers["set-cookie"][0]).toMatch(
      /^__Host-devdesk=.*Path=\/.*HttpOnly.*Secure.*SameSite=Lax/,
    );
  });
  it("restringe propiedad, asignación, listados, métricas y cambios de roles", async () => {
    await outside.get("/api/tickets/" + ticketId).expect(404);
    await customer
      .post("/api/tickets")
      .set("Origin", "https://otro.example")
      .send(demoData)
      .expect(403);
    await outside
      .post("/api/tickets/" + ticketId + "/comments")
      .set("Origin", origin)
      .send({ body: "No autorizado" })
      .expect(404);
    await agent.get("/api/tickets/" + ticketId).expect(404);
    await customer.get("/api/tickets/" + ticketId).expect(200);
    await customer.get("/api/agents").expect(403);
    await customer
      .patch("/api/tickets/" + ticketId)
      .set("Origin", origin)
      .send({ status: "RESOLVED" })
      .expect(403);
    await admin
      .patch("/api/tickets/" + ticketId)
      .set("Origin", origin)
      .send({ assigneeId: agentId })
      .expect(200);
    await agent
      .patch("/api/tickets/" + ticketId)
      .set("Origin", origin)
      .send({ assigneeId: null })
      .expect(403);
    await agent
      .patch("/api/tickets/" + ticketId)
      .set("Origin", origin)
      .send({ status: "IN_PROGRESS" })
      .expect(200);
    const list = await outside
      .get("/api/tickets")
      .query({ q: marker })
      .expect(200);
    expect(list.body.total).toBe(0);
    const inside = await agent
      .get("/api/tickets")
      .query({
        q: marker,
        status: "IN_PROGRESS",
        category: "TECHNICAL",
        priority: "HIGH",
      })
      .expect(200);
    expect(inside.body.total).toBe(1);
    const stats = await outside.get("/api/dashboard").expect(200);
    expect(stats.body.total).toBe(0);
  });
  it("muestra comentarios públicos y reserva notas internas a soporte", async () => {
    await admin
      .patch("/api/tickets/" + ticketId)
      .set("Origin", origin)
      .send({ assigneeId: agentId })
      .expect(200);
    await agent
      .post("/api/tickets/" + ticketId + "/comments")
      .set("Origin", origin)
      .send({ body: "Nota privada ficticia", internal: true })
      .expect(201);
    await customer
      .post("/api/tickets/" + ticketId + "/comments")
      .set("Origin", origin)
      .send({ body: "Respuesta pública" })
      .expect(201);
    await customer
      .post("/api/tickets/" + ticketId + "/comments")
      .set("Origin", origin)
      .send({ body: "Nota", internal: true })
      .expect(403);
    const clientView = await customer
      .get("/api/tickets/" + ticketId)
      .expect(200);
    expect(clientView.text).not.toContain("Nota privada ficticia");
    expect(clientView.body.comments).toHaveLength(1);
    expect(
      clientView.body.events.some(
        (item: { field: string }) => item.field === "assigneeId",
      ),
    ).toBe(true);
    const staffView = await agent.get("/api/tickets/" + ticketId).expect(200);
    expect(staffView.body.comments).toHaveLength(2);
  });
  it("la demo bloquea autenticación y cambios", async () => {
    const demo = createApp(db, { origin, demo: true });
    await request(demo)
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({})
      .expect(403);
    await request(demo)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({})
      .expect(403);
    await request(demo)
      .post("/api/tickets")
      .set("Origin", origin)
      .send(demoData)
      .expect(403);
  });
});
