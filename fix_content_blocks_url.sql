-- 모든 테이블의 content_blocks에서 URL 변경
-- qgtwkhkmdsaypnsnrpbf.supabase.co -> waumfxamhuvhsblehsuf.supabase.co
-- 슬래시 중복 제거: // -> /

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
-- 학교별 테이블 - content_blocks 업데이트
-- ============================================

-- 1. 공지사항 테이블 (content_blocks)
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
                SET content_blocks = (
                    SELECT jsonb_agg(
                        CASE 
                            WHEN block->>''type'' = ''image'' AND block->>''uri'' IS NOT NULL THEN
                                jsonb_set(
                                    block,
                                    ''{uri}'',
                                    to_jsonb(
                                        regexp_replace(
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+'',
                                            ''/'',
                                            ''g''
                                        )
                                    )
                                )
                            ELSE block
                        END
                    )
                    FROM jsonb_array_elements(content_blocks::jsonb) AS block
                )
                WHERE content_blocks IS NOT NULL 
                AND content_blocks::text != ''[]''
                AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(content_blocks::jsonb) AS block
                    WHERE block->>''type'' = ''image''
                    AND block->>''uri'' LIKE ''%%qgtwkhkmdsaypnsnrpbf%%''
                )
            ', table_name);
            
            EXECUTE sql_text;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No content_blocks column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 2. 경조사 테이블 (content_blocks)
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
                SET content_blocks = (
                    SELECT jsonb_agg(
                        CASE 
                            WHEN block->>''type'' = ''image'' AND block->>''uri'' IS NOT NULL THEN
                                jsonb_set(
                                    block,
                                    ''{uri}'',
                                    to_jsonb(
                                        regexp_replace(
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+'',
                                            ''/'',
                                            ''g''
                                        )
                                    )
                                )
                            ELSE block
                        END
                    )
                    FROM jsonb_array_elements(content_blocks::jsonb) AS block
                )
                WHERE content_blocks IS NOT NULL 
                AND content_blocks::text != ''[]''
                AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(content_blocks::jsonb) AS block
                    WHERE block->>''type'' = ''image''
                    AND block->>''uri'' LIKE ''%%qgtwkhkmdsaypnsnrpbf%%''
                )
            ', table_name);
            
            EXECUTE sql_text;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No content_blocks column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 3. 게시판 테이블 (content_blocks)
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
                SET content_blocks = (
                    SELECT jsonb_agg(
                        CASE 
                            WHEN block->>''type'' = ''image'' AND block->>''uri'' IS NOT NULL THEN
                                jsonb_set(
                                    block,
                                    ''{uri}'',
                                    to_jsonb(
                                        regexp_replace(
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+'',
                                            ''/'',
                                            ''g''
                                        )
                                    )
                                )
                            ELSE block
                        END
                    )
                    FROM jsonb_array_elements(content_blocks::jsonb) AS block
                )
                WHERE content_blocks IS NOT NULL 
                AND content_blocks::text != ''[]''
                AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(content_blocks::jsonb) AS block
                    WHERE block->>''type'' = ''image''
                    AND block->>''uri'' LIKE ''%%qgtwkhkmdsaypnsnrpbf%%''
                )
            ', table_name);
            
            EXECUTE sql_text;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No content_blocks column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 4. 소모임 테이블 (content_blocks)
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
                SET content_blocks = (
                    SELECT jsonb_agg(
                        CASE 
                            WHEN block->>''type'' = ''image'' AND block->>''uri'' IS NOT NULL THEN
                                jsonb_set(
                                    block,
                                    ''{uri}'',
                                    to_jsonb(
                                        regexp_replace(
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+'',
                                            ''/'',
                                            ''g''
                                        )
                                    )
                                )
                            ELSE block
                        END
                    )
                    FROM jsonb_array_elements(content_blocks::jsonb) AS block
                )
                WHERE content_blocks IS NOT NULL 
                AND content_blocks::text != ''[]''
                AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(content_blocks::jsonb) AS block
                    WHERE block->>''type'' = ''image''
                    AND block->>''uri'' LIKE ''%%qgtwkhkmdsaypnsnrpbf%%''
                )
            ', table_name);
            
            EXECUTE sql_text;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No content_blocks column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 5. 게시판 댓글 테이블 (content_blocks)
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
        table_name := uni || '_board_comments';
        
        BEGIN
            sql_text := format('
                UPDATE %I 
                SET content_blocks = (
                    SELECT jsonb_agg(
                        CASE 
                            WHEN block->>''type'' = ''image'' AND block->>''uri'' IS NOT NULL THEN
                                jsonb_set(
                                    block,
                                    ''{uri}'',
                                    to_jsonb(
                                        regexp_replace(
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+'',
                                            ''/'',
                                            ''g''
                                        )
                                    )
                                )
                            ELSE block
                        END
                    )
                    FROM jsonb_array_elements(content_blocks::jsonb) AS block
                )
                WHERE content_blocks IS NOT NULL 
                AND content_blocks::text != ''[]''
                AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(content_blocks::jsonb) AS block
                    WHERE block->>''type'' = ''image''
                    AND block->>''uri'' LIKE ''%%qgtwkhkmdsaypnsnrpbf%%''
                )
            ', table_name);
            
            EXECUTE sql_text;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No content_blocks column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- 6. 소모임 댓글 테이블 (content_blocks)
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
        table_name := uni || '_circles_comments';
        
        BEGIN
            sql_text := format('
                UPDATE %I 
                SET content_blocks = (
                    SELECT jsonb_agg(
                        CASE 
                            WHEN block->>''type'' = ''image'' AND block->>''uri'' IS NOT NULL THEN
                                jsonb_set(
                                    block,
                                    ''{uri}'',
                                    to_jsonb(
                                        regexp_replace(
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+'',
                                            ''/'',
                                            ''g''
                                        )
                                    )
                                )
                            ELSE block
                        END
                    )
                    FROM jsonb_array_elements(content_blocks::jsonb) AS block
                )
                WHERE content_blocks IS NOT NULL 
                AND content_blocks::text != ''[]''
                AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(content_blocks::jsonb) AS block
                    WHERE block->>''type'' = ''image''
                    AND block->>''uri'' LIKE ''%%qgtwkhkmdsaypnsnrpbf%%''
                )
            ', table_name);
            
            EXECUTE sql_text;
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            INSERT INTO update_results VALUES (table_name, updated_count, 'Success');
        EXCEPTION WHEN undefined_column THEN
            INSERT INTO update_results VALUES (table_name, 0, 'No content_blocks column');
        WHEN OTHERS THEN
            INSERT INTO update_results VALUES (table_name, 0, 'Error: ' || SQLERRM);
        END;
    END LOOP;
