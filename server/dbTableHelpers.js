/**
 * 데이터베이스 테이블 이름 헬퍼 함수
 * 학교별로 테이블 이름을 동적으로 결정
 */

/**
 * university 값을 테이블 이름 접두사로 변환
 * 클라이언트는 이미 소문자 코드를 보내지만, 혹시 모를 경우를 대비해 소문자로 변환
 * @param {string} university - 소문자 코드 (예: 'cornell', 'nyu')
 * @returns {string} - 소문자 코드 (예: 'cornell', 'nyu')
 */
function getUniversityPrefix(university) {
  if (!university) return null;
  
  // 이미 소문자 코드를 받지만, 혹시 모를 경우를 대비해 소문자로 변환
  const uniLower = university.toLowerCase().trim();
  
  // 빈 문자열이면 null 반환
  if (!uniLower) return null;
  
  return uniLower;
}

/**
 * university를 소문자 코드로 정규화하고 유효성 검증
 * 클라이언트는 이미 소문자 코드를 보내지만, 혹시 모를 경우를 대비해 정규화
 * @param {string} university - 소문자 코드 (또는 혹시 모를 대문자 포함 값)
 * @param {object} pool - PostgreSQL connection pool (선택사항, 유효성 검증용)
 * @returns {Promise<string|null>} - 소문자 코드 또는 null (유효하지 않으면)
 */
async function normalizeUniversityCode(university, pool = null) {
  if (!university) return null;
  
  // 이미 소문자 코드를 받지만, 혹시 모를 경우를 대비해 소문자로 변환
  const code = getUniversityPrefix(university);
  if (!code) return null;
  
  // pool이 제공되면 유효성 검증
  if (pool) {
    const isValid = await isValidUniversity(code, pool);
    if (!isValid) {
      console.warn(`유효하지 않은 university 코드: ${code}`);
      return null;
    }
  }
  
  return code;
}

/**
 * 데이터베이스에서 모든 학교 목록 가져오기
 * @param {object} pool - PostgreSQL connection pool
 * @returns {Promise<string[]>} - 학교 코드 배열 (소문자, 예: ['nyu', 'usc', 'cornell'])
 */
async function getAllUniversities(pool) {
  if (!pool) {
    console.warn('Database pool이 없어 학교 목록을 가져올 수 없습니다.');
    return [];
  }
  
  try {
    // key에서 학교 코드 추출
    const result = await pool.query(
      `SELECT DISTINCT key FROM app_config WHERE key IS NOT NULL ORDER BY key`
    );
    
    const universities = new Set();
    const excludePrefixes = ['select_uni_', 'app_', 'category_', 'partners_', 'login_'];
    
    result.rows.forEach(row => {
      const key = row.key;
      if (!key) return;
      
      // 제외할 접두사 확인
      const shouldExclude = excludePrefixes.some(prefix => key.startsWith(prefix));
      if (shouldExclude) return;
      
      // key에서 학교 코드 추출 (예: "cornell_primary_color" -> "cornell")
      const parts = key.split('_');
      if (parts.length >= 2) {
        const potentialUni = parts[0].toLowerCase();
        // miuhub는 포함, 일반적인 학교 코드 패턴 확인
        if (potentialUni && potentialUni.length > 0) {
          universities.add(potentialUni);
        }
      }
    });
    
    return Array.from(universities).sort();
  } catch (error) {
    console.error('학교 목록 조회 오류:', error);
    return [];
  }
}

/**
 * university가 유효한 학교인지 확인
 * @param {string} university - 확인할 학교 이름
 * @param {object} pool - PostgreSQL connection pool
 * @returns {Promise<boolean>} - 유효한 학교인지 여부
 */
async function isValidUniversity(university, pool) {
  if (!university || !pool) return false;
  
  const universities = await getAllUniversities(pool);
  const normalized = university.toLowerCase().trim();
  
  return universities.includes(normalized);
}

/**
 * 게시판 테이블 이름 가져오기
 */
function getBoardTableName(university) {
  const prefix = getUniversityPrefix(university);
  if (!prefix) return null;
  return `${prefix}_board_posts`;
}

/**
 * 소모임 테이블 이름 가져오기
 */
function getCirclesTableName(university) {
  const prefix = getUniversityPrefix(university);
  if (!prefix) return null;
  return `${prefix}_circles`;
}

/**
 * 공지사항 테이블 이름 가져오기
 */
function getNoticesTableName(university) {
  const prefix = getUniversityPrefix(university);
  if (!prefix) return null;
  return `${prefix}_notices`;
}

/**
 * 경조사 테이블 이름 가져오기
 */
function getLifeEventsTableName(university) {
  const prefix = getUniversityPrefix(university);
  if (!prefix) return null;
  return `${prefix}_life_events`;
}

/**
 * 게시판 댓글 테이블 이름 가져오기
 */
function getBoardCommentsTableName(university) {
  const prefix = getUniversityPrefix(university);
  if (!prefix) return null;
  return `${prefix}_board_comments`;
}

/**
 * 소모임 댓글 테이블 이름 가져오기
 */
function getCirclesCommentsTableName(university) {
  const prefix = getUniversityPrefix(university);
  if (!prefix) return null;
  return `${prefix}_circles_comments`;
}

/**
 * 추첨 테이블 이름 가져오기
 */
function getRafflesTableName(university) {
  const prefix = getUniversityPrefix(university);
  if (!prefix) return null;
  return `${prefix}_raffles`;
}

/**
 * Featured 테이블 이름 가져오기 (MIUHub만)
 */
function getFeaturedTableName(university) {
  const prefix = getUniversityPrefix(university);
  if (prefix === 'miuhub') {
    return 'miuhub_featured';
  }
  return null; // MIUHub가 아니면 null 반환
}

module.exports = {
  getUniversityPrefix,
  normalizeUniversityCode,
  getBoardTableName,
  getCirclesTableName,
  getNoticesTableName,
  getLifeEventsTableName,
  getBoardCommentsTableName,
  getCirclesCommentsTableName,
  getRafflesTableName,
  getFeaturedTableName,
  getAllUniversities,
  isValidUniversity
};


