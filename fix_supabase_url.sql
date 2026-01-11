-- Supabase URL 변경 및 슬래시 중복 수정 SQL 스크립트
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
-- 학교별 테이블 (5개 학교 × 7개 테이블 = 35개)
-- ============================================

-- 1. 공지사항 테이블 (content_blocks, images)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_notices';
        
        IF NOT table_exists(table_name) THEN
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
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+\'',
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
                AND content_blocks::text LIKE ''%%qgtwkhkmdsaypnsnrpbf%%'';
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
        
        IF NOT table_exists(table_name) THEN
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
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+\'',
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
                AND content_blocks::text LIKE ''%%qgtwkhkmdsaypnsnrpbf%%'';
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
            
            RAISE NOTICE 'Updated % (images)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have images column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (images): %', table_name, SQLERRM;
        END;
        
        RAISE NOTICE 'Completed %', table_name;
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
        
        IF NOT table_exists(table_name) THEN
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
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+\'',
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
                AND content_blocks::text LIKE ''%%qgtwkhkmdsaypnsnrpbf%%'';
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
            
            RAISE NOTICE 'Updated % (images)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have images column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (images): %', table_name, SQLERRM;
        END;
        
        RAISE NOTICE 'Completed %', table_name;
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
        
        IF NOT table_exists(table_name) THEN
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
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+\'',
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
                AND content_blocks::text LIKE ''%%qgtwkhkmdsaypnsnrpbf%%'';
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
            
            RAISE NOTICE 'Updated % (images)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have images column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (images): %', table_name, SQLERRM;
        END;
        
        RAISE NOTICE 'Completed %', table_name;
    END LOOP;
END $$;

