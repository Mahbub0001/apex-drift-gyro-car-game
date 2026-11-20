# Database Schema Specification (DB_SCHEMA.md)
## Project Name: Apex Drift: Web & Gyro
**Target Database:** PostgreSQL 15+ (Hosted on Supabase)  
**ORM / Client:** `@supabase/supabase-js` v2  
**Security Model:** Row-Level Security (RLS) with Anonymous Session Support  

---

## 1. Schema Overview & ER Diagram

```
+------------------+          +-----------------------+          +--------------------+
|     profiles     | <------- |       user_cars       | -------> |        cars        |
+------------------+          +-----------------------+          +--------------------+
| id (UUID, PK)    |          | id (UUID, PK)         |          | id (TEXT, PK)      |
| username (TEXT)  |          | user_id (FK -> prof)  |          | name (TEXT)        |
| xp (BIGINT)      |          | car_id (FK -> cars)   |          | tier (INT)         |
| credits (BIGINT) |          | color_hex (TEXT)      |          | top_speed (FLOAT)  |
| is_guest (BOOL)  |          | tuning_stage (INT)    |          | acceleration(FLOAT)|
+------------------+          +-----------------------+          | handling (FLOAT)   |
        |                                                        +--------------------+
        |
        +-----------------------------------+
        |                                   |
        v                                   v
+-----------------------+          +--------------------+
|   multiplayer_rooms   |          |    leaderboards    |
+-----------------------+          +--------------------+
| id (UUID, PK)         |          | id (UUID, PK)      |
| room_code (VARCHAR 6) |          | user_id (FK)       |
| host_id (FK -> prof)  |          | track_id (TEXT)    |
| status (ENUM)         |          | lap_time_ms (INT)  |
| max_players (INT)     |          | control_type (ENUM)|
+-----------------------+          | created_at (TIMEST)|
        |                          +--------------------+
        v
+-----------------------+
|    room_players       |
+-----------------------+
| id (UUID, PK)         |
| room_id (FK -> rooms) |
| user_id (FK -> prof)  |
| car_id (FK -> cars)   |
| is_ready (BOOL)       |
| final_rank (INT)      |
+-----------------------+
```

---

## 2. Table Definitions & SQL DDL

### 2.1 Profiles Table (`profiles`)
Stores player credentials, guest sessions, progression levels, and earned racing credits.
```sql
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) NOT NULL DEFAULT 'Racer_' || SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6),
    avatar_url TEXT,
    xp BIGINT NOT NULL DEFAULT 0,
    credits BIGINT NOT NULL DEFAULT 5000,
    races_won INT NOT NULL DEFAULT 0,
    total_distance_km NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_guest BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_profiles_xp ON public.profiles(xp DESC);
```

### 2.2 Vehicle Catalog (`cars`)
Master catalog of available drivable vehicles with performance statistics.
```sql
CREATE TABLE public.cars (
    id TEXT PRIMARY KEY, -- e.g., 'supra_mk4', 'skyline_r34', 'gt3_rs', 'huracan'
    name VARCHAR(64) NOT NULL,
    brand VARCHAR(64) NOT NULL,
    model_path TEXT NOT NULL, -- GLB asset path
    tier INT NOT NULL DEFAULT 1,
    price_credits BIGINT NOT NULL DEFAULT 0,
    top_speed_kmh NUMERIC(5, 1) NOT NULL,
    acceleration_0_100 NUMERIC(4, 2) NOT NULL,
    handling_score NUMERIC(3, 1) NOT NULL,
    drift_factor NUMERIC(3, 1) NOT NULL,
    nitro_capacity_sec NUMERIC(4, 1) NOT NULL DEFAULT 5.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 2.3 User Vehicles & Customization (`user_cars`)
Tracks player-owned cars, custom paint jobs, and performance stage upgrades.
```sql
CREATE TABLE public.user_cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    car_id TEXT NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
    paint_color_hex VARCHAR(7) NOT NULL DEFAULT '#E11D48',
    paint_finish VARCHAR(16) NOT NULL DEFAULT 'metallic', -- 'gloss', 'metallic', 'matte', 'carbon'
    engine_stage INT NOT NULL DEFAULT 1,
    handling_stage INT NOT NULL DEFAULT 1,
    nitro_stage INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, car_id)
);
```

### 2.4 Multiplayer Rooms (`multiplayer_rooms`)
Handles game sessions, matchmaking room codes, and state progression.
```sql
CREATE TYPE room_status AS ENUM ('lobby', 'countdown', 'racing', 'finished');

CREATE TABLE public.multiplayer_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(6) UNIQUE NOT NULL,
    host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    track_id VARCHAR(32) NOT NULL DEFAULT 'autumn_pass',
    status room_status NOT NULL DEFAULT 'lobby',
    max_players INT NOT NULL DEFAULT 4,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now() + INTERVAL '2 hours')
);

CREATE INDEX idx_multiplayer_rooms_code ON public.multiplayer_rooms(room_code);
```

### 2.5 Room Participants (`room_players`)
Tracks players joined inside a specific multiplayer room.
```sql
CREATE TABLE public.room_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    car_id TEXT NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
    peer_id TEXT, -- WebRTC signaling ID
    is_ready BOOLEAN NOT NULL DEFAULT false,
    finish_time_ms INT,
    final_rank INT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(room_id, user_id)
);
```

### 2.6 Global & Track Leaderboards (`leaderboards`)
Precision lap timing records for Time Attack mode, tagged with input device type.
```sql
CREATE TYPE input_control_type AS ENUM ('gyro', 'keyboard', 'gamepad');

CREATE TABLE public.leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    track_id VARCHAR(32) NOT NULL,
    lap_time_ms INT NOT NULL,
    top_speed_kmh NUMERIC(5, 1) NOT NULL,
    control_type input_control_type NOT NULL DEFAULT 'gyro',
    ghost_data_url TEXT, -- Link to compressed trajectory for ghost playback
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_leaderboard_track_time ON public.leaderboards(track_id, lap_time_ms ASC);
```

---

## 3. Realtime Publication & Webhook Listeners

To enable instant lobby synchronization:
```sql
-- Enable Realtime for multiplayer lobby tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
```

---

## 4. Row-Level Security (RLS) Policies

All tables enforce strict PostgreSQL RLS policies to allow guest play while securing records:
```sql
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;

-- Public can read all profiles and cars
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public cars catalog viewable by everyone" ON public.cars FOR SELECT USING (true);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id OR is_guest = true);

-- Rooms policies
CREATE POLICY "Rooms viewable by code" ON public.multiplayer_rooms FOR SELECT USING (true);
CREATE POLICY "Authenticated or guest can create rooms" ON public.multiplayer_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Host can update room" ON public.multiplayer_rooms FOR UPDATE USING (host_id = auth.uid() OR true);

-- Leaderboards are publicly readable
CREATE POLICY "Leaderboard readable by all" ON public.leaderboards FOR SELECT USING (true);
CREATE POLICY "Anyone can submit lap records" ON public.leaderboards FOR INSERT WITH CHECK (true);
```
