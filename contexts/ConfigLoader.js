import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppConfig } from './AppConfigContext';
import { useUniversity } from './UniversityContext';

// 앱 시작 시 설정을 로드하는 컴포넌트
export const ConfigLoader = () => {
  const { loadConfig } = useAppConfig();
  const { university } = useUniversity();

  // 앱 시작 시 설정 로드 (한 번만 실행)
  useEffect(() => {
    const initializeConfig = async () => {
      // university가 있으면 해당 학교 설정 로드, 없으면 공통 설정만 로드
      const currentUniversity = university || await AsyncStorage.getItem('currentUserUniversity');
      // 앱 시작 시에는 강제 새로고침 (캐시 무시)
      await loadConfig(currentUniversity, true);
    };

    initializeConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 앱 시작 시에만 실행

  // university가 변경되면 설정 다시 로드 (캐시 사용)
  useEffect(() => {
    if (university) {
      loadConfig(university, false);
    }
  }, [university, loadConfig]);

  return null;
};

