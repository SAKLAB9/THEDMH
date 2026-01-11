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
      
      if (__DEV__) {
        console.log('[AppConfigContext] Config API 호출:', url);
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (__DEV__) {
          console.error('[AppConfigContext] API 응답 실패:', {
            status: response.status,
            statusText: response.statusText,
            errorText,
          });
        }
        throw new Error(`설정을 불러올 수 없습니다. Status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (__DEV__) {
        console.log('[AppConfigContext] API 응답:', {
          success: result.success,
          configKeys: result.config ? Object.keys(result.config).length : 0,
          hasConfig: !!result.config,
        });
      }
      
      if (result.success && result.config) {
        if (__DEV__) {
          const allKeys = Object.keys(result.config);
          const selectUniKeys = allKeys.filter(k => k.includes('select_uni'));
          const loginAdminKeys = allKeys.filter(k => k.includes('login_admin'));
          
          console.log('[AppConfigContext] Config 로드 성공:', {
            totalKeys: allKeys.length,
            selectUniKeys: selectUniKeys.length,
            loginAdminKeys: loginAdminKeys.length,
            selectUniKeysList: selectUniKeys,
            loginAdminKeysList: loginAdminKeys.slice(0, 5),
          });
          
          // select_uni_slot_1_image부터 4까지 직접 확인
          for (let i = 1; i <= 4; i++) {
            const key = `select_uni_slot_${i}_image`;
            const value = result.config[key];
            console.log(`[AppConfigContext] ${key}:`, {
              exists: key in result.config,
              value: value || '(undefined)',
              type: typeof value,
            });
          }
        }
        setConfig(result.config);
        setLastUpdated(Date.now());
        
        // 캐시에 저장
        await AsyncStorage.setItem('app_config', JSON.stringify(result.config));
        await AsyncStorage.setItem('app_config_updated', Date.now().toString());
      } else {
        if (__DEV__) {
          console.warn('[AppConfigContext] API 응답에 config가 없음:', result);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[AppConfigContext] Config 로드 실패:', error.message);
      }
      // 실패 시 캐시된 설정 사용
      try {
        const cachedConfig = await AsyncStorage.getItem('app_config');
        if (cachedConfig) {
          const parsed = JSON.parse(cachedConfig);
          if (__DEV__) {
            console.log('[AppConfigContext] 캐시된 config 사용:', {
              keys: Object.keys(parsed).length,
            });
          }
          setConfig(parsed);
        } else {
          if (__DEV__) {
            console.warn('[AppConfigContext] 캐시도 없음 - 빈 config 설정');
          }
          // 캐시도 없으면 기본 설정 사용 (빈 객체)
          setConfig({});
        }
      } catch (cacheError) {
        if (__DEV__) {
          console.error('[AppConfigContext] 캐시 파싱 실패:', cacheError.message);
        }
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