-- 5. 추첨 테이블 (raffles) - image_url, images
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_raffles';
        
        IF NOT table_exists(table_name) THEN
            RAISE NOTICE 'Table % does not exist, skipping', table_name;
            CONTINUE;
        END IF;
        
        -- image_url 컬럼 수정
        BEGIN
            EXECUTE format('
                UPDATE %I 
                SET image_url = regexp_replace(
                    regexp_replace(
                        image_url,
                        ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                        ''waumfxamhuvhsblehsuf.supabase.co'',
                        ''g''
                    ),
                    ''\/+\'',
                    ''/'',
                    ''g''
                )
                WHERE image_url IS NOT NULL 
                AND image_url LIKE ''%%qgtwkhkmdsaypnsnrpbf%%'';
            ', table_name);
            
            RAISE NOTICE 'Updated % (image_url)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have image_url column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (image_url): %', table_name, SQLERRM;
        END;
        
        -- images 배열 수정
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
            
            RAISE NOTICE 'Updated % (images)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have images column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (images): %', table_name, SQLERRM;
        END;
        
        RAISE NOTICE 'Completed %', table_name;
    END LOOP;
END $$;

-- 6. 게시판 댓글 테이블 (content_blocks)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_board_comments';
        
        IF NOT table_exists(table_name) THEN
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
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+\'',
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
                AND content_blocks::text LIKE ''%%qgtwkhkmdsaypnsnrpbf%%'';
            ', table_name);
            
            RAISE NOTICE 'Updated % (content_blocks)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have content_blocks column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (content_blocks): %', table_name, SQLERRM;
        END;
        
        RAISE NOTICE 'Completed %', table_name;
    END LOOP;
END $$;

-- 7. 소모임 댓글 테이블 (content_blocks)
DO $$
DECLARE
    uni TEXT;
    table_name TEXT;
    universities TEXT[] := ARRAY['nyu', 'cornell', 'usc', 'columbia', 'miuhub'];
BEGIN
    FOREACH uni IN ARRAY universities
    LOOP
        table_name := uni || '_circles_comments';
        
        IF NOT table_exists(table_name) THEN
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
                                            regexp_replace(
                                                block->>''uri'',
                                                ''qgtwkhkmdsaypnsnrpbf\.supabase\.co'',
                                                ''waumfxamhuvhsblehsuf.supabase.co'',
                                                ''g''
                                            ),
                                            ''\/+\'',
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
                AND content_blocks::text LIKE ''%%qgtwkhkmdsaypnsnrpbf%%'';
            ', table_name);
            
            RAISE NOTICE 'Updated % (content_blocks)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have content_blocks column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (content_blocks): %', table_name, SQLERRM;
        END;
        
        RAISE NOTICE 'Completed %', table_name;
    END LOOP;
END $$;

-- ============================================
-- MIUHub 전용 테이블
-- ============================================

-- 8. MIUHub Featured 테이블 (content_blocks, image_url)
DO $$
BEGIN
    IF NOT table_exists('miuhub_featured') THEN
        RAISE NOTICE 'Table miuhub_featured does not exist, skipping';
        RETURN;
    END IF;
    
    -- content_blocks의 이미지 URL 수정
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
        AND content_blocks::text LIKE '%qgtwkhkmdsaypnsnrpbf%';
        
        RAISE NOTICE 'Updated miuhub_featured (content_blocks)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error updating miuhub_featured (content_blocks): %', SQLERRM;
    END;
    
    -- image_url 컬럼 수정
    BEGIN
        UPDATE miuhub_featured 
        SET image_url = regexp_replace(
            regexp_replace(
                image_url,
                'qgtwkhkmdsaypnsnrpbf\.supabase\.co',
                'waumfxamhuvhsblehsuf.supabase.co',
                'g'
            ),
            '\/+',
            '/',
            'g'
        )
        WHERE image_url IS NOT NULL 
        AND image_url LIKE '%qgtwkhkmdsaypnsnrpbf%';
        
        RAISE NOTICE 'Updated miuhub_featured (image_url)';
    EXCEPTION WHEN undefined_column THEN
        RAISE NOTICE 'miuhub_featured does not have image_url column';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating miuhub_featured (image_url): %', SQLERRM;
    END;
END $$;

-- ============================================
-- 공통 테이블
-- ============================================

-- 9. 팝업 테이블 (popups) - content_blocks
DO $$
BEGIN
    IF NOT table_exists('popups') THEN
        RAISE NOTICE 'Table popups does not exist, skipping';
        RETURN;
    END IF;
    
    -- content_blocks의 이미지 URL 수정
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
        AND content_blocks::text LIKE '%qgtwkhkmdsaypnsnrpbf%';
        
        RAISE NOTICE 'Updated popups (content_blocks)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error updating popups: %', SQLERRM;
    END;
END $$;

-- 10. app_config 테이블 (value에 URL이 포함될 수 있음)
DO $$
BEGIN
    IF NOT table_exists('app_config') THEN
        RAISE NOTICE 'Table app_config does not exist, skipping';
        RETURN;
    END IF;
    
    -- value에 이미지 URL이 포함된 경우 수정
    BEGIN
        UPDATE app_config 
        SET value = regexp_replace(
            regexp_replace(
                value,
                'qgtwkhkmdsaypnsnrpbf\.supabase\.co',
                'waumfxamhuvhsblehsuf.supabase.co',
                'g'
            ),
            '\/+',
            '/',
            'g'
        )
        WHERE value IS NOT NULL 
        AND value LIKE '%qgtwkhkmdsaypnsnrpbf%';
        
        RAISE NOTICE 'Updated app_config';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error updating app_config: %', SQLERRM;
    END;
END $$;

-- 11. users 테이블 (profile_image_url 등)
DO $$
BEGIN
    IF NOT table_exists('users') THEN
        RAISE NOTICE 'Table users does not exist, skipping';
        RETURN;
    END IF;
    
    -- profile_image_url 컬럼 수정
    BEGIN
        UPDATE users 
        SET profile_image_url = regexp_replace(
            regexp_replace(
                profile_image_url,
                'qgtwkhkmdsaypnsnrpbf\.supabase\.co',
                'waumfxamhuvhsblehsuf.supabase.co',
                'g'
            ),
            '\/+',
            '/',
            'g'
        )
        WHERE profile_image_url IS NOT NULL 
        AND profile_image_url LIKE '%qgtwkhkmdsaypnsnrpbf%';
        
        RAISE NOTICE 'Updated users (profile_image_url)';
    EXCEPTION WHEN undefined_column THEN
        RAISE NOTICE 'users table does not have profile_image_url column';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating users: %', SQLERRM;
    END;
END $$;

-- ============================================
-- 정리
-- ============================================

-- 헬퍼 함수 삭제
DROP FUNCTION IF EXISTS table_exists(TEXT);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Supabase URL 변경 완료!';
    RAISE NOTICE 'qgtwkhkmdsaypnsnrpbf.supabase.co -> waumfxamhuvhsblehsuf.supabase.co';
    RAISE NOTICE '슬래시 중복 제거 완료 (// -> /)';
    RAISE NOTICE '========================================';
END $$;
