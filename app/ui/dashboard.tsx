"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Student = {
  id: string;
  name: string;
  email: string;
  document: string;
  registration_code?: string | null;
};

type ClassSession = {
  id: string;
  title: string;
  scheduled_at: string;
  notes: string;
  marked_count: number;
  present_count: number;
};

type AttendanceStudent = Student & { status: AttendanceStatus | null };
type AttendanceStatus = "pending" | "present" | "absent" | "late";
type StudentLink = { id: string; title: string; url: string; description: string };
type Section = "overview" | "students" | "classes" | "attendance" | "links";

async function fetchAttendanceRoster(classId: string) {
  return apiRequest<{ students: AttendanceStudent[]; availableStudents: Student[] }>(
    `/api/classes/${classId}/attendance`,
  );
}

const statusLabels: Record<AttendanceStatus, string> = {
  pending: "Pendiente",
  present: "Presente",
  absent: "Ausente",
  late: "Tarde",
};

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "No se pudo completar la solicitud.");
  }
  return result as T;
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(new Date(value));
}

function toLocalDateTimeInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function Dashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    apiRequest<{ authenticated: boolean; email: string | null }>("/api/auth/session")
      .then((result) => {
        setAuthenticated(result.authenticated);
        setAdminEmail(result.email || "");
      })
      .catch(() => setAuthenticated(false));
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ email: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      setAdminEmail(result.email);
      setAuthenticated(true);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    }
  }

  async function signOut() {
    await apiRequest("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
  }

  if (authenticated === null) {
    return <main className="loading-screen"><span className="spinner" /> Cargando sistema…</main>;
  }
  if (!authenticated) {
    return <LoginForm onSubmit={signIn} error={loginError} />;
  }
  return <AdminDashboard adminEmail={adminEmail} onSignOut={signOut} />;
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand${light ? " brand-light" : ""}`}>
      <div className="brand-mark">B</div>
      <div>
        <strong>BAILE INAC</strong>
        <span>GESTIÓN ACADÉMICA</span>
      </div>
    </div>
  );
}

function LoginForm({
  onSubmit,
  error,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
}) {
  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand light />
        <div className="story-copy">
          <span className="eyebrow">ORDEN PARA CADA CLASE</span>
          <h1>Que el ritmo<br />no se detenga.</h1>
          <p>Alumnos, clases y asistencia en un solo lugar. Entra para comenzar.</p>
        </div>
        <div className="story-footer">BAILE INAC <span>·</span> REGISTRO Y ASISTENCIA</div>
        <div className="story-orb story-orb-one" />
        <div className="story-orb story-orb-two" />
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={onSubmit}>
          <span className="eyebrow">PANEL DE ADMINISTRACIÓN</span>
          <h2>Bienvenido</h2>
          <p>Ingresa con la cuenta de administrador para gestionar tu escuela.</p>
          <label>
            Correo electrónico
            <input name="email" type="email" placeholder="admin@baileinac.com" autoComplete="username" required />
          </label>
          <label>
            Contraseña
            <input name="password" type="password" placeholder="Tu contraseña" autoComplete="current-password" required />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary button-wide" type="submit">Iniciar sesión <span aria-hidden="true">→</span></button>
          <span className="login-note">Acceso privado para el equipo administrador.</span>
          <Link className="student-admin-link" href="/alumnos">¿Eres alumno? Accede a tu portal o regístrate</Link>
        </form>
      </section>
    </main>
  );
}

function AdminDashboard({ adminEmail, onSignOut }: { adminEmail: string; onSignOut: () => void }) {
  const [section, setSection] = useState<Section>("overview");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [studentResult, classResult] = await Promise.all([
        apiRequest<{ students: Student[] }>("/api/students"),
        apiRequest<{ classes: ClassSession[] }>("/api/classes"),
      ]);
      setStudents(studentResult.students);
      setClasses(classResult.classes);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const upcomingClasses = useMemo(
    () => classes.filter((item) => new Date(item.scheduled_at).getTime() > Date.now()).slice(0, 4),
    [classes],
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <span className="nav-caption">MENÚ PRINCIPAL</span>
        <nav aria-label="Menú principal">
          <NavButton active={section === "overview"} icon="⌂" onClick={() => setSection("overview")}>Resumen</NavButton>
          <NavButton active={section === "students"} icon="◎" onClick={() => setSection("students")}>Alumnos <span className="nav-count">{students.length}</span></NavButton>
          <NavButton active={section === "classes"} icon="▦" onClick={() => setSection("classes")}>Clases</NavButton>
          <NavButton active={section === "attendance"} icon="✓" onClick={() => setSection("attendance")}>Asistencia</NavButton>
          <NavButton active={section === "links"} icon="↗" onClick={() => setSection("links")}>Enlaces</NavButton>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><span className="help-icon">?</span><div><strong>¿Todo listo?</strong><span>Tu gestión, más fácil.</span></div></div>
          <div className="profile">
            <div className="avatar">{adminEmail.charAt(0).toUpperCase() || "A"}</div>
            <div className="profile-copy"><strong>Administrador</strong><span>{adminEmail}</span></div>
            <button className="icon-button logout-button" onClick={onSignOut} title="Cerrar sesión" aria-label="Cerrar sesión">↗</button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">Baile Inac <span>/</span> <strong>{sectionLabel(section)}</strong></div>
          <div className="topbar-right"><span className="today-label">{new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><div className="avatar avatar-small">{adminEmail.charAt(0).toUpperCase() || "A"}</div></div>
        </header>
        <div className="content">
          {loadError && <div className="alert-error" role="alert">{loadError}<button onClick={() => void loadData()}>Reintentar</button></div>}
          {loading ? <div className="content-loading"><span className="spinner" /> Cargando tus datos…</div> : (
            <>
              {section === "overview" && <Overview students={students} classes={classes} upcoming={upcomingClasses} onNavigate={setSection} />}
              {section === "students" && <StudentsPage students={students} onCreated={loadData} />}
              {section === "classes" && <ClassesPage classes={classes} onCreated={loadData} onTakeAttendance={(id) => { setSection("attendance"); window.history.replaceState(null, "", `/?clase=${id}`); }} />}
              {section === "attendance" && <AttendancePage classes={classes} onSaved={loadData} />}
              {section === "links" && <LinksPage />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, icon, children, onClick }: { active: boolean; icon: string; children: React.ReactNode; onClick: () => void }) {
  return <button className={`nav-button${active ? " nav-active" : ""}`} onClick={onClick}><span className="nav-icon">{icon}</span><span>{children}</span></button>;
}

function sectionLabel(section: Section) {
  return { overview: "Resumen", students: "Alumnos", classes: "Clases", attendance: "Asistencia", links: "Enlaces para alumnos" }[section];
}

function LinksPage() {
  const [links, setLinks] = useState<StudentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ links: StudentLink[] }>("/api/student-links");
      setLinks(result.links);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los enlaces.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLinks(); }, [loadLinks]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const result = await apiRequest<{ link: StudentLink }>("/api/student-links", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          url: form.get("url"),
          description: form.get("description"),
        }),
      });
      setLinks((previous) => [result.link, ...previous]);
      formElement.reset();
      setSuccess("Enlace agregado. Ya está disponible para los alumnos.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo agregar el enlace.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(id: string) {
    setError("");
    setSuccess("");
    setRemovingId(id);
    try {
      await apiRequest(`/api/student-links/${id}`, { method: "DELETE" });
      setLinks((previous) => previous.filter((link) => link.id !== id));
      setSuccess("Enlace quitado del portal de alumnos.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo quitar el enlace.");
    } finally {
      setRemovingId("");
    }
  }

  return (
    <>
      <PageHeading eyebrow="RECURSOS COMPARTIDOS" title="Enlaces para alumnos" description="Agrega recursos y enlaces que aparecerán en el portal de todos los alumnos." />
      {error && <div className="alert-error" role="alert">{error}</div>}
      {success && <div className="form-success link-feedback" role="status">{success}</div>}
      <div className="two-column-layout">
        <section className="panel form-panel">
          <div className="panel-heading"><div><span className="eyebrow">NUEVO RECURSO</span><h2>Agregar enlace</h2></div><span className="form-heading-icon">↗</span></div>
          <form className="stack-form" onSubmit={submit}>
            <label>Descripción corta<input name="title" placeholder="Ej. Video de práctica" minLength={2} maxLength={120} required /></label>
            <label>URL<input name="url" type="url" placeholder="https://…" maxLength={2048} required /></label>
            <label>Descripción<textarea name="description" placeholder="¿Qué encontrarán los alumnos en este enlace?" maxLength={500} rows={3} /></label>
            <button className="button button-primary button-wide" disabled={saving}>{saving ? "Guardando…" : "Agregar enlace"} <span aria-hidden="true">→</span></button>
          </form>
        </section>
        <section className="panel table-panel">
          <div className="panel-heading"><div><span className="eyebrow">VISIBLE EN EL PORTAL</span><h2>Enlaces publicados <span className="heading-count">{links.length}</span></h2></div></div>
          {loading ? <div className="content-loading"><span className="spinner" /> Cargando enlaces…</div> : links.length === 0 ? (
            <EmptyState title="Todavía no hay enlaces" text="Agrega un recurso para que los alumnos puedan consultarlo desde su portal." />
          ) : (
            <div className="shared-links-list">{links.map((link) => (
              <article className="shared-link-row" key={link.id}>
                <div className="shared-link-copy"><strong>{link.title}</strong><p>{link.description || "Sin descripción"}</p><a href={link.url} target="_blank" rel="noopener noreferrer">{link.url}</a></div>
                <button className="button button-secondary button-compact" disabled={removingId !== ""} onClick={() => void removeLink(link.id)}>{removingId === link.id ? "Quitando…" : "Quitar"}</button>
              </article>
            ))}</div>
          )}
        </section>
      </div>
    </>
  );
}

function Overview({
  students,
  classes,
  upcoming,
  onNavigate,
}: {
  students: Student[];
  classes: ClassSession[];
  upcoming: ClassSession[];
  onNavigate: (section: Section) => void;
}) {
  return (
    <>
      <div className="page-heading heading-row">
        <div><span className="eyebrow">TU ESCUELA, AL DÍA</span><h1>Resumen general</h1><p>Organiza tus clases y acompaña el progreso de cada alumno.</p></div>
        <button className="button button-primary" onClick={() => onNavigate("classes")}><span aria-hidden="true">＋</span> Programar clase</button>
      </div>
      <div className="stats-grid">
        <StatCard label="Alumnos registrados" value={students.length} icon="◎" note="En tu escuela" tone="purple" />
        <StatCard label="Clases programadas" value={classes.length} icon="▦" note="Sesiones creadas" tone="orange" />
        <StatCard label="Próximas clases" value={upcoming.length} icon="◷" note="En agenda" tone="green" />
      </div>
      <section className="panel upcoming-panel">
        <div className="panel-heading"><div><span className="eyebrow">AGENDA</span><h2>Próximas clases</h2></div><button className="text-button" onClick={() => onNavigate("classes")}>Ver todas <span>→</span></button></div>
        {upcoming.length === 0 ? <EmptyState title="Aún no hay clases próximas" text="Programa una sesión para comenzar a organizar tu agenda." action="Programar una clase" onClick={() => onNavigate("classes")} /> : (
          <div className="upcoming-list">{upcoming.map((item, index) => <div className="upcoming-item" key={item.id}><div className={`date-tile tile-${index % 3}`}><strong>{new Intl.DateTimeFormat("es", { day: "2-digit" }).format(new Date(item.scheduled_at))}</strong><span>{new Intl.DateTimeFormat("es", { month: "short" }).format(new Date(item.scheduled_at)).replace(".", "")}</span></div><div className="upcoming-copy"><strong>{item.title}</strong><span>{formatDate(item.scheduled_at)}</span></div><span className="class-chip">Clase programada</span><button className="text-button attendance-link" onClick={() => onNavigate("attendance")}>Pasar lista <span>→</span></button></div>)}</div>
        )}
      </section>
      <div className="quick-actions"><button className="quick-action" onClick={() => onNavigate("students")}><span className="quick-icon quick-purple">＋</span><span><strong>Registrar alumno</strong><small>Agregar alguien a tu escuela</small></span><span className="quick-arrow">→</span></button><button className="quick-action" onClick={() => onNavigate("attendance")}><span className="quick-icon quick-green">✓</span><span><strong>Tomar asistencia</strong><small>Marcar asistencia de una clase</small></span><span className="quick-arrow">→</span></button></div>
    </>
  );
}

function StatCard({ label, value, icon, note, tone }: { label: string; value: number; icon: string; note: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon stat-${tone}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value.toString().padStart(2, "0")}</strong><span className="stat-note"><span className="status-dot" />{note}</span></div>;
}

function StudentsPage({ students, onCreated }: { students: Student[]; onCreated: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedStudentId, setCopiedStudentId] = useState("");

  async function copyRegistrationLink(student?: Student) {
    const inviteCode = student?.registration_code;
    const registrationUrl = new URL("/alumnos/registro", window.location.origin);
    if (inviteCode) registrationUrl.hash = new URLSearchParams({ codigo: inviteCode }).toString();
    await navigator.clipboard.writeText(registrationUrl.toString());
    setCopiedStudentId(student?.id || "general");
    window.setTimeout(() => setCopiedStudentId(""), 2500);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await apiRequest("/api/students", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), document: form.get("document") }),
      });
      formElement.reset();
      setSuccess("Alumno registrado correctamente.");
      await onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar el alumno.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading eyebrow="COMUNIDAD" title="Alumnos" description="Registra y consulta a las personas de tu escuela." />
      <div className="registration-link-card">
        <span className="registration-link-icon">↗</span>
        <div><strong>Comparte el enlace de inscripción</strong><span>Los alumnos podrán crear su cuenta y consultar sus clases y asistencia.</span></div>
        <Link href="/alumnos/registro" className="registration-link-open">Abrir</Link>
        <button className="button button-secondary button-compact" onClick={() => void copyRegistrationLink()}>{copiedStudentId === "general" ? "Copiado" : "Copiar enlace"}</button>
      </div>
      <div className="two-column-layout">
        <section className="panel form-panel"><div className="panel-heading"><div><span className="eyebrow">NUEVO REGISTRO</span><h2>Agregar alumno</h2></div><span className="form-heading-icon">＋</span></div>
          <form className="stack-form" onSubmit={submit}>
            <label>Nombre completo<input name="name" placeholder="Ej. Valentina García" minLength={2} maxLength={120} required /></label>
            <label>Correo electrónico<input name="email" type="email" placeholder="valentina@correo.com" maxLength={254} required /></label>
            <label>Documento de identidad<input name="document" placeholder="Ej. DNI, cédula o pasaporte" minLength={4} maxLength={32} required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}{success && <div className="form-success" role="status">{success}</div>}
            <button className="button button-primary button-wide" disabled={saving}>{saving ? "Guardando…" : "Registrar alumno"} <span aria-hidden="true">→</span></button>
          </form>
        </section>
        <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">DIRECTORIO</span><h2>Alumnos registrados <span className="heading-count">{students.length}</span></h2></div></div>
          {students.length === 0 ? <EmptyState title="Todavía no hay alumnos" text="Completa el formulario para crear tu primer registro." /> : (
            <div className="table-wrap"><table><thead><tr><th>ALUMNO</th><th>DOCUMENTO</th><th>CONTACTO</th><th>PORTAL</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><div className="student-cell"><span className="student-avatar">{student.name.trim().charAt(0).toUpperCase()}</span><strong>{student.name}</strong></div></td><td>{student.document}</td><td>{student.email}</td><td>{student.registration_code ? <button className="text-button invite-button" onClick={() => void copyRegistrationLink(student)}>{copiedStudentId === student.id ? "Invitación copiada" : "Copiar invitación"}</button> : <span className="account-active">Cuenta activa</span>}</td></tr>)}</tbody></table></div>
          )}
        </section>
      </div>
    </>
  );
}

function ClassesPage({ classes, onCreated, onTakeAttendance }: { classes: ClassSession[]; onCreated: () => Promise<void>; onTakeAttendance: (id: string) => void }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingClassId, setRemovingClassId] = useState("");
  const [editingClass, setEditingClass] = useState<ClassSession | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const localDate = form.get("scheduledAt");
    try {
      await apiRequest(editingClass ? `/api/classes/${editingClass.id}` : "/api/classes", {
        method: editingClass ? "PUT" : "POST",
        body: JSON.stringify({
          title: form.get("title"),
          scheduledAt: typeof localDate === "string" ? new Date(localDate).toISOString() : "",
          notes: form.get("notes") || "",
        }),
      });
      formElement.reset();
      setSuccess(editingClass ? "Clase actualizada correctamente." : "Clase programada correctamente.");
      setEditingClass(null);
      await onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la clase.");
    } finally {
      setSaving(false);
    }
  }

  async function removeClass(item: ClassSession) {
    const confirmed = window.confirm(
      `¿Quitar la clase "${item.title}"? También se eliminarán las inscripciones y la asistencia asociadas. Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setRemovingClassId(item.id);
    try {
      await apiRequest(`/api/classes/${item.id}`, { method: "DELETE" });
      if (editingClass?.id === item.id) setEditingClass(null);
      setSuccess("Clase quitada correctamente.");
      await onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo quitar la clase.");
    } finally {
      setRemovingClassId("");
    }
  }

  return (
    <>
      <PageHeading eyebrow="PLANIFICACIÓN" title="Clases" description="Programa sesiones con fecha y hora para tu escuela." />
      {error && <div className="alert-error" role="alert">{error}</div>}
      {success && <div className="form-success class-feedback" role="status">{success}</div>}
      <div className="two-column-layout">
        <section className="panel form-panel"><div className="panel-heading"><div><span className="eyebrow">{editingClass ? "EDITAR SESIÓN" : "NUEVA SESIÓN"}</span><h2>{editingClass ? "Editar clase" : "Programar una clase"}</h2></div><span className="form-heading-icon">▦</span></div>
          <form className="stack-form" key={editingClass?.id || "new-class"} onSubmit={submit}>
            <label>Nombre de la clase<input name="title" defaultValue={editingClass?.title || ""} placeholder="Ej. Salsa nivel inicial" minLength={2} maxLength={120} required /></label>
            <label>Fecha y hora<input name="scheduledAt" type="datetime-local" defaultValue={editingClass ? toLocalDateTimeInput(new Date(editingClass.scheduled_at)) : undefined} min={editingClass ? undefined : toLocalDateTimeInput(new Date(Date.now() + 60_000))} required /></label>
            <label>Notas <span className="optional-label">OPCIONAL</span><textarea name="notes" defaultValue={editingClass?.notes || ""} placeholder="Sala, nivel u otra información útil…" maxLength={500} rows={3} /></label>
            <button className="button button-primary button-wide" disabled={saving || removingClassId !== ""}>{saving ? "Guardando…" : editingClass ? "Guardar cambios" : "Guardar clase"} <span aria-hidden="true">→</span></button>
            {editingClass && <button type="button" className="button button-secondary button-wide" disabled={saving} onClick={() => { setEditingClass(null); setError(""); }}>Cancelar edición</button>}
          </form>
        </section>
        <section className="panel table-panel"><div className="panel-heading"><div><span className="eyebrow">CALENDARIO</span><h2>Todas las clases <span className="heading-count">{classes.length}</span></h2></div></div>
          {classes.length === 0 ? <EmptyState title="Tu agenda está vacía" text="Programa la primera clase para verla aquí." /> : (
            <div className="class-list">{classes.map((item) => {
              const upcoming = new Date(item.scheduled_at).getTime() > Date.now();
              return <article className="class-row" key={item.id}><div className="date-tile tile-1"><strong>{new Intl.DateTimeFormat("es", { day: "2-digit" }).format(new Date(item.scheduled_at))}</strong><span>{new Intl.DateTimeFormat("es", { month: "short" }).format(new Date(item.scheduled_at)).replace(".", "")}</span></div><div className="class-row-copy"><strong>{item.title}</strong><span>{formatDate(item.scheduled_at)}</span>{item.notes && <small>{item.notes}</small>}<span className={`class-state${upcoming ? "" : " state-past"}`}>{upcoming ? "Próxima" : "Finalizada"} · {item.present_count} presentes</span></div><div className="class-row-actions"><button className="button button-secondary button-compact" disabled={saving || removingClassId !== ""} onClick={() => { setEditingClass(item); setError(""); setSuccess(""); }}>Editar</button><button className="button button-secondary button-compact" disabled={saving || removingClassId !== ""} onClick={() => onTakeAttendance(item.id)}>Asistencia</button><button className="button button-danger button-compact" disabled={saving || removingClassId !== ""} onClick={() => void removeClass(item)}>{removingClassId === item.id ? "Quitando…" : "Quitar"}</button></div></article>;
            })}</div>
          )}
        </section>
      </div>
    </>
  );
}

