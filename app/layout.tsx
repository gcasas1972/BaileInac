import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baile Inac | Gestión de asistencia",
  description: "Registro de alumnos y control de asistencia a clases.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
