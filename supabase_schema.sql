-- =============================================
-- CREATE TABLES (fresh install)
-- =============================================

-- =============================================
-- CREATE TABLES
-- =============================================

-- Table: farms (Peternakan)
CREATE TABLE farms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  owner TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: periods (Periode per farm)
CREATE TABLE periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  initial_population INTEGER NOT NULL,
  doc_weight REAL DEFAULT 40,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: daily_records (Catatan harian)
CREATE TABLE daily_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  record_date DATE,
  bw REAL,
  feed_sacks_added REAL DEFAULT 0,
  feed_sacks_remaining REAL DEFAULT 0,
  manual_daily_feed_intake REAL,
  manual_cum_feed_intake REAL,
  manual_daily_gain REAL,
  manual_fcr REAL,
  depletion INTEGER DEFAULT 0,
  current_population INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, day)
);

-- Table: standard_data (Data standar broiler)
CREATE TABLE standard_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day INTEGER NOT NULL UNIQUE,
  bw REAL,
  daily_gain REAL,
  avg_daily_gain REAL,
  feed_intake REAL,
  cum_feed_intake REAL,
  fcr REAL
);

-- =============================================
-- INSERT STANDARD DATA
-- =============================================
INSERT INTO standard_data (day, bw, daily_gain, avg_daily_gain, feed_intake, cum_feed_intake, fcr) VALUES
(0, 0, 0, NULL, 0, 0, 0),
(1, 43, 22, NULL, 14, 14, 0.326),
(2, 65, 25, NULL, 17, 31, 0.477),
(3, 90, 30, NULL, 20, 51, 0.567),
(4, 120, 30, NULL, 23, 74, 0.617),
(5, 150, 35, NULL, 26, 100, 0.667),
(6, 185, 35, NULL, 30, 130, 0.703),
(7, 220, 35, 30.29, 34, 164, 0.745),
(8, 255, 40, NULL, 38, 202, 0.792),
(9, 295, 40, NULL, 42, 244, 0.827),
(10, 335, 45, NULL, 47, 291, 0.869),
(11, 380, 50, NULL, 52, 343, 0.903),
(12, 430, 55, NULL, 57, 400, 0.930),
(13, 485, 65, NULL, 62, 462, 0.953),
(14, 550, 70, 52.14, 67, 529, 0.962),
(15, 620, 70, NULL, 73, 602, 0.971),
(16, 690, 80, NULL, 79, 681, 0.987),
(17, 770, 80, NULL, 85, 766, 0.995),
(18, 850, 85, NULL, 92, 858, 1.009),
(19, 935, 85, NULL, 99, 957, 1.024),
(20, 1020, 85, NULL, 106, 1063, 1.042),
(21, 1105, 90, 82.14, 113, 1176, 1.064),
(22, 1195, 90, NULL, 121, 1297, 1.085),
(23, 1285, 90, NULL, 129, 1426, 1.110),
(24, 1375, 90, NULL, 137, 1563, 1.137),
(25, 1465, 90, NULL, 145, 1708, 1.166),
(26, 1555, 100, NULL, 153, 1861, 1.197),
(27, 1655, 100, NULL, 162, 2023, 1.222),
(28, 1755, 100, 94.28, 171, 2194, 1.250),
(29, 1865, 100, NULL, 180, 2374, 1.273),
(30, 1965, 100, NULL, 189, 2563, 1.304),
(31, 2065, 100, NULL, 198, 2761, 1.337),
(32, 2175, 110, NULL, 208, 2969, 1.365),
(33, 2285, 110, NULL, 218, 3187, 1.395),
(34, 2395, 110, NULL, 228, 3415, 1.426),
(35, 2505, 110, 105.71, 238, 3653, 1.458);

-- =============================================
-- ENABLE RLS + PUBLIC ACCESS POLICIES
-- =============================================
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE standard_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on farms" ON farms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on periods" ON periods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on daily_records" ON daily_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on standard_data" ON standard_data FOR ALL USING (true) WITH CHECK (true);
