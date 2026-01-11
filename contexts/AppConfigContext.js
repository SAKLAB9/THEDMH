import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

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
    setLoading(true);

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

      // Supabase에서 직접 설정 가져오기
      if (!supabase) {
        throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
      }
      
      // app_config 테이블에서 모든 설정 가져오기
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value');
      
      if (error) {
        throw new Error(`설정을 불러올 수 없습니다: ${error.message}`);
      }
      
      if (data && data.length > 0) {
        // config 객체 생성
        const configObj = {};
        data.forEach(row => {
          configObj[row.key] = row.value;
        });
        
        setConfig(configObj);
        setLastUpdated(Date.now());
        
        // 캐시에 저장
        await AsyncStorage.setItem('app_config', JSON.stringify(configObj));
        await AsyncStorage.setItem('app_config_updated', Date.now().toString());
      } else {
        setConfig({});
      }
    } catch (error) {
      // 실패 시 캐시된 설정 사용
      try {
        const cachedConfig = await AsyncStorage.getItem('app_config');
        if (cachedConfig) {
          const parsed = JSON.parse(cachedConfig);
          setConfig(parsed);
        } else {
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
