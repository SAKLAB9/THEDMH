-- Circles 테이블에 누락된 컬럼 추가 SQL
-- 각 학교별 circles 테이블에 필요한 컬럼들을 추가합니다
-- 결과가 출력되어 성공/실패 여부를 확인할 수 있습니다

-- ============================================
-- 단일 테이블에 적용하는 방법 (예: nyu_circles)
-- ============================================

DO $$
DECLARE
    tbl_name TEXT := 'nyu_circles';
    col_name TEXT;
    col_type TEXT;
    result_msg TEXT;
    column_exists BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '테이블: %', tbl_name;
    RAISE NOTICE '========================================';
    
    -- 1. region 컬럼 추가 (지역)
    col_name := 'region';
    col_type := 'TEXT';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 2. location 컬럼 추가 (장소)
    col_name := 'location';
    col_type := 'TEXT';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 3. keywords 컬럼 추가 (키워드)
    col_name := 'keywords';
    col_type := 'TEXT';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 4. participants 컬럼 추가 (참가인원)
    col_name := 'participants';
    col_type := 'TEXT';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 5. fee 컬럼 추가 (참가비)
    col_name := 'fee';
    col_type := 'TEXT';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 6. contact 컬럼 추가 (연락처)
    col_name := 'contact';
    col_type := 'TEXT';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 7. event_date 컬럼 추가 (이벤트 날짜)
    col_name := 'event_date';
    col_type := 'TIMESTAMP';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 8. account_number 컬럼 추가 (계좌번호)
    col_name := 'account_number';
    col_type := 'TEXT';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 9. views 컬럼 추가 (조회수)
    col_name := 'views';
    col_type := 'INTEGER DEFAULT 0';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 10. nickname 컬럼 추가 (닉네임)
    col_name := 'nickname';
    col_type := 'TEXT';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 11. url 컬럼 추가 (URL)
    col_name := 'url';
    col_type := 'TEXT';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 12. report_count 컬럼 추가 (신고 횟수)
    col_name := 'report_count';
    col_type := 'INTEGER DEFAULT 0';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 13. is_closed 컬럼 추가 (마감 여부)
    col_name := 'is_closed';
    col_type := 'BOOLEAN DEFAULT false';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    -- 14. closed_at 컬럼 추가 (마감 시간)
    col_name := 'closed_at';
    col_type := 'TIMESTAMP';
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = tbl_name 
        AND column_name = col_name
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '[SKIP] % 컬럼이 이미 존재합니다.', col_name;
    ELSE
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
            RAISE NOTICE '[SUCCESS] % 컬럼 추가 완료', col_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
        END;
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '작업 완료: %', tbl_name;
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- 모든 학교 테이블에 한 번에 적용하는 방법
-- ============================================

DO $$
DECLARE
    tbl_name TEXT;
    col_name TEXT;
    col_type TEXT;
    column_exists BOOLEAN;
    columns_to_add TEXT[][] := ARRAY[
        ['region', 'TEXT'],
        ['location', 'TEXT'],
        ['keywords', 'TEXT'],
        ['participants', 'TEXT'],
        ['fee', 'TEXT'],
        ['contact', 'TEXT'],
        ['event_date', 'TIMESTAMP'],
        ['account_number', 'TEXT'],
        ['views', 'INTEGER DEFAULT 0'],
        ['nickname', 'TEXT'],
        ['url', 'TEXT'],
        ['report_count', 'INTEGER DEFAULT 0'],
        ['is_closed', 'BOOLEAN DEFAULT false'],
        ['closed_at', 'TIMESTAMP']
    ];
    col_record TEXT[];
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '모든 circles 테이블에 컬럼 추가 시작';
    RAISE NOTICE '========================================';
    
    FOR tbl_name IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE '%_circles'
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE '--- 테이블: % ---', tbl_name;
        
        FOREACH col_record SLICE 1 IN ARRAY columns_to_add
        LOOP
            col_name := col_record[1];
            col_type := col_record[2];
            
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND information_schema.columns.table_name = tbl_name 
                AND column_name = col_name
            ) INTO column_exists;
            
            IF column_exists THEN
                RAISE NOTICE '  [SKIP] % 컬럼이 이미 존재합니다.', col_name;
            ELSE
                BEGIN
                    EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', tbl_name, col_name, col_type);
                    RAISE NOTICE '  [SUCCESS] % 컬럼 추가 완료', col_name;
                EXCEPTION WHEN OTHERS THEN
                    RAISE NOTICE '  [FAILED] % 컬럼 추가 실패: %', col_name, SQLERRM;
                END;
            END IF;
        END LOOP;
        
        RAISE NOTICE '--- % 완료 ---', tbl_name;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '모든 작업 완료';
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- 특정 테이블만 확인하려면 (예: nyu_circles)
-- ============================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'nyu_circles'
-- ORDER BY ordinal_position;

