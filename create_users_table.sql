-- users 테이블 생성 SQL
-- Supabase Auth를 사용하므로 id는 UUID 타입 (Supabase Auth의 user.id와 연결)

-- 테이블이 이미 존재하는지 확인하고, 없으면 생성
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT, -- Supabase Auth를 사용하면 NULL 가능, 서버 로그인을 사용하면 필수
  university TEXT, -- 소문자 코드 (예: 'cornell', 'nyu', 'columbia', 'usc')
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_university ON users(university);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 정책 설정 (Supabase Auth 사용 시)
-- 참고: Supabase Auth를 사용하는 경우, auth.users 테이블과 연결되어야 함
-- 이 SQL은 public.users 테이블을 생성하며, 필요시 RLS 정책을 추가로 설정해야 함

-- RLS 활성화 (선택사항)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 데이터를 읽을 수 있도록 정책 생성 (선택사항)
-- CREATE POLICY "Users can view own data" ON users
--   FOR SELECT USING (auth.uid() = id);

-- 모든 사용자가 자신의 데이터를 업데이트할 수 있도록 정책 생성 (선택사항)
-- CREATE POLICY "Users can update own data" ON users
--   FOR UPDATE USING (auth.uid() = id);

