-- 실제 데이터베이스에 저장된 URL 형식 확인

-- 1. nyu_notices 테이블의 images 배열에서 실제 URL 샘플 확인
SELECT 
    'nyu_notices' as table_name,
    id,
    images[1] as first_image_url,
    CASE 
        WHEN images[1] LIKE '%qgtwkhkmdsaypnsnrpbf%' THEN 'OLD URL 포함'
        WHEN images[1] LIKE '%waumfxamhuvhsblehsuf%' THEN 'NEW URL 포함'
        WHEN images[1] LIKE '%supabase.co%' THEN 'OTHER SUPABASE'
        ELSE 'NOT SUPABASE'
    END as url_type
FROM nyu_notices
WHERE images IS NOT NULL 
AND array_length(images, 1) > 0
LIMIT 10;

-- 2. qgtwkhkmdsaypnsnrpbf가 포함된 URL이 실제로 있는지 확인
SELECT 
    'nyu_notices' as table_name,
    COUNT(*) as total_rows_with_images,
    COUNT(*) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM unnest(images) AS img 
            WHERE img LIKE '%qgtwkhkmdsaypnsnrpbf%'
        )
    ) as rows_with_old_url
FROM nyu_notices
WHERE images IS NOT NULL 
AND array_length(images, 1) > 0;

-- 3. 실제 URL 샘플 (qgtwkhkmdsaypnsnrpbf 포함)
SELECT 
    'nyu_notices' as table_name,
    id,
    unnest(images) as image_url
FROM nyu_notices
WHERE EXISTS (
    SELECT 1 FROM unnest(images) AS img 
    WHERE img LIKE '%qgtwkhkmdsaypnsnrpbf%'
)
LIMIT 5;

