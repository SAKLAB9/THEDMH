-- 모든 테이블의 images 배열/컬럼에서 URL 변경
-- qgtwkhkmdsaypnsnrpbf.supabase.co -> waumfxamhuvhsblehsuf.supabase.co
-- 슬래시 중복 제거: // -> /

-- ============================================
-- 헬퍼 함수: 테이블 존재 여부 확인
-- ============================================

CREATE OR REPLACE FUNCTION table_exists(p_table_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND information_schema.tables.table_name = p_table_name
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 결과 저장용 임시 테이블 생성
-- ============================================

CREATE TEMP TABLE IF NOT EXISTS update_results (
    table_name TEXT,
    updated_rows INTEGER,
    status TEXT
);

TRUNCATE TABLE update_results;

-- ============================================
-- 학교별 테이블 - images 배열 업데이트
-- ============================================

-- 1. 공지사항 테이블 (images 배열)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
    updated_count INTEGER;
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_notices';
        
        IF NOT table_exists(table_name) THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Table does not exist');
            CONTINUE;
        END IF;
        
        BEGIN
            EXECUTE format('
                UPDATE %I 
                SET images = (
                    SELECT array_agg(
                        regexp_replace(
                            regexp_replace(
                                img,
                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                ''g''
                            ),
                            ''\/+\'',
                            ''/'',
                            ''g''
                        )
                    )
                    FROM unnest(images) AS img
                )
                WHERE images IS NOT NULL 
                AND array_length(images, 1) > 0
                AND EXISTS (
                    SELECT 1 FROM unnest(images) AS img 
                    WHERE img LIKE ''%%qgtwkhkmdsaypnsnrpbf%%''
                );
            ', table_name);
            
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No images column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 2. 경조사 테이블 (images 배열)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
    updated_count INTEGER;
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_life_events';
        
        IF NOT table_exists(table_name) THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Table does not exist');
            CONTINUE;
        END IF;
        
        BEGIN
            EXECUTE format('
                UPDATE %I 
                SET images = (
                    SELECT array_agg(
                        regexp_replace(
                            regexp_replace(
                                img,
                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                ''g''
                            ),
                            ''\/+\'',
                            ''/'',
                            ''g''
                        )
                    )
                    FROM unnest(images) AS img
                )
                WHERE images IS NOT NULL 
                AND array_length(images, 1) > 0
                AND EXISTS (
                    SELECT 1 FROM unnest(images) AS img 
                    WHERE img LIKE ''%%qgtwkhkmdsaypnsnrpbf%%''
                );
            ', table_name);
            
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No images column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 3. 게시판 테이블 (images 배열)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
    updated_count INTEGER;
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_board_posts';
        
        IF NOT table_exists(table_name) THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Table does not exist');
            CONTINUE;
        END IF;
        
        BEGIN
            EXECUTE format('
                UPDATE %I 
                SET images = (
                    SELECT array_agg(
                        regexp_replace(
                            regexp_replace(
                                img,
                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                ''g''
                            ),
                            ''\/+\'',
                            ''/'',
                            ''g''
                        )
                    )
                    FROM unnest(images) AS img
                )
                WHERE images IS NOT NULL 
                AND array_length(images, 1) > 0
                AND EXISTS (
                    SELECT 1 FROM unnest(images) AS img 
                    WHERE img LIKE ''%%qgtwkhkmdsaypnsnrpbf%%''
                );
            ', table_name);
            
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No images column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 4. 소모임 테이블 (images 배열)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
    updated_count INTEGER;
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_circles';
        
        IF NOT table_exists(table_name) THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Table does not exist');
            CONTINUE;
        END IF;
        
        BEGIN
            EXECUTE format('
                UPDATE %I 
                SET images = (
                    SELECT array_agg(
                        regexp_replace(
                            regexp_replace(
                                img,
                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                ''g''
                            ),
                            ''\/+\'',
                            ''/'',
                            ''g''
                        )
                    )
                    FROM unnest(images) AS img
                )
                WHERE images IS NOT NULL 
                AND array_length(images, 1) > 0
                AND EXISTS (
                    SELECT 1 FROM unnest(images) AS img 
                    WHERE img LIKE ''%%qgtwkhkmdsaypnsnrpbf%%''
                );
            ', table_name);
            
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No images column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 5. 추첨 테이블 (images 배열)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
    updated_count INTEGER;
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_raffles';
        
        IF NOT table_exists(table_name) THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Table does not exist');
            CONTINUE;
        END IF;
        
        BEGIN
            EXECUTE format('
                UPDATE %I 
                SET images = (
                    SELECT array_agg(
                        regexp_replace(
                            regexp_replace(
                                img,
                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                ''g''
                            ),
                            ''\/+\'',
                            ''/'',
                            ''g''
                        )
                    )
                    FROM unnest(images) AS img
                )
                WHERE images IS NOT NULL 
                AND array_length(images, 1) > 0
                AND EXISTS (
                    SELECT 1 FROM unnest(images) AS img 
                    WHERE img LIKE ''%%qgtwkhkmdsaypnsnrpbf%%''
                );
            ', table_name);
            
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No images column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- ============================================
-- 결과 출력
-- ============================================

SELECT 
    table_name as "테이블명",
    updated_rows as "업데이트된 행 수",
    status as "상태"
FROM update_results
ORDER BY 
    CASE 
        WHEN status = 'Success' THEN 1
        WHEN status = 'No images column' THEN 2
        WHEN status = 'Table does not exist' THEN 3
        ELSE 4
    END,
    table_name;

-- 전체 요약
SELECT 
    COUNT(*) FILTER (WHERE status = 'Success') as "성공한 테이블 수",
    COUNT(*) FILTER (WHERE status = 'No images column') as "images 컬럼 없는 테이블 수",
    COUNT(*) FILTER (WHERE status = 'Table does not exist') as "존재하지 않는 테이블 수",
    COUNT(*) FILTER (WHERE status LIKE 'Error:%') as "에러 발생 테이블 수",
    SUM(updated_rows) FILTER (WHERE status = 'Success') as "총 업데이트된 행 수"
FROM update_results;

-- ============================================
-- 정리
-- ============================================

-- 헬퍼 함수 삭제
DROP FUNCTION IF EXISTS table_exists(TEXT);

-- 임시 테이블은 자동으로 삭제됨 (세션 종료 시)
