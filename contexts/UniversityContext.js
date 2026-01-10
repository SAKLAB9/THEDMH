import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUniColors } from '../utils/uniColors';
import { useAppConfig } from './AppConfigContext';

const UniversityContext = createContext();

export const UniversityProvider = ({ children }) => {
  const { getColorConfig } = useAppConfig();
  const [university, setUniversity] = useState(null);
  const [colors, setColors] = useState(() => {
    const config = { getColorConfig };
    return getUniColors(null, config);
  });

  useEffect(() => {
    const loadUniversity = async () => {
      try {
        const savedUniversity = await AsyncStorage.getItem('currentUserUniversity');
        const config = { getColorConfig };
        if (savedUniversity && savedUniversity !== university) {
          // 값이 변경되었을 때만 업데이트
          const newColors = getUniColors(savedUniversity, config);
          setUniversity(savedUniversity);
          setColors(newColors);
        } else if (!savedUniversity && university !== null) {
          // 저장된 값이 없고 현재 값이 null이 아닐 때만 업데이트
          setUniversity(null);
          setColors(getUniColors(null, config));
        }
      } catch (error) {
        console.error('학교 정보 불러오기 오류:', error);
      }
    };

    // 초기 로드만 수행 (인터벌 제거 - updateUniversity에서 직접 업데이트하므로 불필요)
    loadUniversity();
  }, [getColorConfig]); // university를 dependency에서 제거하여 무한 루프 방지

  const updateUniversity = async (newUniversity) => {
    try {
      const config = { getColorConfig };
      if (newUniversity) {
        await AsyncStorage.setItem('currentUserUniversity', newUniversity);
        const newColors = getUniColors(newUniversity, config);
        setUniversity(newUniversity);
        setColors(newColors);
      } else {
        await AsyncStorage.removeItem('currentUserUniversity');
        setUniversity(null);
        setColors(getUniColors(null, config));
      }
    } catch (error) {
      console.error('학교 정보 저장 오류:', error);
    }
  };

  return (
    <UniversityContext.Provider value={{ university, colors, updateUniversity }}>
      {children}
    </UniversityContext.Provider>
  );
};

export const useUniversity = () => {
  const context = useContext(UniversityContext);
  if (!context) {
    throw new Error('useUniversity must be used within a UniversityProvider');
  }
  return context;
};

