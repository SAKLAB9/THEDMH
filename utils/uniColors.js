// 학교 정보에 따른 색상 가져오기
// 모든 색상은 config에서 가져옵니다.
export const getUniColors = (university, config = null) => {
  if (!config || !config.getColorConfig) {
    // config가 없으면 빈 객체 반환 (config는 항상 있어야 함)
    return {
      background: '',
      border: '',
      primary: '',
      buttonTextColor: '',
    };
  }
  
  if (!university) {
    // university가 없을 때는 config에서 MIUHub 기본 색상 가져오기
    return {
      background: config.getColorConfig('miuhub', 'primary_color'),
      border: config.getColorConfig('miuhub', 'border_color'),
      primary: config.getColorConfig('miuhub', 'primary_color'),
      buttonTextColor: config.getColorConfig('miuhub', 'button_text_color'),
    };
  }
  
  const universityLower = university.toLowerCase();
  
  // config에서 색상 가져오기
  return {
    background: config.getColorConfig(universityLower, 'primary_color'),
    border: config.getColorConfig(universityLower, 'border_color'),
    primary: config.getColorConfig(universityLower, 'primary_color'),
    buttonTextColor: config.getColorConfig(universityLower, 'button_text_color'),
  };
};

// 로그인 색상 설정
// 앱 아이콘의 주요 색상을 config에서 가져옵니다.
// config의 miuhub_primary_color와 miuhub_border_color 값을 수정하면 변경됩니다.
export const getLoginColors = (getConfig) => {
  const iconBackground = getConfig('miuhub_primary_color') || '#3b3c36';
  const iconBorder = getConfig('miuhub_border_color') || '#3b3c36';
  return {
    iconBackground, // 아이콘 배경색
    iconBorder,     // 아이콘 내부 테두리 색상
    get primary() {
      return this.iconBackground || '#3b3c36'; // primary는 iconBackground를 따라감, 없으면 기본값
    },
  };
};

