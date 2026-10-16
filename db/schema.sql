CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  email text NOT NULL UNIQUE,
  document text NOT NULL UNIQUE,
  password_hash text,
  registration_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS registration_code text;
CREATE UNIQUE INDEX IF NOT EXISTS students_registration_code_idx
  ON students (registration_code)
  WHERE registration_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  scheduled_at timestamptz NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

CREATE INDEX IF NOT EXISTS classes_scheduled_at_idx ON classes (scheduled_at);
CREATE INDEX IF NOT EXISTS attendance_class_id_idx ON attendance (class_id);
