import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRight,
  Headset,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Sun,
  Ticket as TicketIcon,
} from "lucide-react";
import { api, ApiError, roles, type User } from "./data";
import { Avatar, Feedback } from "./ui";
import { Dashboard, NewTicket, TicketDetail, Tickets } from "./pages";
import "./styles.css";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 10_000 } },
});
function ThemeButton() {
  const [dark, setDark] = useState(
    () =>
      localStorage.getItem("devdesk-theme") === "dark" ||
      (!localStorage.getItem("devdesk-theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  function toggle() {
    localStorage.setItem("devdesk-theme", dark ? "light" : "dark");
    setDark(!dark);
  }
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={dark ? "Activar tema claro" : "Activar tema oscuro"}
      onClick={toggle}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span>
        <Headset size={21} />
      </span>
      <strong>DevDesk</strong>
    </div>
  );
}
function Auth() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const registration = pathname === "/registro";
  const config = useQuery({
    queryKey: ["config"],
    queryFn: ({ signal }) =>
      api<{ registration: boolean }>("/config", { signal }),
  });
  const signIn = useMutation({
    mutationFn: (fields: Record<string, FormDataEntryValue>) =>
      api<User>("/auth/" + (registration ? "register" : "login"), {
        method: "POST",
        body: JSON.stringify(fields),
      }),
    onSuccess: (user) => {
      cache.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
      cache.setQueryData(["me"], user);
      void navigate("/", { replace: true });
    },
  });
  if (registration && config.data && !config.data.registration)
    return <Navigate to="/login" replace />;
  return (
    <main className="auth-layout">
      <section className="auth-art">
        <Brand />
        <div>
          <span className="hero-kicker">
            <span /> Mesa de ayuda
          </span>
          <h1>El soporte técnico, en un solo lugar.</h1>
          <p>
            Gestiona solicitudes y mantén cada conversación junto a su ticket.
          </p>
        </div>
      </section>
      <section className="auth-side">
        <div className="auth-tools">
          <ThemeButton />
        </div>
        <form
          className="auth-form stack"
          onSubmit={(event) => {
            event.preventDefault();
            signIn.mutate(
              Object.fromEntries(new FormData(event.currentTarget)),
            );
          }}
        >
          <h2>{registration ? "Crear cuenta" : "Iniciar sesión"}</h2>
          {registration && (
            <label className="field">
              Nombre
              <input
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
              />
            </label>
          )}
          <label className="field">
            Correo electrónico
            <input
              name="email"
              type="email"
              autoComplete="username"
              maxLength={254}
              required
            />
          </label>
          <label className="field">
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete={registration ? "new-password" : "current-password"}
              minLength={registration ? 12 : undefined}
              maxLength={128}
              required
            />
            {registration && <small>Mínimo 12 caracteres.</small>}
          </label>
          <Feedback error={signIn.error} />
          <button className="button primary" disabled={signIn.isPending}>
            {registration ? "Crear cuenta" : "Entrar"} <ArrowRight size={17} />
          </button>
          {(config.data?.registration || registration) && (
            <Link className="back" to={registration ? "/login" : "/registro"}>
              {registration ? "Ya tengo una cuenta" : "Crear una cuenta"}
            </Link>
          )}
        </form>
      </section>
    </main>
  );
}
function DetailRoute({ user }: { user: User }) {
  const { id } = useParams();
  return <TicketDetail key={id} user={user} />;
}
function Shell({ user }: { user: User }) {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const main = document.getElementById("contenido");
    window.scrollTo(0, 0);
    main?.focus({ preventScroll: true });
  }, [location.pathname]);
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST", body: "{}" }),
    onSuccess: () => {
      cache.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
      cache.setQueryData(["me"], null);
      void navigate("/login", { replace: true });
    },
  });
  return (
    <div className="layout">
      <a className="skip" href="#contenido">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <Link to="/" aria-label="DevDesk, inicio">
          <Brand />
        </Link>
        <p className="nav-label">Espacio de trabajo</p>
        <nav aria-label="Navegación principal">
          <NavLink to="/" end>
            <LayoutDashboard size={18} /> Resumen
          </NavLink>
          <NavLink to="/tickets">
            <TicketIcon size={18} /> Tickets
          </NavLink>
        </nav>
        <div className="profile">
          <Avatar person={user} />
          <div>
            <strong>{user.name}</strong>
            <small>{roles[user.role]}</small>
          </div>
          {!user.demo && (
            <button
              className="icon-button"
              aria-label="Cerrar sesión"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            {location.pathname.startsWith("/tickets")
              ? "Soporte / Tickets"
              : "Soporte / Resumen"}
          </span>
          <div>
            {user.demo && (
              <span className="pill waiting">Demo de solo lectura</span>
            )}
            <ThemeButton />
            {!user.demo && !location.pathname.startsWith("/tickets") && (
              <Link to="/tickets/nuevo" className="button primary">
                <Plus size={17} /> Nuevo ticket
              </Link>
            )}
          </div>
        </header>
        <main id="contenido" className="main" tabIndex={-1}>
          <Feedback error={logout.error} />
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/tickets" element={<Tickets user={user} />} />
            <Route
              path="/tickets/nuevo"
              element={
                user.demo ? <Navigate to="/tickets" replace /> : <NewTicket />
              }
            />
            <Route path="/tickets/:id" element={<DetailRoute user={user} />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/registro" element={<Navigate to="/" replace />} />
            <Route
              path="*"
              element={
                <div className="card content-panel">
                  <h1>Página no encontrada</h1>
                  <Link className="back" to="/">
                    Volver al resumen
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}
function App() {
  const session = useQuery({
    queryKey: ["me"],
    queryFn: async ({ signal }) => {
      try {
        return await api<User>("/auth/me", { signal });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
  if (session.isPending || session.error)
    return (
      <main className="main">
        <Feedback
          loading={session.isPending}
          error={session.error}
          retry={() => void session.refetch()}
        />
      </main>
    );
  if (session.data) return <Shell user={session.data} />;
  return (
    <Routes>
      <Route path="/login" element={<Auth key="login" />} />
      <Route path="/registro" element={<Auth key="register" />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
);
