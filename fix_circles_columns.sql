-- Circles 테이블에 누락된 컬럼 추가 SQL
-- 각 학교별 circles 테이블에 필요한 컬럼들을 추가합니다

-- 예시: nyu_circles 테이블에 컬럼 추가
-- 다른 학교 테이블도 동일하게 적용하세요 (usc_circles, columbia_circles 등)

-- 1. region 컬럼 추가 (지역)
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS region TEXT;

-- 2. location 컬럼 추가 (장소)
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS location TEXT;

-- 3. keywords 컬럼 추가 (키워드)
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS keywords TEXT;

-- 4. participants 컬럼 추가 (참가인원)
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS participants TEXT;

-- 5. fee 컬럼 추가 (참가비)
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS fee TEXT;

-- 6. contact 컬럼 추가 (연락처)
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS contact TEXT;

-- 7. event_date 컬럼 추가 (이벤트 날짜) - 이미 있을 수도 있음
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS event_date TIMESTAMP;

-- 8. account_number 컬럼 추가 (계좌번호) - 이미 있을 수도 있음
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS account_number TEXT;

-- 9. views 컬럼 추가 (조회수) - 이미 있을 수도 있음
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- 10. nickname 컬럼 추가 (닉네임) - 이미 있을 수도 있음
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS nickname TEXT;

-- 11. url 컬럼 추가 (URL) - 이미 있을 수도 있음
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS url TEXT;

-- 12. report_count 컬럼 추가 (신고 횟수) - 이미 있을 수도 있음
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0;

-- 13. is_closed 컬럼 추가 (마감 여부) - 이미 있을 수도 있음
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT false;

-- 14. closed_at 컬럼 추가 (마감 시간) - 이미 있을 수도 있음
ALTER TABLE nyu_circles ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;

-- 다른 학교 테이블에도 동일하게 적용:
-- ALTER TABLE usc_circles ADD COLUMN IF NOT EXISTS region TEXT;
-- ALTER TABLE usc_circles ADD COLUMN IF NOT EXISTS location TEXT;
-- ... (위와 동일)

-- 모든 학교 테이블에 한 번에 적용하려면:
-- DO $$
-- DECLARE
--     table_name TEXT;
-- BEGIN
--     FOR table_name IN 
--         SELECT tablename FROM pg_tables 
--         WHERE tablename LIKE '%_circles'
--     LOOP
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS region TEXT', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS location TEXT', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS keywords TEXT', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS participants TEXT', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS fee TEXT', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS contact TEXT', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS event_date TIMESTAMP', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS account_number TEXT', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS nickname TEXT', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS url TEXT', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT false', table_name);
--         EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP', table_name);
--     END LOOP;
-- END $$;

