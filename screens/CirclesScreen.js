import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, TextInput, Alert, Modal, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useUniversity } from '../contexts/UniversityContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { getUniColors } from '../utils/uniColors';
import GlobalPopup from '../components/GlobalPopup';
import { getEmailPrefix } from '../config/supabase';

export default function CirclesScreen({ navigation, route }) {
  const { university } = useUniversity();
  const { getConfig, getConfigNumber, getColorConfig, config: appConfig, loadConfig } = useAppConfig();
  const config = { getColorConfig };
  
  // selectedChannel에 따라 색상 결정
  // route.params에서 selectedChannel을 받으면 그것을 사용, 없으면 university 사용
  const [selectedChannel, setSelectedChannel] = useState(
    route?.params?.selectedChannel || university || null
  );
  
  // university가 변경되면 selectedChannel도 업데이트 (route.params.selectedChannel이 없을 때만)
  useEffect(() => {
    if (!route?.params?.selectedChannel && university) {
      setSelectedChannel(university);
    } else if (!route?.params?.selectedChannel && !university) {
      setSelectedChannel(null);
    }
  }, [university, route?.params?.selectedChannel]);
  
  // selectedChannel에 따라 대학 색상 가져오기 (MIUHub도 포함)
  // admin으로 학교 변경 시 university를 우선 사용하여 즉시 반영되도록 함
  const targetUniversity = useMemo(() => {
    if (selectedChannel === 'MIUHub') return 'miuhub';
    // selectedChannel이 university와 다르면 university를 우선 사용 (admin으로 학교 변경 시)
    if (university && selectedChannel !== university) {
      return university;
    }
    return selectedChannel || university || null;
  }, [selectedChannel, university]);
  
  const uniColors = useMemo(() => getUniColors(targetUniversity, config), [targetUniversity, getColorConfig, appConfig]);
  
  const colors = useMemo(() => ({
    primary: uniColors.primary,
    buttonTextColor: uniColors.buttonTextColor,
  }), [uniColors]);
  const [activeTab, setActiveTab] = useState('전체');
  const tabs = useMemo(() => {
    const tabs = ['전체'];
    const tab1 = getConfig('circles_tab1');
    const tab2 = getConfig('circles_tab2');
    const tab3 = getConfig('circles_tab3');
    const tab4 = getConfig('circles_tab4');
    if (tab1) tabs.push(tab1);
    if (tab2) tabs.push(tab2);
    if (tab3) tabs.push(tab3);
    if (tab4) tabs.push(tab4);
    return tabs;
  }, [getConfig, appConfig]);
  
  const [pageByTab, setPageByTab] = useState({});
  
  // pageByTab 초기화 및 업데이트 (tabs가 변경될 때)
  useEffect(() => {
    setPageByTab(prev => {
      const newPageByTab = { ...prev };
      tabs.forEach(tab => {
        if (!(tab in newPageByTab)) {
          newPageByTab[tab] = 1;
        }
      });
      return newPageByTab;
    });
    
    // activeTab이 더 이상 유효하지 않으면 '전체'로 리셋
    setActiveTab(prevTab => {
      if (!tabs.includes(prevTab)) {
        return '전체';
      }
      return prevTab;
    });
  }, [tabs]);
  const itemsPerPage = getConfigNumber('circles_items_per_page', 6); // 2열 그리드이므로 6개씩 (3행 x 2열)
  const [savedCircles, setSavedCircles] = useState([]);
  const [favoriteCircles, setFavoriteCircles] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [featured, setFeatured] = useState([]);
  
  // 필터링 상태
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [keywordSearch, setKeywordSearch] = useState('');
  const [excludeClosed, setExcludeClosed] = useState(false);
  const [sortBy, setSortBy] = useState('newest'); // 'newest' 또는 'eventDate'
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showPartnersModal, setShowPartnersModal] = useState(false);
  
  // Partners 모달 자동 닫기 타이머
  const partnersAutoCloseSeconds = getConfigNumber('partners_modal_auto_close_seconds', 1) * 1000;
  useEffect(() => {
    let timer;
    if (showPartnersModal) {
      timer = setTimeout(() => {
        setShowPartnersModal(false);
        // 모달이 닫힐 때는 이미 MIUHub 탭에 있으므로 상태 변경 불필요
      }, partnersAutoCloseSeconds);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [showPartnersModal, partnersAutoCloseSeconds]);

  // Partners 모달 설정 (MIUHub 전용) - SelectUniScreen의 설정 재사용
  const miuhubColors = getUniColors('miuhub', config);
  // SelectUniScreen의 슬롯 설정 재사용
  const slotsCount = getConfigNumber('select_uni_slots_count', 4);
  const slotWidth = 100;
  const slotHeight = 100;
  const slotGap = 24;
  const slotBorderWidth = 2;
  const slotBorderColor = '#d1d5db';
  const slotBorderStyle = 'dashed';
  const slotBackgroundColor = '#f9fafb';
  const slotBorderRadius = 20;
  const modalPaddingTop = 48;
  const modalPaddingBottom = 48;
  const modalPaddingLeft = 24;
  const modalPaddingRight = 24;
  const modalWidthPercent = 90;
  const modalMaxWidth = 400;

  // Partners 모달 이미지 URL 캐시
  const [partnersImageUrls, setPartnersImageUrls] = useState({});

  // 슬롯 이미지 파일명들 가져오기 (의존성 배열용) - useMemo로 메모이제이션
  const partnersSlotImageNames = useMemo(() => {
    const names = [];
    for (let i = 1; i <= slotsCount; i++) {
      names.push(getConfig(`select_uni_slot_${i}`, ''));
    }
    return names;
  }, [slotsCount, appConfig, getConfig]);

  // 슬롯 이미지 파일명들을 문자열로 변환 (의존성 배열용)
  const partnersSlotImageNamesString = useMemo(() => {
    return partnersSlotImageNames.join(',');
  }, [partnersSlotImageNames]);

  // Supabase Storage에서 Partners 모달 이미지 URL 가져오기 (SelectUniScreen과 동일한 방식 - 캐싱 적용)
  useEffect(() => {
    if (slotsCount <= 0) return;
    
    const loadPartnersImageUrls = async () => {
      if (!supabase) {
        setPartnersImageUrls({});
        return;
      }
      
      // 모든 이미지 파일명 수집
      const imageNames = [];
      const slotNumbers = [];
      for (let i = 1; i <= slotsCount; i++) {
        const imageName = getConfig(`select_uni_slot_${i}`, '');
        if (imageName && imageName.trim() !== '') {
          imageNames.push(imageName);
          slotNumbers.push(i);
        }
      }
      
      if (imageNames.length === 0) {
        setPartnersImageUrls({});
        return;
      }
      
      // 캐시에서 병렬로 확인 (만료 시간: 24시간)
      const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24시간
      const cacheKeys = imageNames.map((imageName, index) => ({
        imageName,
        slotNumber: slotNumbers[index],
        cacheKey: `select_uni_slot_${slotNumbers[index]}_url_${imageName}`,
        timestampKey: `select_uni_slot_${slotNumbers[index]}_url_${imageName}_timestamp`
      }));
      
      const cachePromises = cacheKeys.map(({ cacheKey }) => AsyncStorage.getItem(cacheKey));
      const timestampPromises = cacheKeys.map(({ timestampKey }) => AsyncStorage.getItem(timestampKey));
      const [cachedResults, timestampResults] = await Promise.all([
        Promise.all(cachePromises),
        Promise.all(timestampPromises)
      ]);
      
      const urls = {};
      const toLoadFromSupabase = [];
      const expiredCacheKeys = [];
      
      // 캐시된 URL과 새로 로드할 이미지 분리
      cacheKeys.forEach(({ imageName, cacheKey, timestampKey, slotNumber }, index) => {
        const cachedUrl = cachedResults[index];
        const cachedTimestamp = timestampResults[index];
        
        if (cachedUrl && cachedTimestamp) {
          const cacheAge = Date.now() - parseInt(cachedTimestamp, 10);
          if (cacheAge < CACHE_EXPIRY_MS) {
            // 캐시가 유효함
            urls[imageName] = { uri: cachedUrl };
          } else {
            // 캐시가 만료됨
            expiredCacheKeys.push({ cacheKey, timestampKey });
            toLoadFromSupabase.push({ imageName, slotNumber });
          }
        } else {
          toLoadFromSupabase.push({ imageName, slotNumber });
        }
      });
      
      // 만료된 캐시 삭제
      if (expiredCacheKeys.length > 0) {
        await Promise.all([
          ...expiredCacheKeys.map(({ cacheKey }) => AsyncStorage.removeItem(cacheKey)),
          ...expiredCacheKeys.map(({ timestampKey }) => AsyncStorage.removeItem(timestampKey))
        ]);
      }
      
      // Supabase Storage에서 직접 이미지 URL 가져오기 (동기적으로 빠르게 생성)
      // 캐시 버스팅을 위해 타임스탬프 추가
      const currentTimestamp = Date.now();
      toLoadFromSupabase.forEach(({ imageName }) => {
        const trimmedName = String(imageName).trim();
        if (trimmedName) {
          const filePath = `assets/${trimmedName}`;
          const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);
          if (urlData?.publicUrl) {
            // 쿼리 파라미터로 캐시 버스팅 (브라우저/앱 레벨 캐시 무효화)
            urls[trimmedName] = { uri: `${urlData.publicUrl}?v=${currentTimestamp}` };
          }
        }
      });
      
      // 새로 로드한 URL들을 캐시에 저장 (병렬로, 타임스탬프와 함께)
      const savePromises = toLoadFromSupabase.map(({ imageName, slotNumber }) => {
        if (urls[imageName]) {
          const cacheKey = `select_uni_slot_${slotNumber}_url_${imageName}`;
          const timestampKey = `${cacheKey}_timestamp`;
          return Promise.all([
            AsyncStorage.setItem(cacheKey, urls[imageName].uri),
            AsyncStorage.setItem(timestampKey, Date.now().toString())
          ]);
        }
        return Promise.resolve();
      });
      await Promise.all(savePromises);
      
      setPartnersImageUrls(urls);
    };
    
    loadPartnersImageUrls();
  }, [slotsCount, partnersSlotImageNamesString, getConfig]);

  // Partners 모달 슬롯 이미지 배열 생성 (모두 Supabase Storage에서 로드)
  const slotImages = [];
  for (let i = 1; i <= slotsCount; i++) {
    const imageName = getConfig(`select_uni_slot_${i}`, '');
    if (imageName) {
      slotImages.push(partnersImageUrls[imageName] || null);
    } else {
      slotImages.push(null);
    }
  }

  // Partners 모달 높이 계산 (SelectUniScreen과 동일한 로직)
  const calculatePartnersModalHeight = () => {
    const rows = Math.ceil(slotsCount / 3); // 3열 그리드 (SelectUniScreen과 동일)
    const slotsHeight = rows * slotHeight + (rows - 1) * slotGap;
    return slotsHeight + modalPaddingTop + modalPaddingBottom + 100; // 타이틀과 여백 포함 (SelectUniScreen과 동일)
  };
  
  const regions = [
    '전체',
    '서울',
    '경기',
    '인천',
    '부산',
    '대구',
    '광주',
    '대전',
    '울산',
    '세종',
    '강원',
    '충북',
    '충남',
    '전북',
    '전남',
    '경북',
    '경남',
    '제주'
  ];

  // 장소에서 상호명만 추출 (콤마 앞부분만)
  const getPlaceNameOnly = (location) => {
    if (!location) return '';
    // 콤마가 있으면 콤마 앞부분만, 없으면 전체 반환
    const commaIndex = location.indexOf(',');
    return commaIndex > 0 ? location.substring(0, commaIndex).trim() : location.trim();
  };

  // 작성날짜 포맷 함수 (created_at용)
  const formatCreatedDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return '';
    }
  };

  // Android용 폰트 크기 계산 (텍스트 길이 기반)
  const calculateFontSize = (text, maxLength = 50) => {
    if (!text) return 16;
    const length = text.length;
    if (length <= 20) return 16;
    if (length <= 30) return 15;
    if (length <= 40) return 14;
    if (length <= 50) return 13;
    if (length <= 60) return 12;
    return Math.max(10, 16 - (length - 20) * 0.15);
  };

  // API 서버에서 Circles 불러오기

  // 토스트 메시지 표시
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 2000);
  };

  // 관심리스트 토글
  const toggleFavorite = async (circleId, event) => {
    event.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const userId = await AsyncStorage.getItem('currentUserId') || 'guest';
      // selectedChannel에 따라 다른 storage key 사용
      const storageKey = selectedChannel === 'MIUHub' 
        ? `favoriteCircles_miuhub_${userId}`
        : `favoriteCircles_${userId}`;
      
      const favorites = await AsyncStorage.getItem(storageKey);
      let favoriteList = favorites ? JSON.parse(favorites) : [];
      const circleIdNum = parseInt(circleId);

      if (favoriteList.includes(circleIdNum)) {
        favoriteList = favoriteList.filter(id => id !== circleIdNum);
        showToast('관심리스트에서 제거되었습니다.');
      } else {
        if (!favoriteList.includes(circleIdNum)) {
          favoriteList.push(circleIdNum);
        }
        showToast('관심리스트에 추가되었습니다.');
      }
      await AsyncStorage.setItem(storageKey, JSON.stringify(favoriteList));
      setFavoriteCircles(favoriteList);
    } catch (error) {
      showToast('오류가 발생했습니다.');
    }
  };

  // Circles 데이터 로드 함수
  const loadCirclesData = React.useCallback(async () => {
      // selectedChannel이 MIUHub이면 miuhub 테이블 사용, 아니면 university 사용
      const targetUni = selectedChannel === 'MIUHub' ? 'miuhub' : (university || null);
      
      if (!targetUni || !targetUni.trim()) {
        setSavedCircles([]);
        return;
      }

      try {
        const universityCode = targetUni.toLowerCase();
        
        const circlesResponse = await fetch(`${API_BASE_URL}/api/circles?university=${encodeURIComponent(universityCode)}`);
        if (circlesResponse.ok) {
          const circlesData = await circlesResponse.json();
          if (circlesData.success && circlesData.circles) {
            setSavedCircles(circlesData.circles);
          } else {
            if (__DEV__) {
              console.error('[CirclesScreen] 소모임 데이터 형식 오류:', circlesData);
            }
            setSavedCircles([]);
          }
        } else {
          if (__DEV__) {
            console.error(`[CirclesScreen] 소모임 로드 실패: ${circlesResponse.status} ${circlesResponse.statusText}`, {
              url: `${API_BASE_URL}/api/circles?university=${encodeURIComponent(universityCode)}`,
              university: targetUni,
              universityCode,
              API_BASE_URL
            });
          }
          setSavedCircles([]);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[CirclesScreen] 소모임 로드 오류:', error, {
            university: targetUni,
            universityCode: targetUni ? targetUni.toLowerCase() : null,
            API_BASE_URL
          });
        }
        setSavedCircles([]);
      }
  }, [university, selectedChannel]);

  // university 또는 selectedChannel이 변경될 때마다 Circles 데이터 불러오기
  useEffect(() => {
    loadCirclesData();
  }, [loadCirclesData]);

  // Featured 데이터 로드 함수
  const loadFeaturedData = React.useCallback(async () => {
    if (selectedChannel !== 'MIUHub') {
      setFeatured([]);
      return;
    }

    try {
      const featuredResponse = await fetch(`${API_BASE_URL}/api/featured?university=miuhub&type=circle`);
      if (featuredResponse.ok) {
        const featuredData = await featuredResponse.json();
        if (featuredData.success && featuredData.featured) {
          setFeatured(featuredData.featured);
        } else {
          setFeatured([]);
        }
      } else {
        setFeatured([]);
      }
    } catch (error) {
      setFeatured([]);
    }
  }, [selectedChannel]);

  // selectedChannel이 변경될 때마다 Featured 데이터 불러오기
  useEffect(() => {
    loadFeaturedData();
  }, [loadFeaturedData]);

  // 관심리스트 로드 함수
  const loadFavoriteCircles = React.useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem('currentUserId') || 'guest';
      const storageKey = selectedChannel === 'MIUHub' 
        ? `favoriteCircles_miuhub_${userId}`
        : `favoriteCircles_${userId}`;
      
      const favorites = await AsyncStorage.getItem(storageKey);
      if (favorites) {
        const favoriteList = JSON.parse(favorites);
        setFavoriteCircles(favoriteList);
      } else {
        setFavoriteCircles([]);
      }
    } catch (error) {
      setFavoriteCircles([]);
    }
  }, [selectedChannel]);

  // selectedChannel이 변경될 때마다 관심리스트 로드
  useEffect(() => {
    loadFavoriteCircles();
  }, [loadFavoriteCircles]);

  // 화면이 포커스될 때마다 route.params에서 selectedChannel 업데이트 및 데이터 새로고침
  const intervalRef = useRef(null);
  
  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      
      // 화면 포커스 시 config 새로고침 (캐시 무시)
      // university를 직접 사용하여 admin으로 학교 변경 시 즉시 반영되도록 함
      if (university) {
        loadConfig(university, true);
      } else {
        loadConfig(null, true);
      }
      
      const refreshData = async () => {
      // route.params에서 selectedChannel이 전달되었을 때만 업데이트
        let currentChannel = selectedChannel; // 현재 상태를 기본값으로 사용
      if (route?.params?.selectedChannel) {
        setSelectedChannel(route.params.selectedChannel);
          currentChannel = route.params.selectedChannel; // 업데이트된 값 사용
        }
        
        // currentChannel에 따라 targetUni 결정
        const targetUni = currentChannel === 'MIUHub' ? 'miuhub' : (university || null);
        
        if (!targetUni) {
          if (isMounted) {
            setSavedCircles([]);
          }
          return;
        }

        try {
          const universityCode = targetUni.toLowerCase();
          
          const circlesResponse = await fetch(`${API_BASE_URL}/api/circles?university=${encodeURIComponent(universityCode)}`);
          if (circlesResponse.ok && isMounted) {
            const circlesData = await circlesResponse.json();
            if (circlesData.success && circlesData.circles) {
              setSavedCircles(circlesData.circles);
            } else {
              setSavedCircles([]);
            }
          } else if (isMounted) {
            setSavedCircles([]);
          }
        } catch (error) {
          if (isMounted) {
            setSavedCircles([]);
          }
        }
        
        // 관심리스트 다시 로드
        try {
          const userId = await AsyncStorage.getItem('currentUserId') || 'guest';
          const storageKey = currentChannel === 'MIUHub' 
            ? `favoriteCircles_miuhub_${userId}`
            : `favoriteCircles_${userId}`;
          
          const favorites = await AsyncStorage.getItem(storageKey);
          if (isMounted) {
            if (favorites) {
              const favoriteList = JSON.parse(favorites);
              setFavoriteCircles(favoriteList);
            } else {
              setFavoriteCircles([]);
            }
          }
        } catch (error) {
          if (isMounted) {
            setFavoriteCircles([]);
          }
        }
      };
      
      // 즉시 새로고침
      refreshData();
      
      // 2분(120초)마다 자동 새로고침 (새 글 확인)
      intervalRef.current = setInterval(() => {
        refreshData();
      }, 2 * 60 * 1000); // 2분마다
      
      return () => {
        isMounted = false;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [route?.params?.selectedChannel, university, loadConfig])
  );

  // API에서 불러온 Circles만 사용
  const allCircles = savedCircles;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handlePageChange = (newPage) => {
    setPageByTab(prev => ({
      ...prev,
      [activeTab]: newPage,
    }));
  };

  // 필터링 및 정렬 로직 (useMemo로 변경하여 activeTab 변경 시 즉시 재계산)
  const filteredCircles = useMemo(() => {
    let filtered = activeTab === '전체' 
    ? allCircles 
    : allCircles.filter(circle => circle.category === activeTab);
    
    // 관심리스트 필터
    if (showFavoritesOnly) {
      filtered = filtered.filter(circle => favoriteCircles.includes(parseInt(circle.id)));
    }
    
    // 지역 필터
    if (selectedRegion !== '전체') {
      filtered = filtered.filter(circle => circle.region === selectedRegion);
    }
    
    // 키워드 검색 (# 포함)
    if (keywordSearch.trim()) {
      // 입력란에 #이 고정으로 표시되므로, 검색 시 #을 앞에 붙여서 검색
      const searchTerm = '#' + keywordSearch.trim().toLowerCase();
      filtered = filtered.filter(circle => {
        if (!circle.keywords) return false;
        const keywordsLower = circle.keywords.toLowerCase();
        return keywordsLower.includes(searchTerm);
      });
    }
    
    // 마감 제외
    if (excludeClosed) {
      filtered = filtered.filter(circle => !circle.isClosed);
    }
    
    // 정렬
    if (sortBy === 'newest') {
      // 최신순: created_at 기준, 최신이 위로
      filtered.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // 최신순
      });
    } else if (sortBy === 'eventDate') {
      // 임박순: eventDate 기준, 최신(가까운 날짜)이 위로
      filtered.sort((a, b) => {
        const isDateUndecided = (circle) => {
          return !circle.eventDate || 
                 circle.eventDate === '날짜미정' || 
                 circle.eventDate.includes('날짜미정');
        };
        
        const aIsUndecided = isDateUndecided(a);
        const bIsUndecided = isDateUndecided(b);
        
        // 날짜미정인 것들은 맨 앞에
        if (aIsUndecided && bIsUndecided) {
          // 둘 다 날짜미정이면 created_at 기준으로 최신이 위로
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }
        if (aIsUndecided) return -1; // a가 날짜미정이면 앞으로
        if (bIsUndecided) return 1;  // b가 날짜미정이면 앞으로
        
        // 둘 다 날짜가 정해진 경우: 현재 날짜 기준으로 가장 가까운 순서대로
        try {
          const now = Date.now();
          
          // eventDate 파싱 함수
          const parseEventDate = (eventDateStr) => {
            if (!eventDateStr) return null;
            
            // "시간미정"이 포함된 경우 날짜 부분만 추출
            if (eventDateStr.includes('시간미정') && !eventDateStr.includes('날짜미정')) {
              let datePart = eventDateStr.replace(' 시간미정', '').trim();
              
              // ISO 형식인 경우 (예: "2025-12-31 시간미정")
              if (datePart.match(/^\d{4}-\d{2}-\d{2}/)) {
                const date = new Date(datePart);
                return isNaN(date.getTime()) ? null : date.getTime();
              }
              
              // "2025. 12. 31." 형식을 파싱
              const dateMatch = datePart.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
              if (dateMatch) {
                const year = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]) - 1;
                const day = parseInt(dateMatch[3]);
                const date = new Date(year, month, day);
                return isNaN(date.getTime()) ? null : date.getTime();
              }
              
              // 다른 형식 시도
              const date = new Date(datePart.replace(/\./g, '/'));
              return isNaN(date.getTime()) ? null : date.getTime();
            }
            
            // ISO 형식인 경우 (예: "2025-12-22T10:00:00.000Z")
            if (eventDateStr.includes('T') || eventDateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
              const date = new Date(eventDateStr);
              return isNaN(date.getTime()) ? null : date.getTime();
            }
            
            // 일반 형식 시도
            const date = new Date(eventDateStr);
            return isNaN(date.getTime()) ? null : date.getTime();
          };
          
          const dateA = parseEventDate(a.eventDate);
          const dateB = parseEventDate(b.eventDate);
          
          if (!dateA || !dateB) {
            // 파싱 실패 시 created_at 기준
            const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
          }
          
          const aIsFuture = dateA >= now;
          const bIsFuture = dateB >= now;
          
          // 미래 날짜가 과거 날짜보다 우선
          if (aIsFuture && !bIsFuture) return -1; // a가 미래, b가 과거면 a가 앞으로
          if (!aIsFuture && bIsFuture) return 1;  // a가 과거, b가 미래면 b가 앞으로
          
          // 둘 다 미래이거나 둘 다 과거인 경우
          if (aIsFuture && bIsFuture) {
            // 둘 다 미래: 가까운 날짜가 위로 (오름차순)
            return dateA - dateB;
          } else {
            // 둘 다 과거: 먼 과거가 뒤로 (최근 과거가 앞으로, 내림차순)
            return dateB - dateA;
          }
        } catch {
          // 에러 발생 시 created_at 기준
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }
      });
    }
    
    return filtered;
  }, [allCircles, activeTab, selectedRegion, keywordSearch, excludeClosed, sortBy, showFavoritesOnly, favoriteCircles]);

  // MIUHub일 때 Featured로 사용될 circle ID 수집 (페이지네이션 전에 제외하기 위해)
  let featuredContentIds = new Set();
  if (selectedChannel === 'MIUHub' && featured.length > 0) {
    const now = new Date();
    const activeFeatured = featured.filter(featuredItem => {
      if (!featuredItem.startDate || !featuredItem.endDate) return false;
      const start = new Date(featuredItem.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(featuredItem.endDate);
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    });
    
    activeFeatured.forEach(featuredItem => {
      const currentPage = pageByTab[activeTab] || 1;
      // 현재 페이지와 탭에 해당하는 Featured만 수집
      if ((featuredItem.categoryPage === currentPage && featuredItem.category === activeTab) || 
          (featuredItem.allPage === currentPage)) {
        featuredContentIds.add(featuredItem.contentId);
      }
    });
  }
  
  // Featured로 사용될 circle을 제외하고 페이지네이션
  const circlesWithoutFeatured = filteredCircles.filter(c => !featuredContentIds.has(c.id));
  const currentPage = pageByTab[activeTab] || 1;
  const totalPages = Math.ceil(circlesWithoutFeatured.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  let circles = circlesWithoutFeatured.slice(startIndex, endIndex);
  
  // MIUHub일 때 Featured 삽입
  if (selectedChannel === 'MIUHub' && featured.length > 0) {
    const now = new Date();
    const activeFeatured = featured.filter(featuredItem => {
      if (!featuredItem.startDate || !featuredItem.endDate) return false;
      const start = new Date(featuredItem.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(featuredItem.endDate);
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    });
    
    // 삽입할 Featured들을 위치별로 정렬 (위치가 큰 것부터 삽입하여 인덱스 변화 방지)
    const featuredToInsert = [];
    activeFeatured.forEach(featuredItem => {
      // 카테고리 페이지 Featured
      if (featuredItem.categoryPage && featuredItem.categoryPage === currentPage && featuredItem.categoryPosition && featuredItem.category === activeTab) {
        const position = featuredItem.categoryPosition - 1; // 1-based to 0-based
        if (position >= 0) {
          const featuredCircle = allCircles.find(c => c.id === featuredItem.contentId);
          if (featuredCircle) {
            featuredToInsert.push({ position, circle: { ...featuredCircle, isAd: true, adId: `featured-${featuredItem.id}` } });
          }
        }
      }
      // 전체 페이지 Featured
      if (featuredItem.allPage && featuredItem.allPage === currentPage && featuredItem.allPosition) {
        const position = featuredItem.allPosition - 1; // 1-based to 0-based
        if (position >= 0) {
          const featuredCircle = allCircles.find(c => c.id === featuredItem.contentId);
          if (featuredCircle) {
            featuredToInsert.push({ position, circle: { ...featuredCircle, isAd: true, adId: `featured-${featuredItem.id}` } });
          }
        }
      }
    });
    
    // 위치가 큰 것부터 삽입 (인덱스 변화 방지)
    featuredToInsert.sort((a, b) => b.position - a.position);
    featuredToInsert.forEach(({ position, circle }) => {
      if (position <= circles.length) {
        circles.splice(position, 0, circle);
      }
    });
  }

  // 날짜 포맷 함수
  const formatDate = (dateString) => {
    if (!dateString) return '날짜미정';
    // "날짜미정" 문자열인 경우
    if (dateString === '날짜미정') {
      return '날짜미정';
    }
    // "날짜 시간미정" 형식인 경우 날짜 부분만 추출
    if (dateString.includes('시간미정') && dateString.includes('날짜미정')) {
      return '날짜미정';
    }
    if (dateString.includes('시간미정') && !dateString.includes('날짜미정')) {
      // 날짜는 있지만 시간이 미정인 경우
      const datePart = dateString.replace(' 시간미정', '').trim();
      // 날짜 문자열을 파싱하여 형식 변경
      try {
        const date = new Date(datePart.replace(/\./g, '/'));
        if (!isNaN(date.getTime())) {
          const year = String(date.getFullYear()).slice(-2); // 마지막 2자리만
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
          const weekday = weekdays[date.getDay()];
          return `${year}/${month}/${day}(${weekday})`;
        }
      } catch (e) {
        return datePart;
      }
      return datePart;
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '날짜미정';
      const year = String(date.getFullYear()).slice(-2); // 마지막 2자리만
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const weekday = weekdays[date.getDay()];
      return `${year}/${month}/${day}(${weekday})`;
    } catch (e) {
      return '날짜미정';
    }
  };

  // 시간 포맷 함수
  const formatTime = (dateString) => {
    if (!dateString) return '시간미정';
    // "날짜미정" 문자열인 경우 (날짜가 없으면 시간도 미정)
    if (dateString === '날짜미정' || (dateString.includes('날짜미정') && !dateString.includes('시간미정'))) {
      return '시간미정';
    }
    // "날짜 시간미정" 형식인 경우
    if (dateString.includes('시간미정')) {
      return '시간미정';
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '시간미정';
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch (e) {
      return '시간미정';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
    <ScrollView className="flex-1" style={{ backgroundColor: colors.primary }} showsVerticalScrollIndicator={false}>
      {/* 채널 전환 버튼과 하트 버튼이 있는 흰색 박스 */}
      <View className="bg-white px-5 justify-end" style={{ height: 130, paddingBottom: 20 }}>
        {/* 알약 모양 채널 전환 버튼과 하트 버튼 */}
        <View className="flex-row items-center justify-between">
          <View style={{ flex: 1 }} />
          {/* 알약 모양 채널 전환 버튼 - 가운데 */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#F3F4F6',
            borderRadius: 25,
            padding: 4,
            width: 200,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setSelectedChannel(university);
              setPageByTab(prev => ({
                ...prev,
                [activeTab]: 1,
              }));
            }}
            style={{
              flex: 1,
              backgroundColor: selectedChannel !== 'MIUHub' ? colors.primary : 'transparent',
                borderTopLeftRadius: 20,
                borderBottomLeftRadius: 20,
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
              paddingVertical: 8,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: selectedChannel !== 'MIUHub'
                  ? colors.buttonTextColor
                  : '#666666',
                fontSize: 14,
                fontWeight: selectedChannel !== 'MIUHub' ? '600' : '400',
              }}
            >
              {university || ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setSelectedChannel('MIUHub');
              setPageByTab(prev => ({
                ...prev,
                [activeTab]: 1,
              }));
              setShowPartnersModal(true);
            }}
            style={{
              flex: 1,
              backgroundColor: selectedChannel === 'MIUHub' ? colors.primary : 'transparent',
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                borderTopRightRadius: 20,
                borderBottomRightRadius: 20,
              paddingVertical: 8,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: selectedChannel === 'MIUHub' ? colors.buttonTextColor : '#666666',
                fontSize: 14,
                fontWeight: selectedChannel === 'MIUHub' ? '600' : '400',
              }}
            >
              {getConfig('circles_miuhub', 'MIUHub')}
            </Text>
          </TouchableOpacity>
          </View>
          {/* 관심리스트 필터 버튼 - 맨 오른쪽 */}
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <TouchableOpacity
              onPress={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                setPageByTab(prev => ({
                  ...prev,
                  [activeTab]: 1,
                }));
              }}
              style={{
                padding: 4,
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ fontSize: 18 }}>
                {showFavoritesOnly ? '🤍' : '❤️'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Circles 영역 - 홈 화면과 같은 스타일 */}
      <View className="p-4">
        <View className="bg-white rounded-lg pt-4 px-4 pb-4" style={{ marginBottom: 16, minHeight: Platform.OS === 'ios' ? 1000 : 900, flexDirection: 'column' }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold" style={{ color: colors.primary }}>🔥 Circles</Text>
            <View className="flex-row items-center">
              <Text className="text-sm font-bold mr-2" style={{ color: colors.primary }}>소모임 만들기</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('WriteCircles', { 
                  category: activeTab === '전체' ? getConfig('circles_tab1') : activeTab,
                  selectedChannel: selectedChannel
                })}
                className="border rounded items-center justify-center"
                style={{ 
                  borderColor: colors.primary,
                  width: 21,
                  height: 21,
                }}
              >
                <Text 
                  className="text-base font-bold" 
                  style={{ 
                    color: colors.primary, 
                    lineHeight: 18,
                    fontSize: 16,
                    textAlignVertical: 'center',
                    includeFontPadding: false,
                  }}
                >+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 필터링 영역 - 한 줄 */}
          {/* 부모의 px-4 패딩 상쇄 */}
          <View className="mb-4" style={{ marginHorizontal: -16 }}>
            <View className="flex-row items-center" style={{ gap: 6, flexWrap: 'nowrap', paddingHorizontal: 16, width: '100%' }}>
              {/* 지역 드롭다운 - 마감제외와 동일한 크기 */}
              <View style={{ flexShrink: 1, position: 'relative', width: 70, maxWidth: 70 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowRegionPicker(!showRegionPicker);
                    setShowSortPicker(false);
                  }}
                    style={{
                      backgroundColor: '#F3F4F6',
                      borderWidth: 1,
                      borderColor: '#D1D5DB',
                      borderRadius: 8,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      minHeight: 36,
                      width: '100%',
                    }}
                >
                  <Text style={{ fontSize: 12, color: '#374151' }}>{selectedRegion === '전체' ? '지역' : selectedRegion}</Text>
                  <Text style={{ fontSize: 10, color: '#9CA3AF' }}>▼</Text>
                </TouchableOpacity>
                {showRegionPicker && (
                  <View
                    className="bg-white border border-gray-300 rounded-lg shadow-sm"
                    style={{
                      position: 'absolute',
                      top: 36,
                      left: 0,
                      right: 0,
                      maxHeight: 200,
                      zIndex: 1000,
                      elevation: 5,
                    }}
                  >
                    <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }}>
                      {regions.map((r) => (
                        <TouchableOpacity
                          key={r}
                          onPress={() => {
                            setSelectedRegion(r);
                            setShowRegionPicker(false);
                            // 지역 변경 시 첫 페이지로 리셋
                            setPageByTab(prev => ({
                              ...prev,
                              [activeTab]: 1,
                            }));
                          }}
                          className="p-2 border-b border-gray-100"
                        >
                          <Text className="text-xs" style={{ color: selectedRegion === r ? colors.primary : '#374151' }}>
                            {r === '전체' ? '지역' : r}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              
              {/* 마감 제외 토글 버튼 */}
              <TouchableOpacity
                onPress={() => setExcludeClosed(!excludeClosed)}
                style={{ 
                  flexShrink: 1,
                  width: 70, // 마감제외 글씨가 잘리지 않는 고정 길이
                  maxWidth: 70,
                  backgroundColor: excludeClosed ? colors.primary : '#F3F4F6',
                  borderWidth: 1,
                  borderColor: excludeClosed ? colors.primary : '#D1D5DB',
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 36,
                }}
              >
                <Text 
                  style={{ 
                    fontSize: 12,
                    color: excludeClosed ? '#FFFFFF' : '#374151',
                  }}
                >
                  마감제외
                </Text>
              </TouchableOpacity>
              
              {/* 키워드 검색 - 남은 공간 모두 차지 */}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                <View style={{ 
                  flex: 1, 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: '#F3F4F6', 
                  borderWidth: 1, 
                  borderColor: '#D1D5DB', 
                  borderRadius: 8, 
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  minHeight: 36,
                  height: 36,
                }}>
                  <Text style={{ fontSize: 12, color: '#374151', marginRight: 0 }}>#</Text>
                  <TextInput
                    placeholder="키워드"
                    placeholderTextColor="#9ca3af"
                    value={keywordSearch}
                    onChangeText={setKeywordSearch}
                    style={{ 
                      flex: 1, 
                      fontSize: 12,
                      color: '#374151',
                      paddingVertical: 0,
                      paddingHorizontal: 0,
                      minWidth: 0,
                      ...(Platform.OS === 'android' ? {
                        textAlignVertical: 'center',
                        includeFontPadding: false,
                        lineHeight: 12,
                        height: 20,
                      } : {
                        lineHeight: 14,
                        paddingTop: 0,
                        paddingBottom: 0,
                        height: 20,
                      }),
                    }}
                  />
                </View>
              </View>
              
              {/* 정렬 옵션 - 드롭다운 */}
              <View style={{ flexShrink: 1, position: 'relative', width: 70, maxWidth: 70 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowSortPicker(!showSortPicker);
                    setShowRegionPicker(false);
                  }}
                  style={{
                    backgroundColor: '#F3F4F6',
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 36,
                    width: '100%',
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#374151' }}>
                    {sortBy === 'newest' ? '최신순' : '임박순'}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 4 }}>▼</Text>
                </TouchableOpacity>
                {showSortPicker && (
                  <View
                    className="bg-white border border-gray-300 rounded-lg shadow-sm"
                    style={{
                      position: 'absolute',
                      top: 36,
                      right: 0,
                      left: 0, // 정렬 버튼과 동일한 너비
                      zIndex: 1000,
                      elevation: 5,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setSortBy('newest');
                        setShowSortPicker(false);
                      }}
                      className="p-2 border-b border-gray-100"
                    >
                      <Text className="text-xs" style={{ color: sortBy === 'newest' ? colors.primary : '#374151' }}>
                        최신순
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setSortBy('eventDate');
                        setShowSortPicker(false);
                      }}
                      className="p-2"
                    >
                      <Text className="text-xs" style={{ color: sortBy === 'eventDate' ? colors.primary : '#374151' }}>
                        임박순
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
          
          {/* 탭 버튼 */}
          <View className="flex-row mb-4 border-b border-gray-200">
            {tabs.map((tab, index) => (
              <TouchableOpacity
                key={`circles-tab-${index}-${tab}`}
                onPress={() => handleTabChange(tab)}
                className="flex-1 pb-3 items-center"
                style={{
                  borderBottomWidth: activeTab === tab ? 2 : 0,
                  borderBottomColor: activeTab === tab ? colors.primary : 'transparent',
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{
                    color: activeTab === tab ? colors.primary : '#666',
                  }}
                >
                  {tab}
                </Text>
        </TouchableOpacity>
      ))}
          </View>

          {/* Circles 리스트 - 2열 그리드 */}
          <View style={{ flex: 1, minHeight: 500 }}>
            <View className="flex-row flex-wrap" style={{ justifyContent: 'space-between' }}>
              {circles.map((circle, index) => {
                const isFavorite = favoriteCircles.includes(parseInt(circle.id));
                return (
                  <View
                    key={circle.adId || circle.id}
                    style={{
                      width: '48%',
                      marginBottom: 12,
                    }}
                  >
                <TouchableOpacity 
                  className="bg-gray-50 rounded-lg"
                  style={{ 
                        width: '100%',
                        aspectRatio: 2/3,
                    padding: 12,
                    justifyContent: 'space-between',
                  }}
                      onPress={() => navigation.navigate('ViewCircles', { 
                        circleId: circle.id,
                        selectedChannel: selectedChannel
                      })}
                >
                      <View style={{ flex: 1 }}>
                    {/* 상단 정보 */}
                  <View>
                      {/* 키워드 */}
                      <View className="flex-row items-center justify-between" style={{ marginBottom: 4 }}>
                        {circle.keywords && (
                          <Text className="font-bold" style={{ color: colors.primary, fontSize: 20, flex: 1, flexShrink: 1 }}>
                            {circle.keywords.split(',').map(k => k.trim()).filter(k => k).map(k => k.startsWith('#') ? k : `#${k}`).join(' ')}
                          </Text>
                        )}
                        {circle.isAd ? (
                          <View 
                            style={{ 
                              borderWidth: 1,
                              borderColor: selectedChannel === 'MIUHub' 
                                ? miuhubColors.border
                                : '#D1D5DB',
                              paddingHorizontal: 4,
                              paddingVertical: 1,
                              borderRadius: 3,
                              marginLeft: 6,
                            }}
                          >
                            <Text 
                              style={{ 
                                color: selectedChannel === 'MIUHub' 
                                  ? miuhubColors.border
                                  : '#6B7280',
                                fontSize: 9,
                                fontWeight: '600',
                              }}
                            >
                              {getConfig('featured_label', 'Push')}
                            </Text>
                          </View>
                        ) : circle.isClosed && (
                          <View
                            style={{
                              backgroundColor: '#FF0000',
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                              marginLeft: 6,
                            }}
                          >
                            <Text
                              style={{
                                color: '#FFFFFF',
                                fontSize: 11,
                                fontWeight: '600',
                              }}
                            >
                              마감
                    </Text>
                          </View>
                        )}
                  </View>
                  
                      {/* 지역, 장소 */}
                    {(circle.region || circle.location) && (
                        <Text className="text-gray-500" style={{ marginBottom: 4, fontSize: 12 }}>
                          {circle.region || ''}{circle.region && circle.location ? ', ' : ''}{getPlaceNameOnly(circle.location)}
                        </Text>
                      )}
                      
                      {/* 날짜, 시간 */}
                      <Text className="text-gray-500" style={{ marginBottom: 4, fontSize: 12 }}>
                        {(() => {
                          const dateStr = formatDate(circle.eventDate);
                          const timeStr = formatTime(circle.eventDate);
                          if (dateStr && timeStr) {
                            return `${dateStr}, ${timeStr}`;
                          } else if (dateStr) {
                            return dateStr;
                          } else if (timeStr) {
                            return timeStr;
                          } else {
                            return '날짜미정, 시간미정';
                          }
                        })()}
                      </Text>
                      
                      {/* 참여인원 */}
                      {circle.participants && (
                        <Text className="text-gray-500" style={{ marginBottom: 4, fontSize: 12 }}>
                          참여인원: {circle.participants}
                        </Text>
                      )}
                      
                      {/* 참가비 */}
                      {circle.fee && (
                        <Text className="text-gray-500" style={{ marginBottom: 0, fontSize: 12 }}>
                          참가비: {typeof circle.fee === 'number' ? circle.fee.toLocaleString() + '원' : circle.fee}
                      </Text>
                    )}
                    </View>
                    
                    {/* 제목 - 공간 중간에 배치 */}
                    <View style={{ flex: 1, marginTop: 8, justifyContent: 'center', minHeight: 0 }}>
                      <Text 
                        className="font-bold text-gray-900" 
                        numberOfLines={3}
                        ellipsizeMode="tail"
                        style={{ 
                          lineHeight: 20, 
                          fontSize: 16,
                          includeFontPadding: false,
                          textAlignVertical: 'top',
                          flex: 1,
                          flexShrink: 1,
                          ...(Platform.OS === 'android' ? { 
                            textBreakStrategy: 'highQuality',
                          } : {})
                        }}
                      >
                        {circle.title || '제목 없음'}
                      </Text>
                    </View>
                    
                    {/* 하단 - 작성자, 하트, 뷰수 (항상 하단 고정) */}
                    <View style={{ marginTop: 'auto', paddingTop: 8 }}>
                      <View className="flex-row items-center" style={{ justifyContent: 'space-between' }}>
                        <Text 
                          className="text-gray-500" 
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={{ fontSize: 12, flex: 1, flexShrink: 1, marginRight: 6 }}
                        >
                          {getEmailPrefix(circle.author)}
                        </Text>
                        <View className="flex-row items-center" style={{ flexShrink: 0 }}>
                          <TouchableOpacity
                            onPress={(e) => toggleFavorite(circle.id, e)}
                            style={{ marginRight: 4 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                              }}
                            >
                              {isFavorite ? '❤️' : '🤍'}
                            </Text>
                          </TouchableOpacity>
                          <Text className="text-gray-500" style={{ fontSize: 12, marginRight: 4 }}>
                            👁️ {circle.views || 0}
                          </Text>
                          <Text className="text-gray-500" style={{ fontSize: 12 }}>
                            💬 {circle.commentCount || 0}
                    </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 페이지네이션 버튼 */}
          <View className="flex-row justify-center items-center" style={{ paddingTop: 16 }}>
            <TouchableOpacity
              onPress={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 mx-1 rounded ${
                currentPage === 1 ? 'opacity-50 bg-gray-200' : 'bg-gray-200'
              }`}
            >
              <Text className={`text-sm ${
                currentPage === 1 ? 'text-gray-400' : 'text-gray-700'
              }`}>
                이전
              </Text>
            </TouchableOpacity>

            {/* 페이지 번호 버튼들 - 최대 4개만 표시 */}
            {(() => {
              const maxVisiblePages = 4;
              let pagesToShow = [];
              
              if (totalPages <= maxVisiblePages) {
                // 전체 페이지가 4개 이하: 모두 표시
                pagesToShow = Array.from({ length: totalPages }, (_, i) => i + 1);
              } else {
                // 전체 페이지가 5개 이상: 현재 페이지 중심으로 4개만 표시
                let startPage = Math.max(1, currentPage - 1);
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                
                // 끝에 가까우면 시작점 조정
                if (endPage - startPage < maxVisiblePages - 1) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }
                
                pagesToShow = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
              }
              
              return pagesToShow.map((pageNum) => (
                <TouchableOpacity
                  key={pageNum}
                  onPress={() => handlePageChange(pageNum)}
                  className="px-4 py-2 mx-1 rounded min-w-[40px] items-center"
                  style={{
                    backgroundColor: currentPage === pageNum ? colors.primary : '#E5E7EB'
                  }}
                >
                  <Text className={`text-sm font-medium ${
                    currentPage === pageNum ? 'text-white' : 'text-gray-700'
                  }`}>
                    {pageNum}
                  </Text>
                </TouchableOpacity>
              ));
            })()}

            <TouchableOpacity
              onPress={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className={`px-4 py-2 mx-1 rounded ${
                currentPage >= totalPages ? 'opacity-50 bg-gray-200' : 'bg-gray-200'
              }`}
            >
              <Text className={`text-sm ${
                currentPage >= totalPages ? 'text-gray-400' : 'text-gray-700'
              }`}>
                다음
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
      
      {/* Partners 모달 (MIUHub 전용) */}
      <Modal
        visible={showPartnersModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPartnersModal(false);
          // 모달이 닫힐 때는 이미 MIUHub 탭에 있으므로 상태 변경 불필요
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: miuhubColors.border,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* 닫기 버튼 - 화면 상단 오른쪽 고정 */}
          <TouchableOpacity
            onPress={() => {
              setShowPartnersModal(false);
              // 모달이 닫힐 때는 이미 MIUHub 탭에 있으므로 상태 변경 불필요
            }}
            style={{
              position: 'absolute',
              top: 80,
              right: 20,
              zIndex: 10,
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="close" size={24} color={miuhubColors.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl"
            style={{ 
              width: `${modalWidthPercent}%`, 
              maxWidth: modalMaxWidth,
              paddingTop: modalPaddingTop,
              paddingBottom: modalPaddingBottom,
              paddingLeft: modalPaddingLeft,
              paddingRight: modalPaddingRight,
              minHeight: calculatePartnersModalHeight(),
              shadowColor: miuhubColors.primary,
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Text className="text-xl font-bold mb-6 text-center" style={{ color: miuhubColors.primary }}>
              {getConfig('partners_title', 'Partner Universities')}
            </Text>
            
            <View style={{ 
              flexDirection: 'row', 
              flexWrap: 'wrap', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: slotGap,
              rowGap: slotGap,
              width: '100%',
            }}>
              {slotImages.map((imageSource, index) => {
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      setShowPartnersModal(false);
                      // 모달이 닫힐 때는 이미 MIUHub 탭에 있으므로 상태 변경 불필요
                    }}
                    style={{ alignItems: 'center', justifyContent: 'center' }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        width: slotWidth,
                        height: slotHeight,
                        borderRadius: slotBorderRadius,
                        borderWidth: imageSource ? 0 : slotBorderWidth, // continue as admin과 동일: 이미지가 있으면 점선 없음
                        borderColor: slotBorderColor,
                        borderStyle: slotBorderStyle,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: slotBackgroundColor,
                        overflow: imageSource ? 'hidden' : 'visible',
                      }}
                    >
                      {imageSource && (
                        <Image
                          source={imageSource}
                          style={{
                            width: '100%',
                            height: '100%',
                          }}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
          
          {/* 흰색 박스 아래 텍스트 */}
          <Text className="text-center mt-6" style={{ 
            color: miuhubColors.primary, 
            fontSize: 16,
            fontWeight: 'bold',
          }}>
            {getConfig('partners_welcoming_text', 'Welcoming New Partner Universities')}
          </Text>
          
          {/* 고객지원 버튼 */}
          <TouchableOpacity
            onPress={() => {
              setShowPartnersModal(false);
              navigation.navigate('ContactSupport');
            }}
            style={{
              marginTop: 16,
              alignSelf: 'center',
              shadowColor: miuhubColors.primary,
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="mail-outline" size={28} color={miuhubColors.primary} />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 토스트 메시지 */}
      {toastMessage !== '' && (
        <View
          style={{
            position: 'absolute',
            bottom: 100,
            left: '50%',
            marginLeft: -100,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            zIndex: 1000,
            width: 200,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 12 }}>
            {toastMessage}
          </Text>
        </View>
      )}
      <GlobalPopup routeName="circles" />
    </View>
  );
}
