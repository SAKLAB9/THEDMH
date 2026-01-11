-- nyu_notices 테이블에 저장된 실제 이미지 URL 확인

-- 1. content_blocks에서 이미지 URL 샘플 (최대 20개)
SELECT 
    id,
    title,
    block->>'uri' as image_url,
    CASE 
        WHEN block->>'uri' LIKE '%qgtwkhkmdsaypnsnrpbf%' THEN 'OLD URL (qgtwkhkmdsaypnsnrpbf)'
        WHEN block->>'uri' LIKE '%waumfxamhuvhsblehsuf%' THEN 'NEW URL (waumfxamhuvhsblehsuf)'
        WHEN block->>'uri' LIKE '%supabase.co%' THEN 'OTHER SUPABASE URL'
        WHEN block->>'uri' LIKE '/images/%' THEN 'RELATIVE PATH'
        WHEN block->>'uri' LIKE 'http%' THEN 'OTHER HTTP URL'
        ELSE 'UNKNOWN FORMAT'
    END as url_type,
    LENGTH(block->>'uri') as url_length
FROM nyu_notices, jsonb_array_elements(content_blocks::jsonb) AS block
WHERE block->>'type' = 'image' 
AND block->>'uri' IS NOT NULL
ORDER BY id DESC
LIMIT 20;

-- 2. images 배열에서 이미지 URL 샘플 (최대 20개)
SELECT 
    id,
    title,
    unnest(images) as image_url,
    CASE 
        WHEN unnest(images) LIKE '%qgtwkhkmdsaypnsnrpbf%' THEN 'OLD URL (qgtwkhkmdsaypnsnrpbf)'
        WHEN unnest(images) LIKE '%waumfxamhuvhsblehsuf%' THEN 'NEW URL (waumfxamhuvhsblehsuf)'
        WHEN unnest(images) LIKE '%supabase.co%' THEN 'OTHER SUPABASE URL'
        WHEN unnest(images) LIKE '/images/%' THEN 'RELATIVE PATH'
        WHEN unnest(images) LIKE 'http%' THEN 'OTHER HTTP URL'
        ELSE 'UNKNOWN FORMAT'
    END as url_type,
    LENGTH(unnest(images)) as url_length
FROM nyu_notices
WHERE images IS NOT NULL 
AND array_length(images, 1) > 0
ORDER BY id DESC
LIMIT 20;

-- 3. qgtwkhkmdsaypnsnrpbf가 포함된 URL 개수
SELECT 
    'content_blocks' as source,
    COUNT(*) as count_with_old_url
FROM nyu_notices, jsonb_array_elements(content_blocks::jsonb) AS block
WHERE block->>'uri' LIKE '%qgtwkhkmdsaypnsnrpbf%'

UNION ALL

SELECT 
    'images array' as source,
    COUNT(*) as count_with_old_url
FROM nyu_notices
WHERE EXISTS (
    SELECT 1 FROM unnest(images) AS img 
    WHERE img LIKE '%qgtwkhkmdsaypnsnrpbf%'
);

-- 4. 전체 이미지 URL 개수
SELECT 
    'content_blocks' as source,
    COUNT(*) as total_image_urls
FROM nyu_notices, jsonb_array_elements(content_blocks::jsonb) AS block
WHERE block->>'type' = 'image' 
AND block->>'uri' IS NOT NULL

UNION ALL

SELECT 
    'images array' as source,
    COUNT(*) as total_image_urls
FROM nyu_notices, unnest(images) AS img
WHERE images IS NOT NULL 
AND array_length(images, 1) > 0;

