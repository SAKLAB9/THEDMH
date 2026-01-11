-- https:/ -> https:// 수정
-- 이미 잘못 업데이트된 content_blocks의 URL 수정

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

-- 1. 공지사항 테이블
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
                                            block->>''uri'',
                                            ''https:/'',
                                            ''https://'',
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
                AND content_blocks::text LIKE ''%%https:/%%''
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

-- 2. 경조사 테이블
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
                                            block->>''uri'',
                                            ''https:/'',
                                            ''https://'',
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
                AND content_blocks::text LIKE ''%%https:/%%''
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

-- 3. 게시판 테이블
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
                                            block->>''uri'',
                                            ''https:/'',
                                            ''https://'',
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
                AND content_blocks::text LIKE ''%%https:/%%''
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

-- 4. 소모임 테이블
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
                                            block->>''uri'',
                                            ''https:/'',
                                            ''https://'',
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
                AND content_blocks::text LIKE ''%%https:/%%''
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

-- 5. 게시판 댓글 테이블
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
                                            block->>''uri'',
                                            ''https:/'',
                                            ''https://'',
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
                AND content_blocks::text LIKE ''%%https:/%%''
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

-- 6. 소모임 댓글 테이블
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
                                            block->>''uri'',
                                            ''https:/'',
                                            ''https://'',
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
                AND content_blocks::text LIKE ''%%https:/%%''
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

-- 7. MIUHub Featured 테이블
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
                                    block->>'uri',
                                    'https:/',
                                    'https://',
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
        AND content_blocks::text LIKE '%https:/%';
        
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

-- 8. 팝업 테이블
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
                                    block->>'uri',
                                    'https:/',
                                    'https://',
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
        AND content_blocks::text LIKE '%https:/%';
        
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
    table_name as "updated_table",
    updated_rows as "changed_rows"
FROM update_results
WHERE status = 'Success' AND updated_rows > 0
ORDER BY updated_rows DESC, table_name;

-- 2. 모든 테이블 상태
SELECT 
    table_name as "table_name",
    updated_rows as "updated_rows",
    CASE 
        WHEN status = 'Success' AND updated_rows > 0 THEN 'Success'
        WHEN status = 'Success' AND updated_rows = 0 THEN 'No changes'
        WHEN status = 'No content_blocks column' THEN 'No content_blocks column'
        WHEN status = 'Table does not exist' THEN 'Table does not exist'
        ELSE 'Error: ' || status
    END as "status"
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
    'Summary' as "type",
    COUNT(*) FILTER (WHERE status = 'Success' AND updated_rows > 0) as "success_tables",
    COALESCE(SUM(updated_rows) FILTER (WHERE status = 'Success'), 0) as "total_changed_rows",
    COUNT(*) FILTER (WHERE status = 'Success' AND updated_rows = 0) as "no_change_tables",
    COUNT(*) FILTER (WHERE status = 'No content_blocks column') as "no_column_tables",
    COUNT(*) FILTER (WHERE status = 'Table does not exist') as "not_exist_tables",
    COUNT(*) FILTER (WHERE status LIKE 'Error:%') as "error_tables"
FROM update_results;

