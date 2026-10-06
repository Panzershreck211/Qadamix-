-- GPS-трекинг: точки маршрута от приложения водителя

CREATE TABLE positions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cargo_id    BIGINT REFERENCES cargos(id) ON DELETE SET NULL, -- активный рейс на момент записи
  lat         DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon         DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN -180 AND 180),
  speed_kmh   REAL,
  heading     REAL,
  accuracy_m  REAL,
  recorded_at TIMESTAMPTZ NOT NULL,       -- время на телефоне (точки могут прийти пачкой после офлайна)
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX positions_cargo ON positions (cargo_id, recorded_at);
CREATE INDEX positions_driver ON positions (driver_id, recorded_at DESC);
-- Защита от дублей при повторной отправке пачки
CREATE UNIQUE INDEX positions_dedup ON positions (driver_id, recorded_at);

-- Последняя известная точка водителя — для подбора и карты без сканирования истории
ALTER TABLE drivers
  ADD COLUMN last_lat DOUBLE PRECISION,
  ADD COLUMN last_lon DOUBLE PRECISION,
  ADD COLUMN last_speed_kmh REAL,
  ADD COLUMN last_position_at TIMESTAMPTZ,
  ADD COLUMN gps_enabled BOOLEAN NOT NULL DEFAULT false;
