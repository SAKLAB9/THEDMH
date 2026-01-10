# Supabase 게시판 글 복사 가이드

## 방법 1: SQL 쿼리로 직접 복사 (추천)

Supabase 대시보드에서 **SQL Editor**를 열고 아래 쿼리를 사용하세요.

### 1. 게시판 (board_posts) 복사

```sql
-- 예: nyu_board_posts에서 cornell_board_posts로 복사
INSERT INTO cornell_board_posts 
  (title, content_blocks, text_content, images, category, nickname, author, url, views, report_count, created_at)
SELECT 
  title, 
  content_blocks, 
  text_content, 
  images, 
  category, 
  nickname, 
  author, 
  url, 
  0 as views,  -- 조회수 초기화
  0 as report_count,  -- 신고 수 초기화
  NOW() as created_at  -- 현재 시간으로 설정
FROM nyu_board_posts
WHERE id = 123;  -- 특정 글만 복사하려면 WHERE 조건 추가
```

**특정 조건으로 여러 글 복사:**
```sql
-- 카테고리가 '자유게시판'인 글들만 복사
INSERT INTO cornell_board_posts 
  (title, content_blocks, text_content, images, category, nickname, author, url, views, report_count, created_at)
SELECT 
  title, content_blocks, text_content, images, category, nickname, author, url, 
  0, 0, NOW()
FROM nyu_board_posts
WHERE category = '자유게시판';
```

### 2. 소모임 (circles) 복사

```sql
-- 예: nyu_circles에서 cornell_circles로 복사
INSERT INTO cornell_circles 
  (title, content_blocks, text_content, images, category, keywords, region, event_date, location, participants, fee, author, url, contact, account_number, views, report_count, is_closed, created_at)
SELECT 
  title, 
  content_blocks, 
  text_content, 
  images, 
  category, 
  keywords, 
  region, 
  event_date, 
  location, 
  participants, 
  fee, 
  author, 
  url, 
  contact, 
  account_number, 
  0 as views,
  0 as report_count,
  false as is_closed,
  NOW() as created_at
FROM nyu_circles
WHERE id = 123;  -- 특정 글만 복사
```

### 3. 공지사항 (notices) 복사

```sql
-- 예: nyu_notices에서 cornell_notices로 복사
INSERT INTO cornell_notices 
  (title, content_blocks, text_content, images, category, nickname, author, url)
SELECT 
  title, 
  content_blocks, 
  text_content, 
  images, 
  category, 
  nickname, 
  author, 
  url
FROM nyu_notices
WHERE id = 123;  -- 특정 글만 복사
```

### 4. 경조사 (life_events) 복사

```sql
-- 예: nyu_life_events에서 cornell_life_events로 복사
INSERT INTO cornell_life_events 
  (title, content_blocks, text_content, images, category, nickname, author, url, views, report_count, created_at)
SELECT 
  title, 
  content_blocks, 
  text_content, 
  images, 
  category, 
  nickname, 
  author, 
  url, 
  0 as views,
  0 as report_count,
  NOW() as created_at
FROM nyu_life_events
WHERE id = 123;  -- 특정 글만 복사
```

---

## 방법 2: CSV/SQL/JSON Export 후 Import

### Step 1: Export (원본 테이블에서)

1. Supabase 대시보드 → **Table Editor**
2. 원본 테이블 선택 (예: `nyu_board_posts`)
3. 복사할 행 선택 (체크박스)
4. 우클릭 또는 상단 메뉴에서 **Copy as CSV** 또는 **Copy as SQL** 선택
5. 클립보드에 복사됨

### Step 2: Import (대상 테이블로)

#### 방법 A: SQL로 Import
1. **SQL Editor** 열기
2. 복사한 SQL을 붙여넣기
3. 테이블 이름을 대상 테이블로 변경 (예: `nyu_board_posts` → `cornell_board_posts`)
4. `id` 컬럼 제거 (자동 증가이므로)
5. `created_at`을 `NOW()`로 변경 (선택사항)
6. **Run** 클릭

#### 방법 B: CSV로 Import
1. **Table Editor**에서 대상 테이블 선택 (예: `cornell_board_posts`)
2. 상단 메뉴에서 **Insert row** → **Import data from CSV**
3. CSV 데이터를 붙여넣기
4. 컬럼 매핑 확인
5. **Save** 클릭

**주의사항:**
- CSV import 시 `id` 컬럼은 제외해야 합니다 (자동 증가)
- `created_at` 같은 타임스탬프는 수동으로 조정해야 할 수 있습니다

---

## 방법 3: JSON Export 후 SQL 변환

1. **Copy as JSON** 선택
2. JSON 데이터를 SQL INSERT 문으로 변환
3. SQL Editor에서 실행

**JSON 예시:**
```json
{
  "id": 123,
  "title": "제목",
  "content_blocks": "[{\"type\":\"text\",\"content\":\"내용\"}]",
  ...
}
```

**변환된 SQL:**
```sql
INSERT INTO cornell_board_posts (title, content_blocks, ...)
VALUES ('제목', '[{"type":"text","content":"내용"}]', ...);
```

---

## 주의사항

1. **id는 자동 증가**: INSERT 시 `id` 컬럼을 제외하면 자동으로 새 ID가 생성됩니다.
2. **created_at 업데이트**: 원본 날짜를 유지하려면 `created_at`을 그대로 복사하고, 현재 시간으로 설정하려면 `NOW()` 사용
3. **조회수/신고수 초기화**: `views`, `report_count`는 보통 0으로 초기화
4. **이미지 URL**: 이미지는 Supabase Storage에 저장되어 있으므로 URL만 복사하면 됩니다.
5. **댓글은 별도 복사**: 댓글 테이블(`{university}_board_comments`, `{university}_circles_comments`)도 별도로 복사해야 합니다.

---

## 댓글도 함께 복사하기

게시글과 함께 댓글도 복사하려면:

```sql
-- 게시글 복사 후, 새로 생성된 ID를 확인
-- 예: 원본 게시글 ID가 123이고, 복사된 게시글 ID가 456인 경우

-- 댓글 복사 (board_comments)
INSERT INTO cornell_board_comments 
  (post_id, content, author, parent_id, created_at)
SELECT 
  456 as post_id,  -- 새 게시글 ID
  content, 
  author, 
  parent_id, 
  NOW() as created_at
FROM nyu_board_comments
WHERE post_id = 123;  -- 원본 게시글 ID
```

---

## 빠른 참조: 테이블 이름 패턴

- 게시판: `{university}_board_posts`
- 소모임: `{university}_circles`
- 공지사항: `{university}_notices`
- 경조사: `{university}_life_events`
- 게시판 댓글: `{university}_board_comments`
- 소모임 댓글: `{university}_circles_comments`

예: `nyu_board_posts`, `cornell_board_posts`, `usc_board_posts` 등

