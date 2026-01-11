import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Supabase 설정
// app.json의 extra 섹션 또는 환경 변수에서 가져옵니다
const SUPABASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';


// Supabase URL과 키가 유효한 경우에만 클라이언트 생성
let supabase = null;

if (SUPABASE_URL && SUPABASE_URL !== '' && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== '') {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (error) {
    console.error('[Supabase] 클라이언트 초기화 실패:', error);
    supabase = null;
  }
} else {
  if (__DEV__) {
    console.warn('[Supabase] URL 또는 Key가 설정되지 않았습니다.');
  }
}

export { supabase };

// 이메일에서 @ 앞부분만 추출하는 헬퍼 함수
export const getEmailPrefix = (email) => {
  if (!email) return '';
  const parts = email.split('@');
  return parts[0] || '';
};

