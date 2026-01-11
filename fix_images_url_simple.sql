-- 모든 테이블의 images 배열에서 URL 변경 (간단하고 확실한 버전)
-- qgtwkhkmdsaypnsnrpbf.supabase.co -> waumfxamhuvhsblehsuf.supabase.co

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
-- nyu_notices 테이블 (테스트용)
-- ============================================

DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE nyu_notices 
    SET images = (
        SELECT array_agg(
            regexp_replace(
                regexp_replace(
                    img,
                    'qgtwkhkmdsaypnsnrpbf\.supabase\.co',
                    'waumfxamhuvhsblehsuf.supabase.co',
                    'g'
                ),
                '\/+',
                '/',
                'g'
            )
        )
        FROM unnest(images) AS img
    )
    WHERE images IS NOT NULL 
    AND array_length(images, 1) > 0
    AND EXISTS (
        SELECT 1 FROM unnest(images) AS img 
        WHERE img LIKE '%qgtwkhkmdsaypnsnrpbf%'
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    INSERT INTO update_results VALUES ('nyu_notices', updated_count, 'Success');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO update_results VALUES ('nyu_notices', 0, 'Error: ' || SQLERRM);
END $$;

-- ============================================
-- 모든 학교별 테이블 업데이트
-- ============================================

-- 공지사항 테이블
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
    updated_count INTEGER;
    sql_text TEXT;
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_notices';
        
        BEGIN
            sql_text := format('
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
                            ''\/+'',
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
                )
            ', table_name);
            
            EXECUTE sql_text;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No images column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 경조사 테이블
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
    updated_count INTEGER;
    sql_text TEXT;
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_life_events';
        
        BEGIN
            sql_text := format('
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
                            ''\/+'',
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
                )
            ', table_name);
            
            EXECUTE sql_text;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No images column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 게시판 테이블
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
    updated_count INTEGER;
    sql_text TEXT;
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_board_posts';
        
        BEGIN
            sql_text := format('
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
                            ''\/+'',
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
                )
            ', table_name);
            
            EXECUTE sql_text;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No images column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 소모임 테이블
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
    updated_count INTEGER;
    sql_text TEXT;
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_circles';
        
        BEGIN
            sql_text := format('
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
                            ''\/+'',
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
                )
            ', table_name);
            
            EXECUTE sql_text;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No images column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 추첨 테이블
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
    updated_count INTEGER;
    sql_text TEXT;
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_raffles';
        
        BEGIN
            sql_text := format('
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
                            ''\/+'',
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
                )
            ', table_name);
            
            EXECUTE sql_text;
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

-- 1. 업데이트 성공한 테이블
SELECT 
    table_name as "✅ 업데이트된 테이블",
    updated_rows as "변경된 행 수"
FROM update_results
WHERE status = 'Success' AND updated_rows > 0
ORDER BY updated_rows DESC, table_name;

-- 2. 모든 테이블 상태
SELECT 
    table_name as "테이블명",
    updated_rows as "업데이트된 행 수",
    CASE 
        WHEN status = 'Success' AND updated_rows > 0 THEN '✅ 성공'
        WHEN status = 'Success' AND updated_rows = 0 THEN '⚠️ 변경 없음'
        WHEN status = 'No images column' THEN '⚠️ images 컬럼 없음'
        ELSE '❌ 에러: ' || status
    END as "상태"
FROM update_results
ORDER BY 
    CASE 
        WHEN status = 'Success' AND updated_rows > 0 THEN 1
        WHEN status = 'Success' AND updated_rows = 0 THEN 2
        WHEN status = 'No images column' THEN 3
        ELSE 4
    END,
    updated_rows DESC,
    table_name;

-- 3. 전체 요약
SELECT 
    '📊 업데이트 요약' as "구분",
    COUNT(*) FILTER (WHERE status = 'Success' AND updated_rows > 0) as "성공한 테이블 수",
    COALESCE(SUM(updated_rows) FILTER (WHERE status = 'Success'), 0) as "총 변경된 행 수",
    COUNT(*) FILTER (WHERE status = 'Success' AND updated_rows = 0) as "변경 없음 테이블 수",
    COUNT(*) FILTER (WHERE status = 'No images column') as "images 컬럼 없는 테이블 수",
    COUNT(*) FILTER (WHERE status LIKE 'Error:%') as "에러 발생 테이블 수"
FROM update_results;

