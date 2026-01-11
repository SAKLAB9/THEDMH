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
-- 학교별 테이블 - images 배열 업데이트
-- ============================================

-- 1. 공지사항 테이블 (images 배열)
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
            
            RAISE NOTICE 'Updated % (images array)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have images column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (images): %', table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 2. 경조사 테이블 (images 배열)
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
            
            RAISE NOTICE 'Updated % (images array)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have images column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (images): %', table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 3. 게시판 테이블 (images 배열)
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
            
            RAISE NOTICE 'Updated % (images array)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have images column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (images): %', table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 4. 소모임 테이블 (images 배열)
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
            
            RAISE NOTICE 'Updated % (images array)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have images column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (images): %', table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 5. 추첨 테이블 (images 배열)
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
            
            RAISE NOTICE 'Updated % (images array)', table_name;
        EXCEPTION WHEN undefined_column THEN
            RAISE NOTICE 'Table % does not have images column', table_name;
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating % (images): %', table_name, SQLERRM;
        END;
    END LOOP;
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
    RAISE NOTICE '모든 테이블의 images 배열 URL 변경 완료!';
    RAISE NOTICE 'qgtwkhkmdsaypnsnrpbf.supabase.co -> waumfxamhuvhsblehsuf.supabase.co';
    RAISE NOTICE '슬래시 중복 제거 완료 (// -> /)';
    RAISE NOTICE '========================================';
END $$;

