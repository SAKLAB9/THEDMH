// 학교별 카테고리 비밀번호
// dbTableHelpers의 getUniversityPrefix를 사용하여 uni와 university 통일
const { getUniversityPrefix } = require('./dbTableHelpers');

// noticeTab1: app_config에서 가져온 notice_tab1 값 (총동문회 대신 사용)
const getCategoryPassword = (university, category, noticeTab1 = null) => {
  // getUniversityPrefix를 사용하여 uni와 university 통일
  // null이면 빈 문자열로 처리
  const uni = getUniversityPrefix(university) || '';
  
  // Admin은 학교와 관계없이 동일
  if (category === 'Admin') {
    return 'admin911';
  }
  
  // notice_tab1 (총동문회) - config에서 가져온 탭 이름과 일치하면 chong1 사용
  // noticeTab1이 제공되면 그것을 사용, 없으면 '총동문회'로 fallback (하위 호환성)
  const tab1Category = noticeTab1 || '총동문회';
  if (category === tab1Category) {
    return `${uni}chong1`;
  }
  
  // Raffle
  if (category === 'Raffle') {
    return `${uni}raffle3`;
  }
  
  // notice_tab1이 아닌 모든 공지사항 카테고리는 notice2 사용
  // (카테고리 이름이 바뀔 수 있으므로 notice_tab1이 아니면 모두 notice2)
  // notice_tab1, notice_tab2, notice_tab3 등 모든 공지사항 카테고리
  return `${uni}notice2`;
};

module.exports = { getCategoryPassword };

