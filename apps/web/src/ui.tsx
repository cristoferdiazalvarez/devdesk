import { Link } from "react-router-dom";
import { ArrowUpRight, Inbox } from "lucide-react";
import {
  categories,
  code,
  date,
  initials,
  message,
  priorities,
  statuses,
  type Person,
  type Ticket,
} from "./data";

export function Avatar({ person }: { person: Person }) {
  return (
    <span className="avatar" aria-hidden="true">
      {initials(person.name)}
    </span>
  );
}
export function Feedback({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
}) {
  if (loading)
    return (
      <p className="feedback" role="status">
        Cargando…
      </p>
    );
  if (!error) return null;
  return (
    <div className="feedback error" role="alert">
      {message(error)}{" "}
      {retry && (
        <button className="button" onClick={retry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
export function Select({
  label,
  name,
  values,
  empty,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  name: string;
  values: Record<string, string>;
  empty?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {empty !== undefined && <option value="">{empty}</option>}
        {Object.entries(values).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  if (!tickets.length)
    return (
      <div className="empty">
        <Inbox size={32} />
        <strong>No hay tickets</strong>
        <span>Los tickets que coincidan con la vista aparecerán aquí.</span>
      </div>
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Estado</th>
            <th>Prioridad</th>
            <th>Responsable</th>
            <th>Actualizado</th>
            <th>
              <span className="sr-only">Detalle</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>
                <Link className="ticket-link" to={"/tickets/" + ticket.id}>
                  {ticket.subject}
                </Link>
                <small>
                  {code(ticket.id)} <span>·</span> {categories[ticket.category]}
                </small>
              </td>
              <td data-label="Estado">
                <span className={"pill " + ticket.status.toLowerCase()}>
                  {statuses[ticket.status]}
                </span>
              </td>
              <td data-label="Prioridad">
                <span className={"priority " + ticket.priority.toLowerCase()}>
                  {priorities[ticket.priority]}
                </span>
              </td>
              <td data-label="Responsable">
                {ticket.assignee ? (
                  <span className="inline-flex items-center gap-2">
                    <Avatar person={ticket.assignee} />
                    {ticket.assignee.name}
                  </span>
                ) : (
                  <span className="muted">Sin asignar</span>
                )}
              </td>
              <td data-label="Actualizado">
                <time dateTime={ticket.updatedAt}>
                  {date(ticket.updatedAt)}
                </time>
              </td>
              <td className="row-arrow">
                <Link
                  to={"/tickets/" + ticket.id}
                  aria-label={"Abrir " + code(ticket.id)}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
