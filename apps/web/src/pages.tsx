import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Inbox,
  ListChecks,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import {
  api,
  categories,
  code,
  date,
  priorities,
  statuses,
  type Detail,
  type Metrics,
  type Person,
  type Ticket,
  type TicketPage,
  type User,
} from "./data";
import { Avatar, Feedback, Select, TicketTable } from "./ui";

export function Dashboard({ user }: { user: User }) {
  const result = useQuery({
    queryKey: ["dashboard"],
    queryFn: ({ signal }) => api<Metrics>("/dashboard", { signal }),
  });
  const data = result.data;
  const cards = [
    {
      label: "Tickets totales",
      value: data?.total,
      icon: Inbox,
      color: "indigo",
    },
    {
      label: "En curso",
      value: data?.counts.IN_PROGRESS,
      icon: Activity,
      color: "blue",
    },
    {
      label: "En espera",
      value: data?.counts.WAITING,
      icon: Clock3,
      color: "amber",
    },
    {
      label: "Resueltos",
      value: data?.counts.RESOLVED,
      icon: CheckCircle2,
      color: "green",
    },
  ];
  const firstName = user.name.split(" ")[0];
  return (
    <>
      <div className="hero">
        <div>
          <div className="hero-kicker">
            <span /> Mesa de ayuda
          </div>
          <h1>Hola, {firstName}.</h1>
          <p>Consulta la actividad y el estado de tus tickets de soporte.</p>
        </div>
        <Link className="button hero-button" to="/tickets">
          Ver tickets <ArrowRight size={17} />
        </Link>
      </div>
      <Feedback
        loading={result.isPending}
        error={result.error}
        retry={() => void result.refetch()}
      />
      {data && (
        <>
          <section aria-label="Métricas de tickets" className="metrics">
            {cards.map(({ label, value, icon: Icon, color }) => (
              <article className="card metric" key={label}>
                <span className={"tile " + color}>
                  <Icon size={20} />
                </span>
                <p>{label}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
          <section className="card">
            <div className="panel-heading">
              <div>
                <h2>Actividad reciente</h2>
                <p>Últimos tickets actualizados</p>
              </div>
              <Link className="button" to="/tickets">
                Todos los tickets <ArrowRight size={16} />
              </Link>
            </div>
            {data.urgent > 0 && (
              <p className="notice">
                <TriangleAlert size={17} /> {data.urgent}{" "}
                {data.urgent === 1
                  ? "ticket urgente pendiente"
                  : "tickets urgentes pendientes"}
              </p>
            )}
            <TicketTable tickets={data.recent} />
          </section>
        </>
      )}
    </>
  );
}
export function Tickets({ user }: { user: User }) {
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  const list = useQuery({
    queryKey: ["tickets", search],
    queryFn: ({ signal }) => api<TicketPage>("/tickets?" + search, { signal }),
  });
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget))
      if (value) next.set(key, String(value));
    setParams(next);
  }
  function page(value: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(value));
    setParams(next);
  }
  const data = list.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Tickets</h1>
          <p>Busca y consulta las solicitudes de soporte.</p>
        </div>
        {!user.demo && (
          <Link className="button primary" to="/tickets/nuevo">
            <Plus size={18} /> Nuevo ticket
          </Link>
        )}
      </div>
      <section className="card">
        <form className="filters" onSubmit={filter} key={search}>
          <label className="field">
            Buscar
            <input
              name="q"
              maxLength={140}
              placeholder="Asunto o ID…"
              defaultValue={params.get("q") ?? ""}
            />
          </label>
          <Select
            label="Estado"
            name="status"
            values={statuses}
            empty="Todos"
            defaultValue={params.get("status") ?? ""}
          />
          <Select
            label="Prioridad"
            name="priority"
            values={priorities}
            empty="Todas"
            defaultValue={params.get("priority") ?? ""}
          />
          <Select
            label="Categoría"
            name="category"
            values={categories}
            empty="Todas"
            defaultValue={params.get("category") ?? ""}
          />
          <button className="button primary" type="submit">
            <Search size={16} /> Filtrar
          </button>
          {search && (
            <Link to="/tickets" className="button">
              Limpiar
            </Link>
          )}
        </form>
        <Feedback
          loading={list.isPending}
          error={list.error}
          retry={() => void list.refetch()}
        />
        {data && (
          <>
            <TicketTable tickets={data.items} />
            <nav aria-label="Paginación" className="pagination">
              <span>
                {data.total} {data.total === 1 ? "ticket" : "tickets"} · Página{" "}
                {data.page}
              </span>
              <div>
                <button
                  className="button"
                  disabled={data.page <= 1}
                  onClick={() => page(data.page - 1)}
                >
                  Anterior
                </button>
                <button
                  className="button"
                  disabled={data.page * data.pageSize >= data.total}
                  onClick={() => page(data.page + 1)}
                >
                  Siguiente
                </button>
              </div>
            </nav>
          </>
        )}
      </section>
    </>
  );
}
export function NewTicket() {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const create = useMutation({
    mutationFn: (data: Record<string, FormDataEntryValue>) =>
      api<Ticket>("/tickets", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (ticket) => {
      void cache.invalidateQueries({ queryKey: ["tickets"] });
      void cache.invalidateQueries({ queryKey: ["dashboard"] });
      void navigate("/tickets/" + ticket.id);
    },
  });
  return (
    <>
      <Link className="back" to="/tickets">
        <ArrowLeft size={16} /> Volver a tickets
      </Link>
      <div className="page-heading">
        <div>
          <h1>Nuevo ticket</h1>
          <p>Describe la incidencia para que el equipo pueda ayudarte.</p>
        </div>
      </div>
      <form
        className="card form-panel"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate(Object.fromEntries(new FormData(event.currentTarget)));
        }}
      >
        <label className="field">
          Asunto
          <input name="subject" required minLength={5} maxLength={140} />
        </label>
        <label className="field">
          Descripción
          <textarea
            name="description"
            rows={7}
            required
            minLength={10}
            maxLength={6000}
          />
        </label>
        <div className="field-grid">
          <Select
            label="Categoría"
            name="category"
            values={categories}
            defaultValue="TECHNICAL"
          />
          <Select
            label="Prioridad"
            name="priority"
            values={priorities}
            defaultValue="MEDIUM"
          />
        </div>
        <Feedback error={create.error} />
        <button
          className="button primary"
          type="submit"
          disabled={create.isPending}
        >
          {create.isPending ? "Guardando…" : "Crear ticket"}
        </button>
      </form>
    </>
  );
}
const eventLabels: Record<string, string> = {
  status: "Estado",
  priority: "Prioridad",
  category: "Categoría",
  assigneeId: "Responsable",
};
function eventValue(field: string, value: string | null) {
  const labels: Record<string, Record<string, string>> = {
    status: statuses,
    priority: priorities,
    category: categories,
  };
  return value ? (labels[field]?.[value] ?? value) : "Sin asignar";
}
export function TicketDetail({ user }: { user: User }) {
  const { id } = useParams();
  const cache = useQueryClient();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const staff = user.role !== "CUSTOMER";
  const admin = user.role === "ADMIN";
  const detail = useQuery({
    queryKey: ["ticket", id],
    queryFn: ({ signal }) => api<Detail>("/tickets/" + id, { signal }),
  });
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: ({ signal }) => api<Person[]>("/agents", { signal }),
    enabled: admin && !user.demo,
  });
  function refresh() {
    for (const key of [["ticket", id], ["tickets"], ["dashboard"]])
      void cache.invalidateQueries({ queryKey: key });
  }
  const comment = useMutation({
    mutationFn: () =>
      api("/tickets/" + id + "/comments", {
        method: "POST",
        body: JSON.stringify({ body, internal }),
      }),
    onSuccess: () => {
      setBody("");
      setInternal(false);
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: (data: Record<string, string | null>) =>
      api("/tickets/" + id, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: refresh,
  });
  const ticket = detail.data;
  return (
    <>
      <Link className="back" to="/tickets">
        <ArrowLeft size={16} /> Volver a tickets
      </Link>
      <Feedback
        loading={detail.isPending}
        error={detail.error}
        retry={() => void detail.refetch()}
      />
      {ticket && (
        <>
          <header className="page-heading">
            <div>
              <p>
                {code(ticket.id)} · {categories[ticket.category]}
              </p>
              <h1>{ticket.subject}</h1>
            </div>
            <span className={"pill " + ticket.status.toLowerCase()}>
              {statuses[ticket.status]}
            </span>
          </header>
          <div className="detail-grid">
            <div className="stack">
              <section className="card content-panel">
                <h2>Descripción</h2>
                <p className="body-text">{ticket.description}</p>
              </section>
              <section className="card content-panel">
                <h2>Conversación</h2>
                {!ticket.comments.length && (
                  <p className="muted">Todavía no hay comentarios.</p>
                )}
                {ticket.comments.map((item) => (
                  <article
                    className={"comment " + (item.internal ? "internal" : "")}
                    key={item.id}
                  >
                    <div className="comment-meta">
                      <Avatar person={item.author} />
                      <strong>{item.author.name}</strong>
                      <time dateTime={item.createdAt}>
                        {date(item.createdAt, true)}
                      </time>
                      {item.internal && (
                        <span className="pill waiting">Nota interna</span>
                      )}
                    </div>
                    <p className="body-text">{item.body}</p>
                  </article>
                ))}
                {!user.demo && (
                  <form
                    className="stack"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (body.trim()) comment.mutate();
                    }}
                  >
                    <label className="field">
                      Comentario
                      <textarea
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        rows={3}
                        required
                        maxLength={4000}
                      />
                    </label>
                    {staff && (
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={internal}
                          onChange={(event) =>
                            setInternal(event.target.checked)
                          }
                        />{" "}
                        Nota interna
                      </label>
                    )}
                    <Feedback error={comment.error} />
                    <button
                      className="button primary"
                      disabled={comment.isPending || !body.trim()}
                    >
                      Enviar comentario
                    </button>
                  </form>
                )}
              </section>
            </div>
            <aside className="stack">
              <section className="card content-panel">
                <h2>Datos del ticket</h2>
                <dl>
                  <dt>Solicitante</dt>
                  <dd>{ticket.owner.name}</dd>
                  <dt>Responsable</dt>
                  <dd>{ticket.assignee?.name ?? "Sin asignar"}</dd>
                  <dt>Prioridad</dt>
                  <dd>{priorities[ticket.priority]}</dd>
                  <dt>Creado</dt>
                  <dd>{date(ticket.createdAt, true)}</dd>
                  <dt>Actualizado</dt>
                  <dd>{date(ticket.updatedAt, true)}</dd>
                </dl>
                {staff && !user.demo && (
                  <form
                    className="stack"
                    key={ticket.updatedAt}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = Object.fromEntries(
                        Array.from(
                          new FormData(event.currentTarget),
                          ([key, value]) => [key, String(value) || null],
                        ),
                      );
                      update.mutate(data);
                    }}
                  >
                    <Select
                      label="Estado"
                      name="status"
                      values={statuses}
                      defaultValue={ticket.status}
                    />
                    <Select
                      label="Prioridad"
                      name="priority"
                      values={priorities}
                      defaultValue={ticket.priority}
                    />
                    <Select
                      label="Categoría"
                      name="category"
                      values={categories}
                      defaultValue={ticket.category}
                    />
                    <Feedback
                      loading={admin && agents.isPending}
                      error={agents.error}
                      retry={() => void agents.refetch()}
                    />
                    {admin && agents.data && (
                      <Select
                        label="Responsable"
                        name="assigneeId"
                        empty="Sin asignar"
                        defaultValue={ticket.assignee?.id ?? ""}
                        values={Object.fromEntries(
                          agents.data.map((agent) => [agent.id, agent.name]),
                        )}
                      />
                    )}
                    <Feedback error={update.error} />
                    <button className="button" disabled={update.isPending}>
                      Guardar cambios
                    </button>
                  </form>
                )}
              </section>
              <section className="card content-panel">
                <h2>
                  <ListChecks size={19} /> Historial
                </h2>
                <ol className="timeline">
                  {ticket.events.map((item) => (
                    <li key={item.id}>
                      <strong>
                        {item.field === "CREATED"
                          ? "Ticket creado"
                          : (eventLabels[item.field] ?? item.field)}
                      </strong>
                      {item.field !== "CREATED" && (
                        <span>
                          {eventValue(item.field, item.before)} →{" "}
                          {eventValue(item.field, item.after)}
                        </span>
                      )}
                      <small>
                        {item.actor.name} · {date(item.createdAt, true)}
                      </small>
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
