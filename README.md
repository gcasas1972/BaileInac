# Baile Inac — registro y asistencia

Aplicación web para registrar alumnos, programar clases con fecha y hora y tomar asistencia por sesión. La interfaz y las rutas están en español; el acceso administrativo se configura mediante variables de entorno.

## Requisitos

- Node.js 20.9 o superior.
- Un proyecto de Vercel con una base Neon Postgres conectada desde **Vercel Marketplace**.
- El valor `DATABASE_URL` de la conexión de Neon.

## Desarrollo local

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env.local` y define:
   - `DATABASE_URL`: cadena de conexión de Neon.
   - `AUTH_SECRET`: valor aleatorio de al menos 32 caracteres.
   - `ADMIN_EMAIL` y `ADMIN_PASSWORD`: credenciales del administrador.

3. Inicializa las tablas:

   ```bash
   npm run db:init
   ```

4. Inicia la aplicación:

   ```bash
   npm run dev
   ```

La aplicación estará disponible en `http://localhost:3000`.

## Despliegue en Vercel

1. Importa este repositorio en Vercel.
2. En **Storage / Marketplace**, conecta una base de datos Neon Postgres al proyecto. La integración configura `DATABASE_URL`.
3. En **Settings → Environment Variables**, configura `AUTH_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` para los entornos que quieras habilitar.
4. Con `DATABASE_URL` disponible en el entorno local, ejecuta una vez `npm run db:init` para crear el esquema en Neon.
5. Despliega el proyecto. Vercel detecta Next.js automáticamente.

No subas los valores secretos al repositorio. Usa un `AUTH_SECRET` nuevo y una contraseña robusta para producción. La sesión administrativa se firma con JWT, dura ocho horas y se almacena en una cookie `HttpOnly`, `Secure` en producción y `SameSite=Strict`.

## Funcionalidad

- Registro de alumnos con nombre, correo y documento únicos.
- Programación de clases para fecha y hora específicas, con notas opcionales.
- Registro de asistencia por clase: pendiente, presente, ausente o tarde.
- Resumen de alumnos, clases y próximas sesiones.
- Acceso privado para un administrador configurado por variables de entorno.