function AttendancePage({ classes, onSaved }: { classes: ClassSession[]; onSaved: () => Promise<void> }) {
  const queryClass = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("clase") : null;
  const [selectedClass, setSelectedClass] = useState(queryClass || "");
  const [roster, setRoster] = useState<AttendanceStudent[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [studentToAdd, setStudentToAdd] = useState("");
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingRoster, setUpdatingRoster] = useState(false);

  useEffect(() => {
    if (!selectedClass) {
      setRoster([]);
      setAvailableStudents([]);
      return;
    }
    let cancelled = false;
    setLoadingRoster(true);
    setError("");
    fetchAttendanceRoster(selectedClass)
      .then((result) => {
        if (!cancelled) {
          setRoster(result.students.map((student) => ({ ...student, status: student.status || "pending" })));
          setAvailableStudents(result.availableStudents);
        }
      })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudo cargar la lista."); })
      .finally(() => { if (!cancelled) setLoadingRoster(false); });
    return () => { cancelled = true; };
  }, [selectedClass]);

  const totals = useMemo(() => roster.reduce((counts, student) => {
    counts[student.status || "pending"] += 1;
    return counts;
  }, { pending: 0, present: 0, absent: 0, late: 0 }), [roster]);

  function updateStatus(studentId: string, status: AttendanceStatus) {
    setRoster((previous) => previous.map((student) => student.id === studentId ? { ...student, status } : student));
  }

  async function refreshRoster(classId: string) {
    const result = await fetchAttendanceRoster(classId);
    setRoster(result.students.map((student) => ({ ...student, status: student.status || "pending" })));
    setAvailableStudents(result.availableStudents);
  }

  async function updateEnrollment(studentId: string, action: "add" | "remove") {
    setError("");
    setSuccess("");
    setUpdatingRoster(true);
    try {
      await apiRequest(`/api/classes/${selectedClass}/attendance`, {
        method: "PUT",
        body: JSON.stringify({ studentId, action }),
      });
      await refreshRoster(selectedClass);
      setStudentToAdd("");
      setSuccess(action === "add" ? "El alumno se agregó a la clase." : "El alumno se quitó de la clase.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar la lista de alumnos.");
    } finally {
      setUpdatingRoster(false);
    }
  }

  function removeStudent(student: AttendanceStudent) {
    const confirmed = window.confirm(
      `¿Quitar a ${student.name} de esta clase? También se eliminará su marca de asistencia de esta sesión.`,
    );
    if (confirmed) void updateEnrollment(student.id, "remove");
  }

  async function saveAttendance() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await apiRequest(`/api/classes/${selectedClass}/attendance`, {
        method: "POST",
        body: JSON.stringify({ records: roster.map(({ id, status }) => ({ studentId: id, status })) }),
      });
      setSuccess("La asistencia quedó guardada.");
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la asistencia.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading eyebrow="CONTROL DE CLASES" title="Asistencia" description="Marca presentes, ausentes y llegadas tarde por sesión." />
      <section className="panel attendance-panel">
        <div className="attendance-toolbar"><label className="class-picker">Selecciona una clase<select value={selectedClass} disabled={saving || updatingRoster} onChange={(event) => { setSelectedClass(event.target.value); setStudentToAdd(""); setError(""); setSuccess(""); }}><option value="">Elige una sesión…</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.title} · {formatDate(item.scheduled_at)}</option>)}</select></label>
          {selectedClass && <div className="attendance-totals"><span className="total-present">{totals.present} presentes</span><span>{totals.absent} ausentes</span><span>{totals.late} tarde</span></div>}
        </div>
        {selectedClass && !loadingRoster && (
          <div className="attendance-manage">
            <label className="class-picker">Agregar alumno
              <select value={studentToAdd} onChange={(event) => setStudentToAdd(event.target.value)}>
                <option value="">{availableStudents.length ? "Selecciona un alumno…" : "No hay otros alumnos disponibles"}</option>
                {availableStudents.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.document}</option>)}
              </select>
            </label>
            <button className="button button-secondary" disabled={saving || updatingRoster || !studentToAdd} onClick={() => void updateEnrollment(studentToAdd, "add")}>
              {updatingRoster ? "Actualizando…" : "Agregar a la clase"}
            </button>
          </div>
        )}
        {(error || success) && (
          <div className="attendance-feedback">
            {error && <div className="form-error" role="alert">{error}</div>}
            {success && <div className="form-success" role="status">{success}</div>}
          </div>
        )}
        {!selectedClass ? <EmptyState title="Selecciona una clase" text="Elige una sesión programada para abrir la lista de alumnos." /> : loadingRoster ? <div className="content-loading"><span className="spinner" /> Cargando lista…</div> : roster.length === 0 ? <EmptyState title="No hay alumnos inscritos en esta clase" text="Agrega alumnos con el selector para incluirlos en esta sesión." /> : (
          <>
            <div className="attendance-shortcuts"><span>{roster.length} alumnos en la lista</span><button className="text-button" disabled={updatingRoster} onClick={() => setRoster((previous) => previous.map((item) => ({ ...item, status: "present" })))}>Marcar a todos presentes</button></div>
            <div className="table-wrap"><table><thead><tr><th>ALUMNO</th><th>DOCUMENTO</th><th>ESTADO DE ASISTENCIA</th><th>ACCIONES</th></tr></thead><tbody>{roster.map((student) => <tr key={student.id}><td><div className="student-cell"><span className="student-avatar">{student.name.trim().charAt(0).toUpperCase()}</span><div className="student-name"><strong>{student.name}</strong><span>{student.email}</span></div></div></td><td>{student.document}</td><td><select aria-label={`Estado de asistencia de ${student.name}`} className={`status-select status-${student.status}`} value={student.status || "pending"} disabled={updatingRoster} onChange={(event) => updateStatus(student.id, event.target.value as AttendanceStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><button className="text-button attendance-remove" disabled={saving || updatingRoster} onClick={() => removeStudent(student)}>Quitar</button></td></tr>)}</tbody></table></div>
            <div className="attendance-footer"><button className="button button-primary" disabled={saving || updatingRoster || roster.length === 0} onClick={() => void saveAttendance()}>{saving ? "Guardando…" : "Guardar asistencia"} <span aria-hidden="true">→</span></button></div>
          </>
        )}
      </section>
    </>
  );
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

function EmptyState({ title, text, action, onClick }: { title: string; text: string; action?: string; onClick?: () => void }) {
  return <div className="empty-state"><span className="empty-icon">✳</span><strong>{title}</strong><p>{text}</p>{action && onClick && <button className="text-button" onClick={onClick}>{action} <span>→</span></button>}</div>;
}
