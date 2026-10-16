"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Student = { id: string; name: string; email: string };
type StudentClass = {
  id: string;
  title: string;
  scheduled_at: string;
  attendance_status: "present" | "absent" | "late" | null;
};
type PortalMode = "login" | "register";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo completar la solicitud.");
  return result as T;
}

function classDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function StudentPortal({ mode }: { mode: PortalMode }) {
  const [registrationCode, setRegistrationCode] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    request<{ authenticated: boolean; student: Student | null }>("/api/student-auth/session")
      .then((result) => setStudent(result.student))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No se pudo comprobar la sesión."))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    setRegistrationCode(
      new URLSearchParams(window.location.hash.slice(1)).get("codigo") || "",
    );
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const payload: Record<string, FormDataEntryValue | null> = {
      email: form.get("email"),
      password: form.get("password"),
    };
    if (mode === "register") {
      payload.name = form.get("name");
      payload.document = form.get("document");
      payload.registrationCode = registrationCode;
    }

    try {
      const result = await request<{ student: Student }>(
        mode === "register" ? "/api/student-auth/register" : "/api/student-auth/login",
        { method: "POST", body: JSON.stringify(payload) },
      );
      setStudent(result.student);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await request("/api/student-auth/logout", { method: "POST" });
    setStudent(null);
  }

  if (checkingSession) {
    return <main className="loading-screen"><span className="spinner" /> Cargando portal…</main>;
  }
  if (student) return <StudentHome student={student} onSignOut={signOut} />;

  const registration = mode === "register";
  return (
    <main className="student-auth-page">
      <section className="student-auth-story">
        <Link className="brand student-brand" href="/">
          <span className="brand-mark">B</span>
          <span className="brand-words"><strong>BAILE INAC</strong><small>PORTAL DEL ALUMNO</small></span>
        </Link>
        <div className="student-story-copy">
          <span className="eyebrow">BAILE INAC · TU ESPACIO</span>
          <h1>Tu próxima clase<br />está más cerca.</h1>
          <p>Consulta el calendario de clases y revisa tu asistencia desde cualquier lugar.</p>
        </div>
        <span className="student-story-footer">TU ESCUELA, A TU RITMO</span>
        <div className="story-orb story-orb-one" />
        <div className="story-orb story-orb-two" />
      </section>
      <section className="student-auth-panel">
        <form className="student-auth-card" onSubmit={submit}>
          <span className="eyebrow">{registration ? "NUEVO ALUMNO" : "ACCESO DE ALUMNOS"}</span>
          <h2>{registration ? "Crea tu cuenta" : "Hola de nuevo"}</h2>
          <p>{registration ? "Regístrate para consultar las clases y tu asistencia." : "Inicia sesión para ver tu agenda y asistencia."}</p>
          {registration && <>
            <label>Nombre completo<input name="name" autoComplete="name" minLength={2} maxLength={120} placeholder="Tu nombre y apellido" required /></label>
            <label>Documento de identidad<input name="document" autoComplete="off" minLength={4} maxLength={32} placeholder="DNI, cédula o pasaporte" required /></label>
            {registrationCode && <p className="invitation-note">Este enlace te permite activar tu cuenta de alumno.</p>}
          </>}
          <label>Correo electrónico<input name="email" type="email" autoComplete="email" maxLength={254} placeholder="tu@correo.com" required /></label>
          <label>Contraseña<input name="password" type="password" autoComplete={registration ? "new-password" : "current-password"} minLength={registration ? 10 : undefined} maxLength={128} placeholder={registration ? "Mínimo 10 caracteres" : "Tu contraseña"} required /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary button-wide" disabled={saving}>{saving ? "Un momento…" : registration ? "Crear cuenta" : "Iniciar sesión"} <span aria-hidden="true">→</span></button>
          <div className="student-auth-switch">
            {registration ? <>¿Ya tienes cuenta? <Link href="/alumnos">Inicia sesión</Link></> : <>¿Aún no estás registrado? <Link href="/alumnos/registro">Crea tu cuenta</Link></>}
          </div>
          <Link className="student-admin-link" href="/">Acceso de administración</Link>
        </form>
      </section>
    </main>
  );
}

function StudentHome({ student, onSignOut }: { student: Student; onSignOut: () => Promise<void> }) {
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    request<{ classes: StudentClass[] }>("/api/student/portal")
      .then((result) => setClasses(result.classes))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar tus clases."))
      .finally(() => setLoading(false));
  }, []);

  const attended = useMemo(
    () => classes.filter((item) => item.attendance_status === "present" || item.attendance_status === "late").length,
    [classes],
  );
  const markedClasses = useMemo(
    () => classes.filter((item) => item.attendance_status !== null).length,
    [classes],
  );
  const presentRate = markedClasses ? Math.round((attended / markedClasses) * 100) : 0;

  return (
    <main className="student-home">
      <header className="student-home-header">
        <Link className="brand" href="/alumnos"><span className="brand-mark">B</span><span className="brand-words"><strong>BAILE INAC</strong><small>PORTAL DEL ALUMNO</small></span></Link>
        <div className="student-profile"><span className="avatar">{student.name.charAt(0).toUpperCase()}</span><span><strong>{student.name}</strong><small>{student.email}</small></span><button className="student-logout" onClick={() => void onSignOut()}>Cerrar sesión</button></div>
      </header>
      <section className="student-home-content">
        <div className="student-welcome"><span className="eyebrow">TU ESPACIO PERSONAL</span><h1>¡Hola, {student.name.split(" ")[0]}!</h1><p>Aquí tienes tus clases y el registro de tu asistencia.</p></div>
        <div className="student-summary">
          <article className="student-summary-card"><span>Clases en agenda</span><strong>{classes.length.toString().padStart(2, "0")}</strong><small>Sesiones programadas</small></article>
          <article className="student-summary-card"><span>Asistencia registrada</span><strong>{presentRate}%</strong><small>{attended} de {markedClasses} clases presente o tarde</small></article>
        </div>
        <section className="student-classes-panel">
          <div className="student-classes-heading"><div><span className="eyebrow">AGENDA Y REGISTRO</span><h2>Mis clases</h2></div><span className="heading-count">{classes.length}</span></div>
          {error && <div className="student-portal-error" role="alert">{error}</div>}
          {loading ? <div className="content-loading"><span className="spinner" /> Cargando tus clases…</div> : classes.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">✳</span><strong>Aún no hay clases programadas</strong><p>Cuando se agreguen sesiones, aparecerán aquí.</p></div>
          ) : (
            <div className="student-classes-list">{classes.map((item) => {
              const upcoming = new Date(item.scheduled_at).getTime() >= Date.now();
              const status = item.attendance_status ?? (upcoming ? "upcoming" : "pending");
              const label = {
                present: "Presente",
                absent: "Ausente",
                late: "Llegó tarde",
                upcoming: "Próxima clase",
                pending: "Sin registrar",
              }[status];
              return <article className="student-class-item" key={item.id}>
                <div className="student-class-date"><strong>{new Intl.DateTimeFormat("es", { day: "2-digit" }).format(new Date(item.scheduled_at))}</strong><span>{new Intl.DateTimeFormat("es", { month: "short" }).format(new Date(item.scheduled_at)).replace(".", "")}</span></div>
                <div className="student-class-info"><strong>{item.title}</strong><span>{classDate(item.scheduled_at)}</span></div>
                <span className={`student-attendance-badge attendance-${status}`}>{label}</span>
              </article>;
            })}</div>
          )}
        </section>
      </section>
    </main>
  );
}
