import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Eye,
  EyeOff,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from "lucide-react";
import { api, ApiError } from "./lib/api";
import type { Anomaly, Tower, TowerStatus, User } from "./types";
import TowerMap from "./components/TowerMap";
import CameraViewer from "./components/CameraViewer";
import DroneInspection from "./components/DroneInspection";

const statusNames: Record<TowerStatus, string> = {
  operativo: "Operativo",
  atencion: "Requiere atención",
  desconectado: "Desconectado",
};
const severityNames = { critica: "Crítica", media: "Media", baja: "Baja" };
const anomalyStatusNames = {
  pendiente: "Pendiente",
  revisada: "Revisada",
  resuelta: "Resuelta",
};
const dateFormat = (date: string, time = true) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "America/Argentina/Salta",
  }).format(new Date(date));
function RigIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 28 14 4h4l4 24M8 28h16M12 14h8M11 21h10M14 4l6 10-9 7 11 7M18 4l-6 10 9 7-11 7M22 14h5v14M25 19h4M25 24h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <img src="/assets/horus-logo.png" alt="HORUS" />
      <span>OPERATIONS INTELLIGENCE</span>
    </div>
  );
}
function Status({ status }: { status: TowerStatus }) {
  return (
    <span className={`status status-${status}`}>
      <i />
      {statusNames[status]}
    </span>
  );
}
function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty">
      <Search size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
