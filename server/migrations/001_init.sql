-- QADAMIX: начальная схема

CREATE TABLE users (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role        TEXT NOT NULL CHECK (role IN ('logist', 'driver', 'admin')),
  phone       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  company     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Профиль водителя и его машины (в MVP одна машина на водителя)
CREATE TABLE drivers (
  user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  city          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'busy', 'offline')),
  verify        TEXT NOT NULL DEFAULT 'none' CHECK (verify IN ('none', 'pending', 'verified', 'rejected')),
  rating        DOUBLE PRECISION NOT NULL DEFAULT 0,
  trips         INTEGER NOT NULL DEFAULT 0,
  vehicle_model TEXT,
  body          TEXT,
  capacity      DOUBLE PRECISION,
  volume        DOUBLE PRECISION,
  plate         TEXT,
  directions    TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX drivers_search ON drivers (status, city, body);

CREATE SEQUENCE cargo_code_seq START 1001;

CREATE TABLE cargos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE DEFAULT ('K-' || nextval('cargo_code_seq')),
  logist_id    BIGINT NOT NULL REFERENCES users(id),
  from_city    TEXT NOT NULL,
  to_city      TEXT NOT NULL,
  load_date    DATE NOT NULL,
  weight       DOUBLE PRECISION NOT NULL CHECK (weight > 0),
  volume       DOUBLE PRECISION,
  body         TEXT NOT NULL,
  kind         TEXT,
  price        INTEGER NOT NULL CHECK (price >= 0),
  notes        TEXT,
  distance_km  INTEGER,
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'assigned', 'loading', 'in_transit', 'delivered', 'cancelled')),
  driver_id    BIGINT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_at  TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);
CREATE INDEX cargos_logist ON cargos (logist_id, status);
CREATE INDEX cargos_market ON cargos (status, from_city);
CREATE INDEX cargos_driver ON cargos (driver_id, status);

CREATE TABLE offers (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cargo_id   BIGINT NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  driver_id  BIGINT NOT NULL REFERENCES users(id),
  price      INTEGER NOT NULL CHECK (price >= 0),
  comment    TEXT,
  source     TEXT NOT NULL DEFAULT 'driver' CHECK (source IN ('driver', 'invite')),
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cargo_id, driver_id)
);
CREATE INDEX offers_driver ON offers (driver_id, status);

CREATE TABLE trip_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cargo_id   BIGINT NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  author_id  BIGINT NOT NULL REFERENCES users(id),
  status     TEXT NOT NULL,
  city       TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_cargo ON trip_events (cargo_id, created_at);

CREATE TABLE reviews (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cargo_id   BIGINT NOT NULL UNIQUE REFERENCES cargos(id) ON DELETE CASCADE,
  logist_id  BIGINT NOT NULL REFERENCES users(id),
  driver_id  BIGINT NOT NULL REFERENCES users(id),
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_driver ON reviews (driver_id);

CREATE TABLE notifications (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notif_user ON notifications (user_id, read, created_at DESC);

CREATE TABLE otp_codes (
  phone      TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Диалоги с ассистентом хранятся целиком (append-only), включая блоки tool_use / tool_result.
CREATE TABLE chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  messages   JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