END $$;

-- ============================================
-- MIUHub 및 공통 테이블
-- ============================================

-- 7. MIUHub Featured 테이블 (content_blocks)
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    BEGIN
        UPDATE miuhub_featured 
        SET content_blocks = (
            SELECT jsonb_agg(
                CASE 
                    WHEN block->>'type' = 'image' AND block->>'uri' IS NOT NULL THEN
                        jsonb_set(
                            block,
                            '{uri}',
                            to_jsonb(
                                regexp_replace(
                                    regexp_replace(
                                        block->>'uri',
                                        'qgtwkhkmdsaypnsnrpbf\.supabase\.co',
                                        'waumfxamhuvhsblehsuf.supabase.co',
                                        'g'
                                    ),
                                    '\/+',
                                    '/',
                                    'g'
                                )
                            )
                        )
                    ELSE block
                END
            )
            FROM jsonb_array_elements(content_blocks::jsonb) AS block
        )
        WHERE content_blocks IS NOT NULL 
        AND content_blocks::text != '[]'
        AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(content_blocks::jsonb) AS block
            WHERE block->>'type' = 'image'
            AND block->>'uri' LIKE '%qgtwkhkmdsaypnsnrpbf%'
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        INSERT INTO update_results VALUES ('miuhub_featured', updated_count, 'Success');
    EXCEPTION WHEN undefined_table THEN
        INSERT INTO update_results VALUES ('miuhub_featured', 0, 'Table does not exist');
    WHEN undefined_column THEN
        INSERT INTO update_results VALUES ('miuhub_featured', 0, 'No content_blocks column');
    WHEN OTHERS THEN
        INSERT INTO update_results VALUES ('miuhub_featured', 0, 'Error: ' || SQLERRM);
    END;
