# Baile Inac — registro y asistencia

Aplicación web para registrar alumnos, programar clases con fecha y hora y tomar asistencia por sesión. Incluye un portal donde los alumnos se registran con su propia contraseña y consultan sus clases y asistencia personal. La interfaz y las rutas están en español; el acceso administrativo se configura mediante variables de entorno.

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
   - `DATABASE_URL`: cadena code conexión de Neon.
   - `AUTH_SECRET`: valor aleatorio de al menos 32 caracteres.
   - `ADMIN_EMAIL` y `ADMIN_PASSWORD`: credenciales del primer administrador.
   - `ADMIN_EMAIL_2` y `ADMIN_PASSWORD_2` (opcionales): credenciales de un segundo administrador. Para añadir más, continúa con `_3`, `_4`, etc.; configura siempre ambos valores para cada número consecutivo.

3. Inicializa las tablas:

   ```bash
   npm run db:init
   ```

4. Inicia la aplicación:

   ```bash
   npm run dev
   ```

La aplicación estará disponible en `http://localhonst:3000`.

## Despliegue en Vercel

1. Importa este repositorio en Vercel.
2. En **Storage / Marketplace**, conecta una base de datos Neon Postgres al proyecto. La integración configura `DATABASE_URL`.
3. En **Settings → Environment Variables**, configura `AUTH_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` para el primer administrador. Para añadir más administradores, agrega un par consecutivo como `ADMIN_EMAIL_2` y `ADMIN_PASSWORD_2`; no compartas ni subas las contraseñas al repositorio.
4. Con `DATABASE_URL` disponible en el entorno local, ejecuta `npm run db:init` para crear el esquema y aplicar las columnas del portal y la nueva tabla de enlaces a las instalaciones existentes.
5. Despliega el proyecto. Vercel detecta Next.js automáticamente.

No subas los valores secretos al repositorio. Usa un `AUTH_SECRET` nuevo y una contraseña robusta para producción. La sesión administrativa se firma con JWT, dura ocho horas y se almacena en una cookie `HttpOnly`, `Secure` en producción y `SameSite=Strict`.

## Funcionalidad

- Registro de alumnos con nombre, correo y documento únicos.
- Inscripción pública de alumnos en `/alumnos/registro` y acceso al portal en `/alumnos`.
- Portal privado del alumno para consultar el calendario y su propia asistencia.
- Sección administrativa para publicar y quitar enlaces con descripción, visibles en el portal de los alumnos.
- Los alumnos pueden cancelar su inscripción hasta una hora antes del inicio de la clase.
- Programación de clases para fecha y hora específicas, con notas opcionales.
- Los administradores pueden editar o quitar clases; al quitar una clase también se eliminan sus inscripciones y registros de asistencia.
- Registro de asistencia por clase: pendiente, presente, ausente o tarde; los administradores pueden agregar alumnos a una sesión y quitarlos junto con su marca de esa sesión.
- Resumen de alumnos, clases y próximas sesiones.
- Acceso privado para administradores configurados por variables de entorno.

Las contraseñas de los alumnos se almacenan con hash scrypt y salt individual. Los nuevos alumnos pueden crear una cuenta desde el enlace público. Para los alumnos que ya estaban cargados en el sistema, el administrador puede copiar una invitación personal desde el directorio; al registrarse con ese enlace y los mismos correo y documento, se activa su cuenta conservando su historial de asistencia. Las invitaciones son de un solo uso.
