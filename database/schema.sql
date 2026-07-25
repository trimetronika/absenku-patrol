-- PostgreSQL 16 + PostGIS 3.4 Schema for AI Digital Patrol Management System
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. COMPANIES (Tenants)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'COMPANY_ADMIN', 'SUPERVISOR', 'SECURITY_OFFICER')),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. BUILDINGS
CREATE TABLE IF NOT EXISTS buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. FLOORS
CREATE TABLE IF NOT EXISTS floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_name VARCHAR(100) NOT NULL,
    floor_level INT NOT NULL
);

-- 5. ROOMS
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    room_name VARCHAR(100) NOT NULL,
    room_number VARCHAR(50)
);

-- 6. PATROL POINTS (Spatial Geofencing enabled)
CREATE TABLE IF NOT EXISTS patrol_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location_gis GEOGRAPHY(POINT, 4326),
    geofence_radius_meters INT DEFAULT 15 CHECK (geofence_radius_meters >= 5 AND geofence_radius_meters <= 100),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Spatial index for sub-millisecond distance calculation
CREATE INDEX IF NOT EXISTS idx_patrol_points_gis ON patrol_points USING GIST (location_gis);

-- Automatic trigger to populate location_gis from latitude & longitude
CREATE OR REPLACE FUNCTION update_patrol_point_gis()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location_gis := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_patrol_point_gis ON patrol_points;
CREATE TRIGGER trg_update_patrol_point_gis
BEFORE INSERT OR UPDATE OF latitude, longitude ON patrol_points
FOR EACH ROW EXECUTE FUNCTION update_patrol_point_gis();

-- 7. REFERENCE IMAGES (Visual anchor photos for AI comparison)
CREATE TABLE IF NOT EXISTS reference_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patrol_point_id UUID NOT NULL REFERENCES patrol_points(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    embedding_vector JSONB, -- Stores 512-d CLIP vector array
    image_type VARCHAR(50) DEFAULT 'SCENE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. QR CODES (Dynamic HMAC Salts & Static Hashes)
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patrol_point_id UUID UNIQUE NOT NULL REFERENCES patrol_points(id) ON DELETE CASCADE,
    qr_code_hash VARCHAR(255) NOT NULL,
    secret_salt VARCHAR(128) NOT NULL,
    mode VARCHAR(20) DEFAULT 'DYNAMIC' CHECK (mode IN ('DYNAMIC', 'STATIC')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. SCHEDULES
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. PATROL LOGS (Execution audit record)
CREATE TABLE IF NOT EXISTS patrol_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES schedules(id),
    patrol_point_id UUID NOT NULL REFERENCES patrol_points(id),
    scanned_latitude DECIMAL(10, 8) NOT NULL,
    scanned_longitude DECIMAL(11, 8) NOT NULL,
    gps_distance_meters DECIMAL(8, 2) NOT NULL,
    ai_similarity_score DECIMAL(5, 2) NOT NULL,
    validation_status VARCHAR(20) NOT NULL CHECK (validation_status IN ('VALID', 'INVALID', 'FLAGGED_REVIEW')),
    failure_reason TEXT,
    is_anti_cheat_passed BOOLEAN DEFAULT TRUE,
    device_info JSONB,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patrol_logs_user_date ON patrol_logs(user_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_company ON patrol_logs(company_id, validation_status);

-- 11. AI VALIDATION LOGS (Deep evaluation breakdown)
CREATE TABLE IF NOT EXISTS ai_validation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patrol_log_id UUID UNIQUE NOT NULL REFERENCES patrol_logs(id) ON DELETE CASCADE,
    clip_score DECIMAL(5, 4),
    ssim_score DECIMAL(5, 4),
    orb_score DECIMAL(5, 4),
    yolo_score DECIMAL(5, 4),
    final_score DECIMAL(5, 4),
    execution_time_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    payload JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