END $$;

-- 8. 팝업 테이블 (content_blocks)
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    BEGIN
        UPDATE popups 
        SET content_blocks = (
            SELECT jsonb_agg(
                CASE 
                    WHEN block->>'type' = 'image' AND block->>'uri' IS NOT NULL THEN
                        jsonb_set(
                            block,
                            '{uri}',
                            to_jsonb(
                                regexp_replace(
                                    regexp_replace(
                                        block->>'uri',
                                        'qgtwkhkmdsaypnsnrpbf\.supabase\.co',
                                        'waumfxamhuvhsblehsuf.supabase.co',
                                        'g'
                                    ),
                                    '\/+',
                                    '/',
                                    'g'
                                )
                            )
                        )
                    ELSE block
                END
            )
            FROM jsonb_array_elements(content_blocks::jsonb) AS block
        )
        WHERE content_blocks IS NOT NULL 
        AND content_blocks::text != '[]'
        AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(content_blocks::jsonb) AS block
            WHERE block->>'type' = 'image'
            AND block->>'uri' LIKE '%qgtwkhkmdsaypnsnrpbf%'
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        INSERT INTO update_results VALUES ('popups', updated_count, 'Success');
    EXCEPTION WHEN undefined_table THEN
        INSERT INTO update_results VALUES ('popups', 0, 'Table does not exist');
    WHEN undefined_column THEN
        INSERT INTO update_results VALUES ('popups', 0, 'No content_blocks column');
    WHEN OTHERS THEN
        INSERT INTO update_results VALUES ('popups', 0, 'Error: ' || SQLERRM);
    END;
END $$;

-- ============================================
-- 결과 출력
-- ============================================

-- 1. 업데이트 성공한 테이블 목록
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
        WHEN status = 'No content_blocks column' THEN '⚠️ content_blocks 컬럼 없음'
        WHEN status = 'Table does not exist' THEN '⚠️ 테이블 없음'
        ELSE '❌ 에러: ' || status
    END as "상태"
FROM update_results
ORDER BY 
    CASE 
        WHEN status = 'Success' AND updated_rows > 0 THEN 1
        WHEN status = 'Success' AND updated_rows = 0 THEN 2
        WHEN status = 'No content_blocks column' THEN 3
        WHEN status = 'Table does not exist' THEN 4
        ELSE 5
    END,
    updated_rows DESC,
    table_name;

-- 3. 전체 요약
SELECT 
    '📊 업데이트 요약' as "구분",
    COUNT(*) FILTER (WHERE status = 'Success' AND updated_rows > 0) as "성공한 테이블 수",
    COALESCE(SUM(updated_rows) FILTER (WHERE status = 'Success'), 0) as "총 변경된 행 수",
    COUNT(*) FILTER (WHERE status = 'Success' AND updated_rows = 0) as "변경 없음 테이블 수",
    COUNT(*) FILTER (WHERE status = 'No content_blocks column') as "content_blocks 컬럼 없는 테이블 수",
    COUNT(*) FILTER (WHERE status = 'Table does not exist') as "존재하지 않는 테이블 수",
    COUNT(*) FILTER (WHERE status LIKE 'Error:%') as "에러 발생 테이블 수"
FROM update_results;

