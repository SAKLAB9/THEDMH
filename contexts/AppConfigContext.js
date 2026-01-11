import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_BASE_URL from '../config/api';

const AppConfigContext = createContext();

export const useAppConfig = () => {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error('useAppConfig must be used within AppConfigProvider');
  }
  return context;
};

export const AppConfigProvider = ({ children }) => {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // 설정값 가져오기
  const loadConfig = useCallback(async (university, forceRefresh = false) => {
    try {
      // 캐시된 설정 확인 (강제 새로고침이 아니면)
      if (!forceRefresh) {
        const cachedConfig = await AsyncStorage.getItem('app_config');
        const cachedTime = await AsyncStorage.getItem('app_config_updated');
        
        if (cachedConfig && cachedTime) {
          const timeDiff = Date.now() - parseInt(cachedTime);
          // 5분 이내면 캐시 사용
          if (timeDiff < 5 * 60 * 1000) {
            const parsedConfig = JSON.parse(cachedConfig);
            setConfig(parsedConfig);
            setLastUpdated(parseInt(cachedTime));
            setLoading(false);
            return;
          }
        }
      }
      
      // 강제 새로고침이면 캐시 삭제
      if (forceRefresh) {
        await AsyncStorage.removeItem('app_config');
        await AsyncStorage.removeItem('app_config_updated');
      }

      // 서버에서 설정 가져오기
      const url = university 
        ? `${API_BASE_URL}/api/config?university=${encodeURIComponent(university.toLowerCase())}`
        : `${API_BASE_URL}/api/config`;
      
      console.log('[AppConfig] API 호출 URL:', url);
      console.log('[AppConfig] API_BASE_URL:', API_BASE_URL);
      
      const response = await fetch(url);
      
      console.log('[AppConfig] 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AppConfig] API 오류:', response.status, errorText);
        throw new Error(`설정을 불러올 수 없습니다. Status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[AppConfig] API 응답:', result);
      console.log('[AppConfig] config 키 개수:', result.config ? Object.keys(result.config).length : 0);
      
      if (result.success && result.config) {
        console.log('[AppConfig] config 저장:', Object.keys(result.config));
        setConfig(result.config);
        setLastUpdated(Date.now());
        
        // 캐시에 저장
        await AsyncStorage.setItem('app_config', JSON.stringify(result.config));
        await AsyncStorage.setItem('app_config_updated', Date.now().toString());
      } else {
        console.warn('[AppConfig] config가 비어있음:', result);
      }
    } catch (error) {
      // 실패 시 캐시된 설정 사용
      try {
        const cachedConfig = await AsyncStorage.getItem('app_config');
        if (cachedConfig) {
          setConfig(JSON.parse(cachedConfig));
        } else {
          // 캐시도 없으면 기본 설정 사용 (빈 객체)
          setConfig({});
        }
      } catch (cacheError) {
        setConfig({});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 마운트 시 config 로드
  useEffect(() => {
    loadConfig(null, false);
  }, [loadConfig]);

  // 설정값 가져오기 (헬퍼 함수)
  const getConfig = useCallback((key, defaultValue = '') => {
    const value = config[key] !== undefined ? config[key] : defaultValue;
    return value;
  }, [config]);

  // Boolean 설정값 가져오기
  const getConfigBool = useCallback((key, defaultValue = false) => {
    const value = config[key];
    if (value === undefined) return defaultValue;
    return value === 'true' || value === true;
  }, [config]);

  // Number 설정값 가져오기
  const getConfigNumber = useCallback((key, defaultValue = 0) => {
    const value = config[key];
    if (value === undefined) return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }, [config]);

  // 색상 설정값 가져오기 (학교별)
  const getColorConfig = useCallback((university, colorKey, defaultValue = '#000000') => {
    const universityLower = university?.toLowerCase() || '';
    const key = `${universityLower}_${colorKey}`;
    return getConfig(key, defaultValue);
  }, [getConfig]);

  return (
    <AppConfigContext.Provider
      value={{
        config,
        loading,
        lastUpdated,
        loadConfig,
        getConfig,
        getConfigBool,
        getConfigNumber,
        getColorConfig,
      }}
    >
      {children}
    </AppConfigContext.Provider>
  );
};
