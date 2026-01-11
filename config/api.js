import { Platform } from 'react-native';
import Constants from 'expo-constants';

// API 기본 URL 설정
// 개발 환경: 웹은 localhost, 모바일은 컴퓨터의 로컬 IP 주소 사용
// 모바일과 컴퓨터가 같은 Wi-Fi에 연결되어 있어야 함

// 환경 변수에서 API URL을 가져올 수 있도록 설정
// 모든 config와 이미지는 Supabase에서 직접 가져오므로, API_BASE_URL은 다른 서버 API 호출에만 사용
const getApiBaseUrl = () => {
  // app.json의 extra 섹션에서 가져오기 (우선순위 1)
  const apiUrlFromConfig = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL;
  if (apiUrlFromConfig) {
    return apiUrlFromConfig;
  }

  // process.env에서 가져오기 (우선순위 2)
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // 기본값: Vercel 배포 URL 사용 (THE동문회 서버)
  return 'https://thedmh.vercel.app';
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

