-- 실제 데이터베이스에 저장된 URL 형식 확인

-- 1. nyu_notices 테이블에서 content_blocks의 이미지 URL 샘플 (최대 10개)
SELECT 
    id,
    title,
    block->>'uri' as image_url,
    CASE 
        WHEN block->>'uri' LIKE '%qgtwkhkmdsaypnsnrpbf%' THEN 'OLD URL'
        WHEN block->>'uri' LIKE '%waumfxamhuvhsblehsuf%' THEN 'NEW URL'
        WHEN block->>'uri' LIKE '%supabase.co%' THEN 'OTHER SUPABASE'
        ELSE 'NOT SUPABASE'
    END as url_type
FROM nyu_notices, jsonb_array_elements(content_blocks::jsonb) AS block
WHERE block->>'type' = 'image' 
AND block->>'uri' IS NOT NULL
LIMIT 10;

-- 2. nyu_notices 테이블에서 images 배열의 URL 샘플 (최대 10개)
SELECT 
    id,
    title,
    unnest(images) as image_url,
    CASE 
        WHEN unnest(images) LIKE '%qgtwkhkmdsaypnsnrpbf%' THEN 'OLD URL'
        WHEN unnest(images) LIKE '%waumfxamhuvhsblehsuf%' THEN 'NEW URL'
        WHEN unnest(images) LIKE '%supabase.co%' THEN 'OTHER SUPABASE'
        ELSE 'NOT SUPABASE'
    END as url_type
FROM nyu_notices
WHERE images IS NOT NULL 
AND array_length(images, 1) > 0
LIMIT 10;

-- 3. 모든 테이블에서 qgtwkhkmdsaypnsnrpbf가 포함된 URL 개수 확인
SELECT 
    'nyu_notices (content_blocks)' as source,
    COUNT(*) as count
FROM nyu_notices, jsonb_array_elements(content_blocks::jsonb) AS block
WHERE block->>'uri' LIKE '%qgtwkhkmdsaypnsnrpbf%'

UNION ALL

SELECT 
    'nyu_notices (images)' as source,
    COUNT(*) as count
FROM nyu_notices
WHERE EXISTS (
    SELECT 1 FROM unnest(images) AS img 
    WHERE img LIKE '%qgtwkhkmdsaypnsnrpbf%'
)

UNION ALL

SELECT 
    'nyu_life_events (content_blocks)' as source,
    COUNT(*) as count
FROM nyu_life_events, jsonb_array_elements(content_blocks::jsonb) AS block
WHERE block->>'uri' LIKE '%qgtwkhkmdsaypnsnrpbf%'

UNION ALL

SELECT 
    'nyu_board_posts (content_blocks)' as source,
    COUNT(*) as count
FROM nyu_board_posts, jsonb_array_elements(content_blocks::jsonb) AS block
WHERE block->>'uri' LIKE '%qgtwkhkmdsaypnsnrpbf%'

UNION ALL

SELECT 
    'nyu_circles (content_blocks)' as source,
    COUNT(*) as count
FROM nyu_circles, jsonb_array_elements(content_blocks::jsonb) AS block
WHERE block->>'uri' LIKE '%qgtwkhkmdsaypnsnrpbf%';

