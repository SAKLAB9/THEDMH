// 학교별 카테고리 비밀번호
// 클라이언트 사이드에서는 university를 소문자로 변환하여 사용
// 서버 사이드와 동일한 로직 유지
// noticeTab1: config에서 가져온 notice_tab1 값 (총동문회 대신 사용)
export const getCategoryPassword = (university, category, noticeTab1 = null) => {
  // university를 소문자로 변환 (서버의 getUniversityPrefix와 동일한 로직)
  const universityLower = university?.toLowerCase()?.trim() || '';
  
  // Admin은 학교와 관계없이 동일
  if (category === 'Admin') {
    return 'admin911';
  }
  
  // notice_tab1 (총동문회) - config에서 가져온 탭 이름과 일치하면 chong1 사용
  // noticeTab1이 제공되면 그것을 사용, 없으면 '총동문회'로 fallback (하위 호환성)
  const tab1Category = noticeTab1 || '총동문회';
  if (category === tab1Category) {
    return `${universityLower}chong1`;
  }
  
  // Raffle
  if (category === 'Raffle') {
    return `${universityLower}raffle3`;
  }
  
  // notice_tab1이 아닌 모든 공지사항 카테고리는 notice2 사용
  // (카테고리 이름이 바뀔 수 있으므로 notice_tab1이 아니면 모두 notice2)
  // notice_tab1, notice_tab2, notice_tab3 등 모든 공지사항 카테고리
  return `${universityLower}notice2`;
};