function Spinner() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      <span>Cargando HORUS…</span>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Cerrar ventana"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [demo, setDemo] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  async function refresh() {
    const [t, a] = await Promise.all([
      api<{ towers: Tower[] }>("/towers"),
      api<{ anomalies: Anomaly[] }>("/anomalies"),
    ]);
    setTowers(t.towers);
    setAnomalies(a.anomalies);
    setError("");
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ user: User }>("/auth/me").catch((e) => {
        if (e instanceof ApiError && e.status === 401) return { user: null };
        throw e;
      }),
      api<{ demo: boolean }>("/health"),
    ])
      .then(async ([auth, health]) => {
        if (active) {
          setDemo(health.demo);
          setUser(auth.user);
          if (auth.user) await refresh();
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setMobile(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!user) return;
    let running = false;
    const reload = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        await refresh();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setUser(null);
          setTowers([]);
          setAnomalies([]);
        } else {
          setError(
            "No pudimos actualizar los datos. Se muestra la última información disponible.",
          );
        }
      } finally {
        running = false;
      }
    };
    const timer = setInterval(reload, 30000);
    window.addEventListener("focus", reload);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", reload);
    };
  }, [user?.id]);
  async function login(email: string, password: string) {
    const { user: next } = await api<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await refresh();
    setUser(next);
    navigate("/");
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setTowers([]);
      setAnomalies([]);
      navigate("/login");
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  async function updateAnomaly(id: string, status: Anomaly["status"]) {
    const result = await api<{ anomaly: Anomaly }>(`/anomalies/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setAnomalies((old) => old.map((a) => (a.id === id ? result.anomaly : a)));
    setToast("Estado de la anomalía actualizado.");
  }
  if (loading) return <Spinner />;
  if (!user) return <Login onLogin={login} demo={demo} initialError={error} />;
  const pending = anomalies.filter((a) => a.status === "pendiente").length;
  const pageTitle = location.pathname.startsWith("/equipos/")
    ? "Detalle del equipo"
    : location.pathname === "/equipos"
      ? "Catálogo de equipos"
      : location.pathname === "/mapa"
        ? "Mapa de operaciones"
        : location.pathname === "/anomalias"
          ? "Centro de anomalías"
          : "Vista general";
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMobile(false)}
          aria-label="Cerrar navegación"
        />
      )}
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <Link to="/" aria-label="HORUS inicio">
          <Logo light />
        </Link>
        <div className="workspace-label">
          <span className="workspace-icon">
            <RigIcon size={19} />
          </span>
          <div>
            Operaciones petroleras<small>Centro de monitoreo</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">ESPACIO DE TRABAJO</p>
        <nav>
          <NavLink to="/" end>
            <LayoutDashboard size={19} />
            <span>Vista general</span>
          </NavLink>
          <NavLink to="/mapa">
            <MapPin size={19} />
            <span>Mapa de equipos</span>
          </NavLink>
          <NavLink to="/equipos">
            <RigIcon size={20} />
            <span>Equipos</span>
            <em>{towers.length.toString().padStart(2, "0")}</em>
          </NavLink>
          <NavLink to="/anomalias">
            <TriangleAlert size={19} />
            <span>Anomalías</span>
            {pending > 0 && <em className="nav-count">{pending}</em>}
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="system-card">
            <span className="system-dot" />
            <strong>
              {demo ? "Entorno de demostración" : "HORUS conectado"}
            </strong>
            <p>
              {demo
                ? "Explora tu operación con datos de ejemplo."
                : "Tu centro de operaciones, en un solo lugar."}
            </p>
            <span className="system-version">
              HORUS PLATFORM <b>v1.0</b>
            </span>
          </div>
          <button className="support-link" onClick={() => setHelp(true)}>
            <CircleHelp size={18} /> Ayuda y documentación{" "}
            <ArrowUpRight size={15} />
          </button>
          <div className="sidebar-profile">
            <span className="avatar">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "admin" ? "Administrador" : "Observador"}
              </small>
            </div>
            <button
              onClick={logout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(!mobile)}
              aria-label="Abrir menú"
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-right">
            <span className="region">
              <span className="flag-arg" /> Argentina <ChevronDown size={12} />
            </span>
            <Link
              className="notification-button"
              to="/anomalias"
              aria-label={`${pending} anomalías pendientes`}
            >
              <Bell size={19} />
              {pending > 0 && <i />}
            </Link>
            <span className="avatar avatar-small">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button
                onClick={() => refresh().catch((e) => setError(e.message))}
              >
                Reintentar
              </button>
            </div>
          )}
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard towers={towers} anomalies={anomalies} demo={demo} />
              }
            />
            <Route path="/mapa" element={<MapPage towers={towers} />} />
            <Route
              path="/equipos"
              element={
                <Catalog
                  towers={towers}
                  anomalies={anomalies}
                  canEdit={user.role === "admin"}
                  onCreate={async () => {
                    await refresh();
                    setToast("Equipo incorporado al catálogo.");
                  }}
                />
              }
            />
            <Route
              path="/equipos/:id"
              element={
                <TowerDetail
                  towers={towers}
                  anomalies={anomalies}
                  canEdit={user.role === "admin"}
                  updateAnomaly={updateAnomaly}
                  refresh={refresh}
                  notify={setToast}
                />
              }
            />
            <Route
              path="/anomalias"
              element={
                <AnomaliesPage
                  towers={towers}
                  anomalies={anomalies}
                  canEdit={user.role === "admin"}
                  updateAnomaly={updateAnomaly}
                />
              }
            />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route
              path="*"
              element={
                <div className="not-found">
                  <h1>Página no encontrada</h1>
                  <p>Esta dirección no pertenece a tu espacio de trabajo.</p>
                  <Link className="button button-primary" to="/">
                    Volver al inicio <ArrowRight size={17} />
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
        <footer className="footer">
          <span>
            © {new Date().getFullYear()} HORUS. Inteligencia para tu operación.
          </span>
          <span>
            <ShieldCheck size={13} /> Acceso seguro ·{" "}
            {demo ? "Datos de demostración" : "Sesión autenticada"}
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={19} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Cerrar notificación">
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <Modal title="Tu centro de operaciones" onClose={() => setHelp(false)}>
          <div className="help-content">
            <p>
              HORUS reúne torres de perforación <b>RIG</b>, intervención{" "}
              <b>WORKOVER</b> y extracción <b>PULLING</b>.
            </p>
            <p>
              Usa el mapa para ubicar cada torre, el catálogo para acceder a sus
              cámaras y parámetros, y Anomalías para revisar los hallazgos.
            </p>
            <h3>Conectar una cámara</h3>
            <p>
              Entra a un equipo → Cámaras → Configurar. Puedes agregar una
              imagen HTTPS o una transmisión HLS (.m3u8) accesible desde el
              navegador. Las cámaras RTSP necesitan una pasarela a HLS.
            </p>
            <h3>Datos de demostración</h3>
            <p>
              Los equipos de ejemplo, imágenes, parámetros y anomalías son
              simulados. Los equipos nuevos requieren conectar cámaras y una
              integración de telemetría antes de mostrar mediciones reales.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Login({
  onLogin,
  demo,
  initialError,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  demo: boolean;
  initialError: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-overlay" />
        <div className="login-visual-top">
          <span className="login-tag">
            <span /> OPERATIONS INTELLIGENCE
          </span>
          <span>RIG / PULLING / WORKOVER</span>
        </div>
        <div className="login-visual-copy">
          <span className="eyebrow">UNA VISIÓN. TODA TU OPERACIÓN.</span>
          <h1>
            La tranquilidad
            <br />
            de ver <em>más allá.</em>
          </h1>
          <p>
            Conecta con tus equipos. Anticípate a las anomalías.
            <br />
            Toma decisiones con una visión completa.
          </p>
          <div className="login-visual-bottom">
            <span>
              <MapPin size={16} /> Diseñado para el campo. Conectado contigo.
            </span>
            <span>01 — 03</span>
          </div>
        </div>
      </section>
      <section className="login-form-panel">
        <Logo />
        <div className="login-form-content">
          <span className="eyebrow">BIENVENIDO A HORUS</span>
          <h2>
            Tu operación,
            <br />
            siempre a la vista.
          </h2>
          <p>Ingresa a tu centro de monitoreo.</p>
          <form onSubmit={submit}>
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="nombre@empresa.com"
              required
            />
            <label htmlFor="password">Contraseña</label>
            <div className="password-field">
              <input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                required
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button button-primary login-submit"
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  Iniciar sesión <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          {demo && (
            <div className="demo-access">
              <span>
                <Radio size={15} /> ¿Quieres conocer la plataforma?
              </span>
              <button
                onClick={() => {
                  setEmail("admin@horus.local");
                  setPassword("HorusDemo2026!");
                  setError("");
                }}
              >
                Completar acceso de demostración <ArrowUpRight size={15} />
              </button>
              <small>Datos simulados. Sin acceso a instalaciones reales.</small>
            </div>
          )}
          <div className="login-security">
            <ShieldCheck size={15} /> Tu sesión está protegida y es privada.
          </div>
        </div>
        <div className="login-footer">
          © {new Date().getFullYear()} HORUS{" "}
          <span>Inteligencia que protege.</span>
        </div>
      </section>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}
function Dashboard({
  towers,
  anomalies,
  demo,
}: {
  towers: Tower[];
  anomalies: Anomaly[];
  demo: boolean;
}) {
  const [selected, setSelected] = useState<string>();
  const pending = anomalies.filter((a) => a.status === "pendiente");
  const operating = towers.filter((t) => t.status === "operativo").length;
  const cameras = towers
    .flatMap((t) => t.cameras)
    .filter((c) => c.status === "online").length;
  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <span className="eyebrow">TU CENTRO DE OPERACIONES</span>
          <h1>
            Una mirada a toda tu operación<span>.</span>
          </h1>
          <p>Lo que necesitas saber, justo cuando lo necesitas.</p>
        </div>
        <span className="today">
          <Clock3 size={15} />
          {new Intl.DateTimeFormat("es-AR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "America/Argentina/Salta",
          }).format(new Date())}
        </span>
      </div>
      <section className="hero-banner">
        <div className="hero-grid" />
        <div className="hero-text">
          <span className="hero-kicker">
            <span /> VISIBILIDAD SIN LÍMITES
          </span>
          <h2>
            En el campo.
            <br />
            Siempre <em>conectados.</em>
          </h2>
          <p>
            Cada torre, cada cámara, cada detalle.
            <br />
            Tu operación completa en un mismo lugar.
          </p>
          <Link to="/mapa" className="button button-yellow">
            Explorar el mapa <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="hero-photo">
          <img
            src="/assets/rig-1.jpg"
            alt="Ilustración de una torre de perforación petrolera en la Patagonia"
          />
        </div>
        <div className="hero-coordinate">
          <MapPin size={14} />
          <span>
            CUENCA NEUQUINA<small>38° 21′ S · 68° 47′ O</small>
          </span>
        </div>
        <span className="hero-mode">
          {demo ? "VISTA DE DEMOSTRACIÓN" : "CENTRO DE MONITOREO"}
        </span>
      </section>
      <section className="stats-grid" aria-label="Resumen de la operación">
        <Stat
          label="Equipos en la flota"
          value={towers.length}
          icon={<RigIcon />}
          detail="RIG · Pulling · Workover"
        />
        <Stat
          label="Equipos operativos"
          value={operating}
          icon={<Activity size={21} />}
          detail={`${towers.length ? Math.round((operating / towers.length) * 100) : 0}% de la flota`}
          positive
        />
        <Stat
          label={demo ? "Cámaras de ejemplo" : "Cámaras disponibles"}
          value={cameras}
          icon={<Camera size={21} />}
          detail={demo ? "Vistas de demostración" : "Fuentes configuradas"}
        />
        <Stat
          label="Anomalías pendientes"
          value={pending.length}
          icon={<TriangleAlert size={21} />}
          detail={`${pending.filter((a) => a.severity === "critica").length} con prioridad crítica`}
          warning
        />
      </section>
      <div className="dashboard-main-grid">
        <section className="panel map-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Tu operación en el mapa{" "}
                <span className="subtle-count">{towers.length}</span>
              </h2>
              <p>Ubicación de tus equipos en campo</p>
            </div>
            <Link to="/mapa" className="text-link">
              Expandir mapa <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="dashboard-map">
            <TowerMap
              towers={towers}
              selectedId={selected}
              onSelect={(t) => setSelected(t.id)}
              compact
            />
            <div className="map-location-chip">
              <MapPin size={14} /> Cuenca Neuquina, Argentina
            </div>
          </div>
          <div className="map-legend">
            <span>
              <i className="dot-green" />
              Operativo
            </span>
            <span>
              <i className="dot-yellow" />
              Atención
            </span>
            <span>
              <i className="dot-gray" />
              Desconectado
            </span>
            <small>
              {demo ? "Ubicaciones de ejemplo" : "Ubicaciones registradas"}
            </small>
          </div>
        </section>
        <section className="panel fleet-panel">
          <div className="panel-heading">
            <div>
              <h2>Estado de la flota</h2>
              <p>Un vistazo a tus equipos</p>
            </div>
            <span className="icon-box">
              <RigIcon size={19} />
            </span>
          </div>
          <div className="fleet-bars">
            {(["operativo", "atencion", "desconectado"] as TowerStatus[]).map(
              (s) => (
                <span
                  key={s}
                  className={`fleet-bar bar-${s}`}
                  style={{
                    flex: Math.max(
                      towers.filter((t) => t.status === s).length,
                      0.1,
                    ),
                  }}
                />
              ),
            )}
          </div>
          <div className="fleet-summary">
            {(["operativo", "atencion", "desconectado"] as TowerStatus[]).map(
              (s) => (
                <span key={s}>
                  <strong>
                    {towers
                      .filter((t) => t.status === s)
                      .length.toString()
                      .padStart(2, "0")}
                  </strong>
                  <small>
                    {s === "atencion"
                      ? "Con atención"
                      : s === "operativo"
                        ? "Operativos"
                        : "Sin conexión"}
                  </small>
                </span>
              ),
            )}
          </div>
          <div className="fleet-list">
            {towers.slice(0, 3).map((t) => (
              <Link to={`/equipos/${t.id}`} className="fleet-item" key={t.id}>
                <span className="fleet-icon">
                  <RigIcon size={24} />
                </span>
                <span>
                  <strong>{t.name}</strong>
                  <small>{t.location}</small>
                </span>
                <span className={`fleet-dot dot-${t.status}`} />
                <ChevronRight size={15} />
              </Link>
            ))}
          </div>
          <Link className="fleet-all" to="/equipos">
            Ver todos los equipos <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Últimas anomalías{" "}
              <span className="subtle-count">{pending.length} pendientes</span>
            </h2>
            <p>Detecta, revisa y actúa a tiempo</p>
          </div>
          <Link to="/anomalias" className="text-link">
            Ver todas <ArrowUpRight size={15} />
          </Link>
        </div>
        <AnomalyTable anomalies={anomalies.slice(0, 3)} towers={towers} />
      </section>
    </>
  );
}
function Stat({
  label,
  value,
  icon,
  detail,
  positive,
  warning,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  detail: string;
  positive?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={`stat-card ${warning ? "stat-warning" : ""}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-bottom">
        <strong>{value.toString().padStart(2, "0")}</strong>
        <span className={positive ? "positive" : warning ? "warning" : ""}>
          {positive ? (
            <ArrowUpRight size={13} />
          ) : warning ? (
            <span className="tiny-dot" />
          ) : null}
          {detail}
        </span>
      </div>
    </div>
  );
}

function MapPage({ towers }: { towers: Tower[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  const [type, setType] = useState("Todos");
  const filtered = towers.filter(
    (t) =>
      (type === "Todos" || t.type === type) &&
      `${t.name} ${t.location}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="VISIBILIDAD EN CAMPO"
        title="Mapa de operaciones"
        description="Cada equipo, en su lugar. Explora y accede a tu operación."
      />
      <div className="map-workspace panel">
        <aside className="map-directory">
          <div className="map-directory-header">
            <h2>
              Equipos en campo{" "}
              <span className="subtle-count">{filtered.length}</span>
            </h2>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar equipo o ubicación"
            />
            <select
              aria-label="Tipo de equipo en mapa"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option>Todos</option>
              <option>RIG</option>
              <option>PULLING</option>
              <option>WORKOVER</option>
            </select>
          </div>
          <div className="map-directory-list">
            {filtered.map((t) => (
              <button
                key={t.id}
                className={`map-equipment ${selected === t.id ? "selected" : ""}`}
                onClick={() => setSelected(t.id)}
              >
                <div>
                  <span className="type-label">{t.type}</span>
                  <Status status={t.status} />
                </div>
                <strong>
                  <RigIcon size={22} />
                  {t.name}
                </strong>
                <small>
                  <MapPin size={13} />
                  {t.location}
                </small>
                <span className="coordinates">
                  {t.lat.toFixed(4)}, {t.lng.toFixed(4)}
                </span>
              </button>
            ))}
            {!filtered.length && (
              <Empty
                title="Sin coincidencias"
                description="Prueba con otro nombre o tipo de equipo."
              />
            )}
          </div>
        </aside>
        <div className="map-full">
          <TowerMap
            towers={filtered}
            selectedId={selected}
            onSelect={(t) => setSelected(t.id)}
          />
          {selected && filtered.some((t) => t.id === selected) && (
            <Link
              className="button button-primary map-detail-button"
              to={`/equipos/${selected}`}
            >
              Ver {filtered.find((t) => t.id === selected)?.name}{" "}
              <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search-field">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Limpiar búsqueda">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function Catalog({
  towers,
  anomalies,
  canEdit,
  onCreate,
}: {
  towers: Tower[];
  anomalies: Anomaly[];
  canEdit: boolean;
  onCreate: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("Todos");
  const [status, setStatus] = useState("todos");
  const [create, setCreate] = useState(false);
  const filtered = towers.filter(
    (t) =>
      (type === "Todos" || t.type === type) &&
      (status === "todos" || t.status === status) &&
      `${t.name} ${t.location} ${t.operator}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="TU FLOTA, CONECTADA"
        title="Catálogo de equipos"
        description="Una visión completa de cada torre y su operación."
      >
        {canEdit && (
          <button
            className="button button-primary"
            onClick={() => setCreate(true)}
          >
            <Plus size={17} /> Agregar equipo
          </button>
        )}
      </PageHeading>
      <div className="catalog-toolbar">
        <div className="tabs">
          {["Todos", "RIG", "PULLING", "WORKOVER"].map((v) => (
            <button
              key={v}
              className={type === v ? "active" : ""}
              onClick={() => setType(v)}
            >
              {v === "Todos" ? "Todos los equipos" : v}
              {v === "Todos" && <span>{towers.length}</span>}
            </button>
          ))}
        </div>
        <div className="catalog-filters">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar equipo…"
          />
          <div className="select-wrap">
            <SlidersHorizontal size={15} />
            <select
              aria-label="Filtrar por estado"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="todos">Todos los estados</option>
              {Object.entries(statusNames).map(([key, name]) => (
                <option value={key} key={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <p className="results-label">
        {filtered.length} equipos <span>en tu espacio de trabajo</span>
      </p>
      <div className="equipment-grid">
        {filtered.map((t) => (
          <Link to={`/equipos/${t.id}`} className="equipment-card" key={t.id}>
            <div className="equipment-photo">
              <img
                src={t.image}
                alt={`Vista ilustrativa de torre ${t.type}`}
                loading="lazy"
              />
              <span className="photo-type">{t.type}</span>
              {
                <span className="photo-demo">
                  {t.demo ? "DEMO" : "ILUSTRACIÓN"}
                </span>
              }
              <span className="equipment-open">
                <ArrowUpRight size={19} />
              </span>
            </div>
            <div className="equipment-body">
              <div className="equipment-card-heading">
                <h2>{t.name}</h2>
                <Status status={t.status} />
              </div>
              <p>
                <MapPin size={14} />
                {t.location}
              </p>
              <div className="equipment-meta">
                <span>
                  OPERADOR<strong>{t.operator}</strong>
                </span>
                <span>
                  POZO<strong>{t.well}</strong>
                </span>
              </div>
              <div className="equipment-footer">
                <span>
                  <Camera size={15} />
                  {t.cameras.length} cámaras
                </span>
                <span
                  className={
                    anomalies.some(
                      (a) => a.towerId === t.id && a.status === "pendiente",
                    )
                      ? "warning"
                      : ""
                  }
                >
                  <TriangleAlert size={14} />
                  {
                    anomalies.filter(
                      (a) => a.towerId === t.id && a.status === "pendiente",
                    ).length
                  }{" "}
                  pendientes
                </span>
                <ArrowRight size={17} />
              </div>
            </div>
          </Link>
        ))}
      </div>
      {!filtered.length && (
        <Empty
          title="No encontramos equipos"
          description="Cambia los filtros o agrega tu primera torre al catálogo."
        />
      )}
      {create && (
        <CreateTower onClose={() => setCreate(false)} onCreated={onCreate} />
      )}
    </>
  );
}
function CreateTower({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/towers", {
        method: "POST",
        body: JSON.stringify({
          name: f.get("name"),
          type: f.get("type"),
          location: f.get("location"),
          operator: f.get("operator"),
          well: f.get("well"),
          lat: Number(f.get("lat")),
          lng: Number(f.get("lng")),
        }),
      });
      await onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Agregar equipo" onClose={onClose}>
      <form className="tower-form" onSubmit={submit}>
        <p>
          Registra una torre para ubicarla en el mapa y configurar sus cámaras.
        </p>
        <div className="form-grid">
          <label>
            Nombre del equipo
            <input name="name" placeholder="RIG-705" required maxLength={40} />
          </label>
          <label>
            Tipo de torre
            <select name="type">
              <option>RIG</option>
              <option>PULLING</option>
              <option>WORKOVER</option>
            </select>
          </label>
          <label>
            Yacimiento / ubicación
            <input
              name="location"
              placeholder="Loma Campana, Neuquén"
              required
              maxLength={100}
            />
          </label>
          <label>
            Operador
            <input
              name="operator"
              placeholder="Nombre de la empresa"
              required
              maxLength={100}
            />
          </label>
          <label>
            Pozo
            <input name="well" placeholder="LC-705" required maxLength={60} />
          </label>
          <label>
            Latitud
            <input
              name="lat"
              type="number"
              step="any"
              min="-90"
              max="90"
              placeholder="-38.352"
              required
            />
          </label>
          <label>
            Longitud
            <input
              name="lng"
              type="number"
              step="any"
              min="-180"
              max="180"
              placeholder="-68.787"
              required
            />
          </label>
        </div>
        <p className="form-note">
          <CircleHelp size={15} /> Las cámaras y mediciones estarán
          desconectadas hasta configurar sus fuentes.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Guardando…" : "Agregar equipo"}
            <Plus size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TowerDetail({
  towers,
  anomalies,
  canEdit,
  updateAnomaly,
  refresh,
  notify,
}: {
  towers: Tower[];
  anomalies: Anomaly[];
  canEdit: boolean;
  updateAnomaly: (id: string, status: Anomaly["status"]) => Promise<void>;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const { id } = useParams();
  const [tab, setTab] = useState("general");
  const [cameraConfig, setCameraConfig] = useState(false);
  const [activeAnomaly, setActiveAnomaly] = useState<string>();
  const tower = towers.find((t) => t.id === id);
  const related = anomalies.filter((a) => a.towerId === id);
  useEffect(() => setTab("general"), [id]);
  if (!tower)
    return (
      <Empty
        title="Equipo no encontrado"
        description="Vuelve al catálogo para seleccionar una torre disponible."
      />
    );
  return (
    <>
      <Link to="/equipos" className="back-link">
        <ArrowDownLeft size={15} /> Volver a equipos
      </Link>
      <div className="tower-heading">
        <div className="tower-title-icon">
          <RigIcon size={31} />
        </div>
        <div>
          <div className="tower-title-line">
            <h1>{tower.name}</h1>
            <Status status={tower.status} />
            <span className="type-label">{tower.type}</span>
          </div>
          <p>
            <MapPin size={14} />
            {tower.location}
            <span>·</span>
            {tower.operator}
            <span>·</span>Pozo {tower.well}
          </p>
        </div>
        {tower.demo && (
          <span className="demo-pill">
            <Radio size={13} /> Equipo de demostración
          </span>
        )}
      </div>
      <div className="detail-tabs tabs">
        {[
          ["general", "Vista general"],
          ["camaras", "Cámaras"],
          ["dron", "Inspección con dron"],
          ["parametros", "Parámetros"],
          ["anomalias", "Anomalías"],
        ].map(([v, label]) => (
          <button
            className={tab === v ? "active" : ""}
            key={v}
            onClick={() => setTab(v)}
          >
            {label}
            {v === "anomalias" && <span>{related.length}</span>}
          </button>
        ))}
      </div>
      {(tab === "general" || tab === "dron") && (
        <DroneInspection key={tower.id} tower={tower} canEdit={canEdit} onSaved={refresh} />
      )}
      {(tab === "general" || tab === "parametros") && (
        <section className="parameter-section">
          <div className="section-title">
            <div>
              <h2>Parámetros de operación</h2>
              <p>
                {tower.demo
                  ? "Mediciones de ejemplo · No corresponden a sensores reales"
                  : `Última actualización: ${dateFormat(tower.updatedAt)}`}
              </p>
            </div>
            <span>
              <Activity size={15} />{" "}
              {tower.demo ? "Telemetría demo" : "Telemetría"}
            </span>
          </div>
          {tower.parameters.length ? (
            <div className="parameter-grid">
              {tower.parameters.map((p) => (
                <div className="parameter-card" key={p.key}>
                  <div className="parameter-label">
                    {p.label}
                    <Gauge size={17} />
                  </div>
                  <strong>
                    {p.value.toLocaleString("es-AR")}
                    <small>{p.unit}</small>
                  </strong>
                  <div className="parameter-chart">
                    <svg
                      viewBox="0 0 220 35"
                      preserveAspectRatio="none"
                      aria-label={`Historial de ${p.label}`}
                      role="img"
                    >
                      <polyline
                        points={p.history
                          .map(
                            (v, i) =>
                              `${(i * 220) / Math.max(p.history.length - 1, 1)},${32 - ((v - p.min) / (p.max - p.min || 1)) * 28}`,
                          )
                          .join(" ")}
                        fill="none"
                        stroke={
                          p.value > p.max || p.value < p.min
                            ? "#d17842"
                            : "#809c7e"
                        }
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <p>
                    Rango de referencia{" "}
                    <span>
                      {p.min}–{p.max} {p.unit}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Telemetría sin conectar"
              description="Integra una fuente de mediciones para consultar parámetros de esta torre."
            />
          )}
        </section>
      )}
      {(tab === "general" || tab === "camaras") && (
        <section className="cameras-section">
          <div className="section-title">
            <div>
              <h2>
                Cámaras del equipo{" "}
                <span className="subtle-count">{tower.cameras.length}</span>
              </h2>
              <p>
                {tower.demo
                  ? "Imágenes ilustrativas para explorar la plataforma"
                  : "Fuentes de video del equipo"}
              </p>
            </div>
            {canEdit && (
              <button
                className="button button-secondary"
                onClick={() => setCameraConfig(true)}
              >
                <SlidersHorizontal size={15} /> Configurar
              </button>
            )}
          </div>
          <div className="cameras-grid">
            {tower.cameras.map((c) => (
              <CameraViewer camera={c} towerName={tower.name} key={c.id} />
            ))}
          </div>
        </section>
      )}
      {(tab === "general" || tab === "anomalias") && (
        <section className="panel detail-anomalies">
          <div className="panel-heading">
            <div>
              <h2>
                Anomalías detectadas{" "}
                <span className="subtle-count">{related.length}</span>
              </h2>
              <p>Hallazgos registrados en este equipo</p>
            </div>
            <TriangleAlert size={19} />
          </div>
          <AnomalyTable
            towers={towers}
            anomalies={related}
            onSelect={(a) => setActiveAnomaly(a.id)}
          />
        </section>
      )}
      {tab === "general" && (
        <section className="panel detail-location">
          <div className="panel-heading">
            <div>
              <h2>Ubicación del equipo</h2>
              <p>
                {tower.location} · {tower.lat.toFixed(5)},{" "}
                {tower.lng.toFixed(5)}
              </p>
            </div>
            <Link to="/mapa" className="text-link">
              Abrir mapa <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="detail-map">
            <TowerMap towers={[tower]} compact />
          </div>
        </section>
      )}
      {cameraConfig && (
        <CameraConfig
          tower={tower}
          onClose={() => setCameraConfig(false)}
          onSave={async () => {
            await refresh();
            notify("Configuración de cámara guardada.");
          }}
        />
      )}
      {activeAnomaly && anomalies.find((a) => a.id === activeAnomaly) && (
        <AnomalyModal
          anomaly={anomalies.find((a) => a.id === activeAnomaly)!}
          tower={tower}
          canEdit={canEdit}
          update={updateAnomaly}
          onClose={() => setActiveAnomaly(undefined)}
        />
      )}
    </>
  );
}
function CameraConfig({
  tower,
  onClose,
  onSave,
}: {
  tower: Tower;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [id, setId] = useState(tower.cameras[0]?.id || "");
  const camera = tower.cameras.find((c) => c.id === id)!;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(`/towers/${tower.id}/cameras/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: f.get("name"),
          kind: f.get("kind"),
          url: f.get("url"),
          status: f.get("status"),
        }),
      });
      await onSave();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Configurar cámara" onClose={onClose}>
      <form className="tower-form" onSubmit={submit}>
        <label>
          Cámara
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {tower.cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div key={id} className="camera-config-fields">
          <label>
            Nombre
            <input
              name="name"
              defaultValue={camera.name}
              required
              maxLength={80}
            />
          </label>
          <label>
            Tipo de fuente
            <select name="kind" defaultValue={camera.kind}>
              <option value="demo">Demostración</option>
              <option value="image">Imagen HTTPS</option>
              <option value="hls">Video HLS</option>
            </select>
          </label>
          <label>
            Dirección de la fuente
            <input
              name="url"
              defaultValue={camera.url}
              placeholder="https://camaras.empresa.com/stream.m3u8"
              maxLength={2048}
            />
          </label>
          <label>
            Disponibilidad
            <select name="status" defaultValue={camera.status}>
              <option value="online">Habilitada</option>
              <option value="offline">Deshabilitada</option>
            </select>
          </label>
        </div>
        <p className="form-note">
          Usa una fuente HTTPS accesible desde el navegador, con CORS habilitado
          para HLS. No incluyas contraseñas en la dirección. Para RTSP se
          necesita una pasarela a HLS.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar cámara"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AnomalyTable({
  anomalies,
  towers,
  onSelect,
}: {
  anomalies: Anomaly[];
  towers: Tower[];
  onSelect?: (a: Anomaly) => void;
}) {
  if (!anomalies.length)
    return (
      <Empty
        title="Sin anomalías para mostrar"
        description="Los hallazgos aparecerán aquí cuando se registren."
      />
    );
  return (
    <div className="table-scroll">
      <table className="anomaly-table">
        <thead>
          <tr>
            <th>HALLAZGO</th>
            <th>EQUIPO</th>
            <th>PRIORIDAD</th>
            <th>DETECTADA</th>
            <th>ESTADO</th>
            <th>
              <span className="sr-only">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {anomalies.map((a) => (
            <tr key={a.id}>
              <td>
                <div className="anomaly-title">
                  <img src={a.image} alt="Captura ilustrativa del hallazgo" />
                  <span>
                    <strong>{a.title}</strong>
                    <small>{a.camera}</small>
                  </span>
                </div>
              </td>
              <td>
                <Link to={`/equipos/${a.towerId}`} className="table-tower">
                  {towers.find((t) => t.id === a.towerId)?.name || a.towerId}
                </Link>
              </td>
              <td>
                <span className={`severity severity-${a.severity}`}>
                  <i />
                  {severityNames[a.severity]}
                </span>
              </td>
              <td className="table-date">{dateFormat(a.timestamp)}</td>
              <td>
                <span className={`anomaly-state state-${a.status}`}>
                  {anomalyStatusNames[a.status]}
                </span>
              </td>
              <td>
                {onSelect ? (
                  <button
                    className="icon-button"
                    aria-label={`Ver anomalía: ${a.title}`}
                    onClick={() => onSelect(a)}
                  >
                    <ArrowUpRight size={18} />
                  </button>
                ) : (
                  <Link
                    className="icon-button"
                    aria-label={`Ver anomalía: ${a.title}`}
                    to={`/anomalias?id=${a.id}`}
                  >
                    <ArrowUpRight size={18} />
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function AnomaliesPage({
  towers,
  anomalies,
  canEdit,
  updateAnomaly,
}: {
  towers: Tower[];
  anomalies: Anomaly[];
  canEdit: boolean;
  updateAnomaly: (id: string, status: Anomaly["status"]) => Promise<void>;
}) {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todas");
  const [severity, setSeverity] = useState("todas");
  const active = anomalies.find((a) => a.id === params.get("id"));
  const filtered = anomalies.filter(
    (a) =>
      (status === "todas" || a.status === status) &&
      (severity === "todas" || a.severity === severity) &&
      `${a.title} ${towers.find((t) => t.id === a.towerId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="DETECCIÓN Y SEGUIMIENTO"
        title="Centro de anomalías"
        description="Convierte cada hallazgo en una acción. Revisa y registra su resolución."
      />
      <div className="anomaly-summary">
        <div>
          <span className="anomaly-summary-icon warning">
            <TriangleAlert size={21} />
          </span>
          <span>
            <strong>
              {anomalies.filter((a) => a.status === "pendiente").length}
            </strong>
            Pendientes de revisión
          </span>
        </div>
        <div>
          <span className="anomaly-summary-icon">
            <Eye size={21} />
          </span>
          <span>
            <strong>
              {anomalies.filter((a) => a.status === "revisada").length}
            </strong>
            En seguimiento
          </span>
        </div>
        <div>
          <span className="anomaly-summary-icon positive">
            <CheckCheck size={21} />
          </span>
          <span>
            <strong>
              {anomalies.filter((a) => a.status === "resuelta").length}
            </strong>
            Resueltas
          </span>
        </div>
      </div>
      <div className="catalog-toolbar">
        <div className="tabs">
          {[
            ["todas", "Todas"],
            ["pendiente", "Pendientes"],
            ["revisada", "Revisadas"],
            ["resuelta", "Resueltas"],
          ].map(([value, label]) => (
            <button
              className={status === value ? "active" : ""}
              onClick={() => setStatus(value)}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="catalog-filters">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar anomalía o equipo…"
          />
          <select
            aria-label="Filtrar por prioridad"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="todas">Todas las prioridades</option>
            {Object.entries(severityNames).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="panel">
        <AnomalyTable
          anomalies={filtered}
          towers={towers}
          onSelect={(a) => setParams({ id: a.id })}
        />
      </div>
      {active && (
        <AnomalyModal
          anomaly={active}
          tower={towers.find((t) => t.id === active.towerId)}
          canEdit={canEdit}
          update={updateAnomaly}
          onClose={() => setParams({})}
        />
      )}
    </>
  );
}
function AnomalyModal({
  anomaly,
  tower,
  canEdit,
  update,
  onClose,
}: {
  anomaly: Anomaly;
  tower?: Tower;
  canEdit: boolean;
  update: (id: string, status: Anomaly["status"]) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(anomaly.status);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await update(anomaly.id, status);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Detalle de la anomalía" onClose={onClose} wide>
      <div className="anomaly-modal-image">
        <img src={anomaly.image} alt={`Imagen de ${anomaly.title}`} />
        <span>
          {tower?.demo || anomaly.image.startsWith("/assets/rig-")
            ? "IMAGEN ILUSTRATIVA · DEMOSTRACIÓN"
            : "EVIDENCIA DEL HALLAZGO"}
        </span>
      </div>
      <div className="anomaly-modal-content">
        <div className="anomaly-modal-title">
          <h2>{anomaly.title}</h2>
          <span className={`severity severity-${anomaly.severity}`}>
            <i />
            {severityNames[anomaly.severity]}
          </span>
        </div>
        <p>{anomaly.description}</p>
        <div className="anomaly-modal-meta">
          <span>
            <RigIcon size={17} />
            {tower?.name}
          </span>
          <span>
            <Camera size={16} />
            {anomaly.camera}
          </span>
          <span>
            <Clock3 size={16} />
            {dateFormat(anomaly.timestamp)}
          </span>
        </div>
        <div className="anomaly-review">
          <div>
            <h3>Seguimiento del hallazgo</h3>
            <p>
              Estado actual:{" "}
              <strong>{anomalyStatusNames[anomaly.status]}</strong>
            </p>
          </div>
          {canEdit ? (
            <div>
              <select
                aria-label="Estado de la anomalía"
                value={status}
                onChange={(e) => setStatus(e.target.value as Anomaly["status"])}
              >
                {Object.entries(anomalyStatusNames).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                className="button button-primary"
                disabled={busy || status === anomaly.status}
                onClick={save}
              >
                {busy ? "Guardando…" : "Guardar estado"}
                <Check size={16} />
              </button>
            </div>
          ) : (
            <span>Solo lectura</span>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
