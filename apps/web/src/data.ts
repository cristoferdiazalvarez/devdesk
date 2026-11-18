export const statuses = {
  OPEN: "Abierto",
  IN_PROGRESS: "En curso",
  WAITING: "En espera",
  RESOLVED: "Resuelto",
} as const;
export const priorities = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
} as const;
export const categories = {
  ACCESS: "Acceso",
  TECHNICAL: "Incidencia técnica",
  BILLING: "Facturación",
  OTHER: "Otra",
} as const;
export const roles = {
  ADMIN: "Administrador",
  AGENT: "Agente",
  CUSTOMER: "Cliente",
} as const;
export type Person = { id: string; name: string };
export type User = Person & {
  email: string;
  role: keyof typeof roles;
  demo?: boolean;
};
export type Ticket = {
  id: number;
  subject: string;
  description: string;
  status: keyof typeof statuses;
  priority: keyof typeof priorities;
  category: keyof typeof categories;
  owner: Person;
  assignee: Person | null;
  createdAt: string;
  updatedAt: string;
};
export type Detail = Ticket & {
  comments: {
    id: string;
    body: string;
    internal: boolean;
    author: Person;
    createdAt: string;
  }[];
  events: {
    id: string;
    field: string;
    before: string | null;
    after: string | null;
    actor: Person;
    createdAt: string;
  }[];
};
export type TicketPage = {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
};
export type Metrics = {
  counts: Record<Ticket["status"], number>;
  urgent: number;
  total: number;
  recent: Ticket[];
};
export const code = (id: number) => "DD-" + String(id).padStart(4, "0");
const short = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const full = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
});
export const date = (value: string, extended = false) =>
  (extended ? full : short).format(new Date(value));
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      data?.error ?? "No se pudo conectar con DevDesk.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const message = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la solicitud.";
