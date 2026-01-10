-- 성능 최적화를 위한 인덱스 추가 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 공지사항 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON cornell_notices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_category ON cornell_notices(category);
CREATE INDEX IF NOT EXISTS idx_notices_category_created_at ON cornell_notices(category, created_at DESC);

-- 경조사 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_life_events_created_at ON cornell_life_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_life_events_category ON cornell_life_events(category);
CREATE INDEX IF NOT EXISTS idx_life_events_category_created_at ON cornell_life_events(category, created_at DESC);

-- 게시판 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_board_created_at ON cornell_board(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_category ON cornell_board(category);
CREATE INDEX IF NOT EXISTS idx_board_category_created_at ON cornell_board(category, created_at DESC);

-- 소모임 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_circles_created_at ON cornell_circles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circles_category ON cornell_circles(category);
CREATE INDEX IF NOT EXISTS idx_circles_category_created_at ON cornell_circles(category, created_at DESC);

-- 댓글 테이블 인덱스 (댓글 개수 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_board_comments_post_id ON cornell_board_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_circles_comments_post_id ON cornell_circles_comments(post_id);

-- 참고: 위의 테이블 이름(cornell_*)은 예시입니다.
-- 실제로는 각 학교별로 테이블 이름이 다릅니다 (예: nyu_notices, columbia_notices 등)
-- 각 학교의 테이블에 대해 위 인덱스를 추가해야 합니다.

