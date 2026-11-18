import express, { type Request, type RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { randomBytes } from "node:crypto";
import {
  Category,
  Priority,
  Status,
  Prisma,
  PrismaClient,
} from "./generated/client.js";
import { z, ZodError } from "zod";
import { digest, hashPassword, scope, verifyPassword } from "./security.js";

type Options = {
  origin: string;
  production?: boolean;
  allowRegistration?: boolean;
  proxyHops?: number;
  demo?: boolean;
};
const person = { id: true, name: true } as const;
const account = { ...person, email: true, role: true } as const;
const relations = {
  owner: { select: person },
  assignee: { select: person },
} as const;
const life = 8 * 60 * 60 * 1000;
const credentials = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();
const register = credentials.extend({
  name: z.string().trim().min(2).max(80),
  password: z.string().min(12).max(128),
});
const createTicket = z
  .object({
    subject: z.string().trim().min(5).max(140),
    description: z.string().trim().min(10).max(6000),
    priority: z.enum(Priority),
    category: z.enum(Category),
  })
  .strict();
const editTicket = z
  .object({
    priority: z.enum(Priority).optional(),
    category: z.enum(Category).optional(),
    status: z.enum(Status).optional(),
    assigneeId: z.uuid().nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
const filters = z
  .object({
    q: z.string().trim().max(140).optional(),
    status: z.enum(Status).optional(),
    priority: z.enum(Priority).optional(),
    category: z.enum(Category).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
const ticketId = (req: Request) =>
  z.coerce.number().int().positive().max(2147483647).parse(req.params.id);
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const missing = () => new HttpError(404, "Ticket no encontrado.");
const forbidden = () =>
  new HttpError(403, "No tienes permisos para esta acción.");

export function createApp(db: PrismaClient, options: Options) {
  const app = express();
  app.set("trust proxy", options.proxyHops ?? 0);
  app.set("query parser", "simple");
  app.disable("x-powered-by");
  const cookie = options.production ? "__Host-devdesk" : "devdesk";
  const cookieOptions = {
    httpOnly: true,
    secure: !!options.production,
    sameSite: "lax",
    path: "/",
  } as const;
  const limit = (max: number, windowMs: number) =>
    rateLimit({
      limit: max,
      windowMs,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Demasiadas solicitudes. Inténtalo más tarde." },
    });
  app.use(helmet());
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    cors({
      origin: options.origin,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
    }),
  );
  app.use("/api", (req, _res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.get("origin") !== options.origin || !req.is("application/json"))
    )
      return next(forbidden());
    next();
  });
  app.use(express.json({ limit: "24kb" }), cookieParser());
  app.get("/api/health", async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  app.use("/api", limit(240, 60_000));
  const authLimit = limit(12, 15 * 60_000);
  const visibleTickets = (user: {
    id: string;
    role: "ADMIN" | "AGENT" | "CUSTOMER";
  }): Prisma.TicketWhereInput => ({
    ...scope(user),
    ...(options.demo ? { demoData: true } : {}),
  });
  const sessionToken = (req: Request): string | undefined => {
    const value: unknown = req.cookies[cookie];
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
      ? value
      : undefined;
  };
  const authenticate: RequestHandler = async (req, res, next) => {
    if (options.demo) {
      const demo = await db.user.findUnique({
        where: { email: "agente@devdesk.example" },
        select: account,
      });
      if (demo?.role === "AGENT") {
        res.locals.user = demo;
        return next();
      }
      throw new HttpError(503, "La demo todavía no está disponible.");
    }
    const token = sessionToken(req);
    const session =
      token &&
      (await db.session.findUnique({
        where: { tokenHash: digest(token) },
        select: { expiresAt: true, user: { select: account } },
      }));
    if (!session || session.expiresAt <= new Date())
      throw new HttpError(401, "Inicia sesión para continuar.");
    res.locals.user = session.user;
    next();
  };
  const startSession = async (userId: string, req: Request) => {
    const token = randomBytes(32).toString("hex");
    const prior = sessionToken(req);
    await db.$transaction(async (tx) => {
      await tx.session.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      });
      if (prior)
        await tx.session.deleteMany({ where: { tokenHash: digest(prior) } });
      await tx.session.create({
        data: {
          tokenHash: digest(token),
          userId,
          expiresAt: new Date(Date.now() + life),
        },
      });
    });
    return token;
  };
  app.post("/api/auth/register", authLimit, async (req, res) => {
    if (options.demo || !options.allowRegistration) throw forbidden();
    const { email, name, password } = register.parse(req.body);
    const user = await db.user.create({
      data: { email, name, passwordHash: await hashPassword(password) },
      select: account,
    });
    res
      .cookie(cookie, await startSession(user.id, req), {
        ...cookieOptions,
        maxAge: life,
      })
      .status(201)
      .json(user);
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    if (options.demo) throw forbidden();
    const { email, password } = credentials.parse(req.body);
    const user = await db.user.findUnique({
      where: { email },
      select: { ...account, passwordHash: true },
    });
    if (!(await verifyPassword(password, user?.passwordHash)) || !user)
      throw new HttpError(401, "Correo o contraseña incorrectos.");
    const { id, name, role } = user;
    res
      .cookie(cookie, await startSession(id, req), {
        ...cookieOptions,
        maxAge: life,
      })
      .json({ id, name, role, email });
  });
  app.post("/api/auth/logout", async (req, res) => {
    if (options.demo) throw forbidden();
    const token = sessionToken(req);
    if (token)
      await db.session.deleteMany({ where: { tokenHash: digest(token) } });
    res.clearCookie(cookie, cookieOptions).status(204).end();
  });
  app.get("/api/auth/me", authenticate, (_req, res) =>
    res.json({
      ...res.locals.user,
      demo: !!options.demo,
      registration: !!options.allowRegistration,
    }),
  );
  app.get("/api/config", (_req, res) =>
    res.json({ registration: !!options.allowRegistration && !options.demo }),
  );
  app.use("/api", (req, _res, next) => {
    if (options.demo && !["GET", "HEAD", "OPTIONS"].includes(req.method))
      return next(forbidden());
    next();
  });
  app.use("/api", authenticate);
  app.get("/api/agents", async (_req, res) => {
    if (res.locals.user.role !== "ADMIN") throw forbidden();
    res.json(
      await db.user.findMany({
        where: { role: "AGENT" },
        select: person,
        orderBy: { name: "asc" },
      }),
    );
  });
  app.get("/api/dashboard", async (_req, res) => {
    const where = visibleTickets(res.locals.user);
    const [groups, urgent, recent] = await Promise.all([
      db.ticket.groupBy({ by: ["status"], where, _count: { _all: true } }),
      db.ticket.count({
        where: { ...where, priority: "URGENT", status: { not: "RESOLVED" } },
      }),
      db.ticket.findMany({
        where,
        include: relations,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 6,
      }),
    ]);
    const counts = Object.fromEntries(
      Object.values(Status).map((status) => [
        status,
        groups.find((group) => group.status === status)?._count._all ?? 0,
      ]),
    );
    res.json({
      counts,
      urgent,
      total: groups.reduce((sum, item) => sum + item._count._all, 0),
      recent,
    });
  });
  app.get("/api/tickets", async (req, res) => {
    const { q, status, priority, category, page } = filters.parse(req.query);
    const number = q?.match(/^(?:DD-)?(\d{1,10})$/i);
    const id = number ? Number(number[1]) : 0;
    const where: Prisma.TicketWhereInput = {
      ...visibleTickets(res.locals.user),
      status,
      priority,
      category,
      OR: q
        ? [
            { subject: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            ...(id > 0 && id <= 2147483647 ? [{ id }] : []),
          ]
        : undefined,
    };
    const [items, total] = await db.$transaction(
      [
        db.ticket.findMany({
          where,
          include: relations,
          skip: (page - 1) * 10,
          take: 10,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        }),
        db.ticket.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    res.json({ items, total, page, pageSize: 10 });
  });
  app.post("/api/tickets", limit(20, 60 * 60_000), async (req, res) => {
    const user = res.locals.user;
    const data = createTicket.parse(req.body);
    const ticket = await db.ticket.create({
      data: {
        ...data,
        ownerId: user.id,
        assigneeId: user.role === "AGENT" ? user.id : null,
        events: { create: { actorId: user.id, field: "CREATED" } },
      },
      include: relations,
    });
    res.status(201).json(ticket);
  });
  app.get("/api/tickets/:id", async (req, res) => {
    const user = res.locals.user;
    const ticket = await db.ticket.findFirst({
      where: { ...visibleTickets(user), id: ticketId(req) },
      include: {
        ...relations,
        comments: {
          where:
            options.demo || user.role === "CUSTOMER"
              ? { internal: false }
              : undefined,
          include: { author: { select: person } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        events: {
          include: { actor: { select: person } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        },
      },
    });
    if (!ticket) throw missing();
    res.json(ticket);
  });
  app.patch("/api/tickets/:id", async (req, res) => {
    const user = res.locals.user;
    if (user.role === "CUSTOMER") throw forbidden();
    const data = editTicket.parse(req.body);
    if (data.assigneeId !== undefined && user.role !== "ADMIN")
      throw forbidden();
    const where = { ...scope(user), id: ticketId(req) };
    const updated = await db.$transaction(
      async (tx) => {
        const current = await tx.ticket.findFirst({
          where,
          include: relations,
        });
        if (!current) throw missing();
        const assignee = data.assigneeId
          ? await tx.user.findFirst({
              where: { id: data.assigneeId, role: "AGENT" },
              select: person,
            })
          : null;
        if (data.assigneeId && !assignee)
          throw new HttpError(422, "El responsable debe ser un agente.");
        const events = Object.entries(data)
          .filter(
            ([field, value]) => current[field as keyof typeof data] !== value,
          )
          .map(([field, value]) => ({
            field,
            actorId: user.id,
            before:
              field === "assigneeId"
                ? (current.assignee?.name ?? null)
                : current[field as keyof typeof data],
            after: field === "assigneeId" ? (assignee?.name ?? null) : value,
          }));
        if (!events.length) return current;
        return tx.ticket.update({
          where,
          data: { ...data, events: { create: events } },
          include: relations,
        });
      },
      { isolationLevel: "Serializable" },
    );
    res.json(updated);
  });
  app.post(
    "/api/tickets/:id/comments",
    limit(50, 60 * 60_000),
    async (req, res) => {
      const user = res.locals.user;
      const { body, internal } = z
        .object({
          body: z.string().trim().min(1).max(4000),
          internal: z.boolean().default(false),
        })
        .strict()
        .parse(req.body);
      if (internal && user.role === "CUSTOMER") throw forbidden();
      const where = { ...scope(user), id: ticketId(req) };
      const comment = await db.$transaction(async (tx) => {
        if (internal) {
          await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${where.id} FOR UPDATE`;
          if (!(await tx.ticket.findFirst({ where, select: { id: true } })))
            throw missing();
        } else {
          const result = await tx.ticket.updateMany({
            where,
            data: { updatedAt: new Date() },
          });
          if (!result.count) throw missing();
        }
        return tx.comment.create({
          data: { ticketId: where.id, body, internal, authorId: user.id },
          include: { author: { select: person } },
        });
      });
      res.status(201).json(comment);
    },
  );
  app.use((_req, _res, next) =>
    next(new HttpError(404, "Ruta no encontrada.")),
  );
  const errors: express.ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof ZodError) {
      res.status(422).json({
        error: "Revisa los datos enviados.",
        fields: error.issues.map((issue) => issue.path.join(".")),
      });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002" || error.code === "P2034") {
        res.status(409).json({
          error:
            "No se pudo guardar por un conflicto. Revisa los datos e inténtalo de nuevo.",
        });
        return;
      }
      if (error.code === "P2025") {
        res.status(404).json({ error: "Recurso no encontrado." });
        return;
      }
    }
    if (error.status === 400 || error.status === 413) {
      res.status(error.status).json({ error: "Solicitud no válida." });
      return;
    }
    console.error(
      "Error de API",
      error instanceof Error ? error.name : "desconocido",
    );
    res.status(500).json({ error: "Ocurrió un error interno." });
  };
  app.use(errors);
  return app;
}
