-- 이미지 URL 경로 수정 SQL 스크립트
-- Storage 구조: 학교이름/파일명 (예: nyu/image_xxx.jpg)
-- 데이터베이스 URL: /images/nyu/images/image_xxx.jpg -> /images/nyu/image_xxx.jpg 로 수정

-- ============================================
-- 학교별 테이블 (7개) - 각 학교마다 실행 필요
-- ============================================

-- 1. 공지사항 테이블 (content_blocks, images)
-- 예: nyu_notices, cornell_notices, usc_notices, columbia_notices 등
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    table_exists BOOLEAN;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_notices';
        
        -- 테이블 존재 여부 확인
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = table_name
        ) INTO table_exists;
        
        IF NOT table_exists THEN
            RAISE NOTICE 'Table % does not exist, skipping', table_name;
            CONTINUE;
        END IF;
        
        -- content_blocks의 이미지 URL 수정
        BEGIN
            EXECUTE format('
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
                                            ''/images/([^/]+)/images/'',
                                            ''/images/\1/'',
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
                AND content_blocks::text LIKE ''%%/images/%%/images/%%'';
            ', table_name);
            
            RAISE NOTICE 'Updated % (content_blocks)', table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (content_blocks): %', table_name, SQLERRM;
        END;
        
        -- images 배열의 URL 수정
        BEGIN
            EXECUTE format('
                UPDATE %I 
                SET images = (
                    SELECT array_agg(fixed_img)
                    FROM (
                        SELECT regexp_replace(
                            img,
                            ''/images/([^/]+)/images/'',
                            ''/images/\1/'',
                            ''g''
                        ) AS fixed_img
                        FROM unnest(images) AS img
                    ) AS fixed_images
                )
                WHERE images IS NOT NULL 
                AND array_length(images, 1) > 0
                AND EXISTS (
                    SELECT 1 FROM unnest(images) AS img 
                    WHERE img LIKE ''%%/images/%%/images/%%''
                );
            ', table_name);
            
            RAISE NOTICE 'Updated % (images)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have images column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (images): %', table_name, SQLERRM;
        END;
        
        RAISE NOTICE 'Completed %', table_name;
    END LOOP;
END $$;

-- 2. 경조사 테이블 (content_blocks, images)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_life_events';
        
        -- content_blocks의 이미지 URL 수정
        EXECUTE format('
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
                                        ''/images/([^/]+)/images/'',
                                        ''/images/\1/'',
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
            AND content_blocks::text LIKE ''%%/images/%%/images/%%'';
        ', table_name);
        
        -- images 배열의 URL 수정
        EXECUTE format('
            UPDATE %I 
            SET images = (
                SELECT array_agg(fixed_img)
                FROM (
                    SELECT regexp_replace(
                        img,
                        ''/images/([^/]+)/images/'',
                        ''/images/\1/'',
                        ''g''
                    ) AS fixed_img
                    FROM unnest(images) AS img
                ) AS fixed_images
            )
            WHERE images IS NOT NULL 
            AND array_length(images, 1) > 0
            AND EXISTS (
                SELECT 1 FROM unnest(images) AS img 
                WHERE img LIKE ''%%/images/%%/images/%%''
            );
        ', table_name);
        
        RAISE NOTICE 'Updated %', table_name;
    END LOOP;
END $$;

-- 3. 게시판 테이블 (content_blocks, images)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_board_posts';
        
        -- content_blocks의 이미지 URL 수정
        EXECUTE format('
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
                                        ''/images/([^/]+)/images/'',
                                        ''/images/\1/'',
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
            AND content_blocks::text LIKE ''%%/images/%%/images/%%'';
        ', table_name);
        
        -- images 배열의 URL 수정
        EXECUTE format('
            UPDATE %I 
            SET images = (
                SELECT array_agg(fixed_img)
                FROM (
                    SELECT regexp_replace(
                        img,
                        ''/images/([^/]+)/images/'',
                        ''/images/\1/'',
                        ''g''
                    ) AS fixed_img
                    FROM unnest(images) AS img
                ) AS fixed_images
            )
            WHERE images IS NOT NULL 
            AND array_length(images, 1) > 0
            AND EXISTS (
                SELECT 1 FROM unnest(images) AS img 
                WHERE img LIKE ''%%/images/%%/images/%%''
            );
        ', table_name);
        
        RAISE NOTICE 'Updated %', table_name;
    END LOOP;
END $$;

-- 4. 소모임 테이블 (content_blocks, images)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_circles';
        
        -- content_blocks의 이미지 URL 수정
        EXECUTE format('
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
                                        ''/images/([^/]+)/images/'',
                                        ''/images/\1/'',
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
            AND content_blocks::text LIKE ''%%/images/%%/images/%%'';
        ', table_name);
        
        -- images 배열의 URL 수정
        EXECUTE format('
            UPDATE %I 
            SET images = (
                SELECT array_agg(fixed_img)
                FROM (
                    SELECT regexp_replace(
                        img,
                        ''/images/([^/]+)/images/'',
                        ''/images/\1/'',
                        ''g''
                    ) AS fixed_img
                    FROM unnest(images) AS img
                ) AS fixed_images
            )
            WHERE images IS NOT NULL 
            AND array_length(images, 1) > 0
            AND EXISTS (
                SELECT 1 FROM unnest(images) AS img 
                WHERE img LIKE ''%%/images/%%/images/%%''
            );
        ', table_name);
        
        RAISE NOTICE 'Updated %', table_name;
    END LOOP;
END $$;

-- 5. 추첨 테이블 (raffles) - 이미지가 있을 수 있음
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_raffles';
        
        -- image_url 컬럼이 있으면 수정
        BEGIN
            EXECUTE format('
                UPDATE %I 
                SET image_url = regexp_replace(
                    image_url,
                    ''/images/([^/]+)/images/'',
                    ''/images/\1/'',
                    ''g''
                )
                WHERE image_url IS NOT NULL 
                AND image_url LIKE ''%%/images/%%/images/%%'';
            ', table_name);
            
            RAISE NOTICE 'Updated % (image_url)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have image_url column', table_name;
        END;
        
        -- images 배열이 있으면 수정
        BEGIN
            EXECUTE format('
                UPDATE %I 
                SET images = (
                    SELECT array_agg(fixed_img)
                    FROM (
                        SELECT regexp_replace(
                            img,
                            ''/images/([^/]+)/images/'',
                            ''/images/\1/'',
                            ''g''
                        ) AS fixed_img
                        FROM unnest(images) AS img
                    ) AS fixed_images
                )
                WHERE images IS NOT NULL 
                AND array_length(images, 1) > 0
                AND EXISTS (
                    SELECT 1 FROM unnest(images) AS img 
                    WHERE img LIKE ''%%/images/%%/images/%%''
                );
            ', table_name);
            
            RAISE NOTICE 'Updated % (images)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have images column', table_name;
        END;
    END LOOP;
END $$;

-- 6. 게시판 댓글 테이블 (댓글에 이미지가 있을 수 있음)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_board_comments';
        
        -- content_blocks 또는 image_url 컬럼이 있으면 수정
        BEGIN
            EXECUTE format('
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
                                            ''/images/([^/]+)/images/'',
                                            ''/images/\1/'',
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
                AND content_blocks::text LIKE ''%%/images/%%/images/%%'';
            ', table_name);
            
            RAISE NOTICE 'Updated % (content_blocks)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have content_blocks column', table_name;
        END;
    END LOOP;
END $$;

-- 7. 소모임 댓글 테이블 (댓글에 이미지가 있을 수 있음)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_circles_comments';
        
        -- content_blocks 또는 image_url 컬럼이 있으면 수정
        BEGIN
            EXECUTE format('
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
                                            ''/images/([^/]+)/images/'',
                                            ''/images/\1/'',
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
                AND content_blocks::text LIKE ''%%/images/%%/images/%%'';
            ', table_name);
            
            RAISE NOTICE 'Updated % (content_blocks)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have content_blocks column', table_name;
        END;
    END LOOP;
END $$;

-- ============================================
-- MIUHub 전용 테이블 (5개)
-- ============================================

-- 8. MIUHub Featured 테이블
DO $$
BEGIN
    -- content_blocks의 이미지 URL 수정
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
                                '/images/([^/]+)/images/',
                                '/images/\1/',
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
    AND content_blocks::text LIKE '%/images/%/images/%';
    
    -- image_url 컬럼이 있으면 수정
    BEGIN
        UPDATE miuhub_featured 
        SET image_url = regexp_replace(
            image_url,
            '/images/([^/]+)/images/',
            '/images/\1/',
            'g'
        )
        WHERE image_url IS NOT NULL 
        AND image_url LIKE '%/images/%/images/%';
        
        RAISE NOTICE 'Updated miuhub_featured (image_url)';
    EXCEPTION WHEN undefined_column THEN
        RAISE NOTICE 'miuhub_featured does not have image_url column';
    END;
    
    RAISE NOTICE 'Updated miuhub_featured';
END $$;

-- ============================================
-- 개별 테이블 (3개)
-- ============================================

-- 9. 팝업 테이블 (popups)
DO $$
BEGIN
    -- content_blocks의 이미지 URL 수정
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
                                '/images/([^/]+)/images/',
                                '/images/\1/',
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
    AND content_blocks::text LIKE '%/images/%/images/%';
    
    RAISE NOTICE 'Updated popups';
END $$;

-- 10. app_config 테이블 (설정 값에 이미지 URL이 있을 수 있음)
DO $$
BEGIN
    -- value에 이미지 URL이 포함된 경우 수정
    UPDATE app_config 
    SET value = regexp_replace(
        value,
        '/images/([^/]+)/images/',
        '/images/\1/',
        'g'
    )
    WHERE value IS NOT NULL 
    AND value LIKE '%/images/%/images/%';
    
    RAISE NOTICE 'Updated app_config';
END $$;

-- 11. 기타 공통 테이블 (필요시 추가)
-- 예: users 테이블의 profile_image_url 등
DO $$
BEGIN
    -- users 테이블의 profile_image_url 수정 (테이블이 있는 경우)
    BEGIN
        UPDATE users 
        SET profile_image_url = regexp_replace(
            profile_image_url,
            '/images/([^/]+)/images/',
            '/images/\1/',
            'g'
        )
        WHERE profile_image_url IS NOT NULL 
        AND profile_image_url LIKE '%/images/%/images/%';
        
        RAISE NOTICE 'Updated users (profile_image_url)';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'users table does not exist';
    END;
END $$;

-- ============================================
-- 수정 결과 확인 쿼리
-- ============================================

-- 수정된 레코드 수 확인 (예시)
-- SELECT 
--     'nyu_notices' as table_name,
--     COUNT(*) as updated_count
-- FROM nyu_notices
-- WHERE content_blocks::text LIKE '%/images/%/images/%'
--    OR EXISTS (
--        SELECT 1 FROM unnest(images) AS img 
--        WHERE img LIKE '%/images/%/images/%'
--    );

DO $$
BEGIN
    RAISE NOTICE 'Image URL fix completed!';
END $$;

