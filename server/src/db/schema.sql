CREATE TABLE IF NOT EXISTS riders (
  id SERIAL PRIMARY KEY,
  rider_reference VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  availability_status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
  total_capacity INTEGER NOT NULL,
  available_capacity INTEGER NOT NULL,
  current_workload INTEGER NOT NULL DEFAULT 0,
  current_zone VARCHAR(100) NOT NULL,
  supported_zones TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL,
  rider_id INTEGER UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_users_rider FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  order_reference VARCHAR(100) NOT NULL UNIQUE,
  pickup_zone VARCHAR(100) NOT NULL,
  delivery_zone VARCHAR(100) NOT NULL,
  load_capacity INTEGER NOT NULL,
  priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_deadline TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_status VARCHAR(64) NOT NULL DEFAULT 'NEW',
  assigned_rider_id INTEGER,
  duplicate_hash VARCHAR(64) UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_assigned_rider FOREIGN KEY (assigned_rider_id) REFERENCES riders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  rider_id INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmation_deadline TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_assignment_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_rider FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS job_history (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id VARCHAR(255),
  details JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT fk_job_history_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(current_status);
CREATE INDEX IF NOT EXISTS idx_jobs_zone ON jobs(pickup_zone, delivery_zone);
CREATE INDEX IF NOT EXISTS idx_assignments_job ON assignments(job_id, status);
CREATE INDEX IF NOT EXISTS idx_job_history_job ON job_history(job_id, event_timestamp);
