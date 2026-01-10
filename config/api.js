import { Platform } from 'react-native';

// API 기본 URL 설정
// 개발 환경: 웹은 localhost, 모바일은 컴퓨터의 로컬 IP 주소 사용
// 모바일과 컴퓨터가 같은 Wi-Fi에 연결되어 있어야 함

// 환경 변수에서 API URL을 가져올 수 있도록 설정
const getApiBaseUrl = () => {
  // 환경 변수가 설정되어 있으면 우선 사용
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // 프로덕션 환경
  if (!__DEV__) {
    return 'https://your-app-name.railway.app';
  }

  // 개발 환경
  // 환경 변수로 포트 설정 가능 (기본값: 3000, THE동문회 서버 포트)
  const devPort = process.env.EXPO_PUBLIC_SERVER_PORT || '3000';
  
  if (Platform.OS === 'web') {
    // 웹에서는 localhost 사용
    return `http://localhost:${devPort}`;
  } else {
    // 모바일에서는 IP 주소 사용
    // 주의: 실제 IP 주소로 변경해야 합니다
    // 터미널에서 'ipconfig' (Windows) 또는 'ifconfig' (Mac/Linux)로 확인
    return `http://192.168.10.102:${devPort}`;
  }
};

const API_BASE_URL = getApiBaseUrl();

// 서버 연결 테스트 함수
export const testServerConnection = async () => {
  try {
    // 타임아웃 설정 (5초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('서버 연결 테스트 실패:', error);
    return false;
  }
};

export default API_BASE_URL;

