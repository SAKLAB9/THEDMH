import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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
  const loadingRef = useRef(false); // 중복 로딩 방지

  // 설정값 가져오기
  const loadConfig = useCallback(async (university, forceRefresh = false) => {
    // 이미 로딩 중이면 스킵
    if (loadingRef.current && !forceRefresh) {
      return;
    }

    loadingRef.current = true;

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
            loadingRef.current = false;
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
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`설정을 불러올 수 없습니다. Status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.config) {
        setConfig(result.config);
        setLastUpdated(Date.now());
        
        // 캐시에 저장
        await AsyncStorage.setItem('app_config', JSON.stringify(result.config));
        await AsyncStorage.setItem('app_config_updated', Date.now().toString());
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
      loadingRef.current = false;
    }
  }, []);

  // 초기 마운트 시 config 로드 (한 번만)
  useEffect(() => {
    if (!loadingRef.current) {
      loadConfig(null, false);
    }
  }, []);

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
