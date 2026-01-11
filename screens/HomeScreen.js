import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import API_BASE_URL from '../config/api';
import { useUniversity } from '../contexts/UniversityContext';
import { getUniColors } from '../utils/uniColors';
import { useAppConfig } from '../contexts/AppConfigContext';
import GlobalPopup from '../components/GlobalPopup';
import { getLoginColors } from '../utils/uniColors';
import { getEmailPrefix } from '../config/supabase';

export default function HomeScreen({ navigation }) {
  const { university, updateUniversity } = useUniversity();
  const { getConfig, getConfigNumber, getColorConfig, config: appConfig, loadConfig, loading: configLoading } = useAppConfig();
  const config = { getColorConfig };
  const LOGIN_COLORS = getLoginColors(getConfig);
  
  // CirclesScreen과 동일하게 getUniColors 사용 (useMemo로 감싸서 university 변경 시 재계산)
  const uniColors = useMemo(() => getUniColors(university, config), [university, getColorConfig, appConfig]);
  const colors = useMemo(() => ({
    primary: uniColors.primary,
    buttonTextColor: uniColors.buttonTextColor,
  }), [uniColors]);
  
  // 공지사항 탭 (useMemo로 감싸서 config 변경 시 재생성)
  const noticeTabs = useMemo(() => {
    const tabs = ['전체'];
    const tab1 = getConfig('notice_tab1');
    const tab2 = getConfig('notice_tab2');
    const tab3 = getConfig('notice_tab3');
    if (tab1) tabs.push(tab1);
    if (tab2) tabs.push(tab2);
    if (tab3) tabs.push(tab3);
    return tabs;
  }, [getConfig, appConfig, configLoading]);
  
  const [activeTab, setActiveTab] = useState('전체');
  const [pageByTab, setPageByTab] = useState({});
  
  // 경조사 탭 (useMemo로 감싸서 config 변경 시 재생성)
  const lifeEventTabs = useMemo(() => {
    const tabs = ['전체'];
    const tab1 = getConfig('life_event_tab1');
    const tab2 = getConfig('life_event_tab2');
    const tab3 = getConfig('life_event_tab3');
    if (tab1) tabs.push(tab1);
    if (tab2) tabs.push(tab2);
    if (tab3) tabs.push(tab3);
    return tabs;
  }, [getConfig, appConfig]);
  
  const [activeLifeEventTab, setActiveLifeEventTab] = useState('전체');
  const [pageByLifeEventTab, setPageByLifeEventTab] = useState({});
  
  // pageByTab 초기화 및 업데이트 (noticeTabs가 변경될 때)
  useEffect(() => {
    setPageByTab(prev => {
      const newPageByTab = { ...prev };
      noticeTabs.forEach(tab => {
        if (!(tab in newPageByTab)) {
          newPageByTab[tab] = 1;
        }
      });
      return newPageByTab;
    });
    
    // activeTab이 더 이상 유효하지 않으면 '전체'로 리셋
    if (!noticeTabs.includes(activeTab)) {
      setActiveTab('전체');
    }
  }, [noticeTabs, activeTab]);
  
  // pageByLifeEventTab 초기화 및 업데이트 (lifeEventTabs가 변경될 때)
  useEffect(() => {
    setPageByLifeEventTab(prev => {
      const newPageByTab = { ...prev };
      lifeEventTabs.forEach(tab => {
        if (!(tab in newPageByTab)) {
          newPageByTab[tab] = 1;
        }
      });
      return newPageByTab;
    });
    
    // activeLifeEventTab이 더 이상 유효하지 않으면 '전체'로 리셋
    if (!lifeEventTabs.includes(activeLifeEventTab)) {
      setActiveLifeEventTab('전체');
    }
  }, [lifeEventTabs, activeLifeEventTab]);
  const [savedNotices, setSavedNotices] = useState([]);
  const [savedLifeEvents, setSavedLifeEvents] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); // 현재 사용자 (admin 체크용)
  const [showUniSelection, setShowUniSelection] = useState(false); // 학교 선택 모달
  const [adminImageUrls, setAdminImageUrls] = useState({});
  
  const [logoImageUrl, setLogoImageUrl] = useState(null); // 로고 이미지 URL
  const noticesItemsPerPage = getConfigNumber('home_notices_items_per_page', 3);
  const lifeEventsItemsPerPage = getConfigNumber('home_life_events_items_per_page', 3);
  
  // 관리자 모달 설정 (LoginScreen과 동일)
  const adminSlotsCount = getConfigNumber('login_admin_slots_count', 3);
  
  // Admin 모달 슬롯 이미지 파일명들 가져오기 (의존성 배열용)
  const adminSlotImageNames = [];
  for (let i = 1; i <= adminSlotsCount; i++) {
    adminSlotImageNames.push(getConfig(`login_admin_slot_${i}_image`, ''));
  }

  // Supabase Storage에서 Admin 모달 이미지 URL 가져오기 (LoginScreen과 동일한 방식 - 캐싱 적용)
  useEffect(() => {
    if (adminSlotsCount <= 0) return;
    
    const loadAdminImageUrls = async () => {
      // 모든 이미지 파일명 수집 (EMPTY 값 제외)
      const imageNames = [];
      for (let i = 1; i <= adminSlotsCount; i++) {
        const imageName = getConfig(`login_admin_slot_${i}_image`, '');
        // EMPTY 값과 빈 문자열 필터링
        if (imageName && imageName !== 'EMPTY' && imageName.trim() !== '') {
          imageNames.push(imageName);
        }
      }
      
      if (imageNames.length === 0) {
        setAdminImageUrls({});
        return;
      }
      
      // 캐시 키 생성 (모든 파일명을 정렬하여 일관된 키 생성)
      const sortedNames = [...imageNames].sort().join(',');
      const cacheKey = `admin_image_urls_${sortedNames}`;
      const cacheTimestampKey = `${cacheKey}_timestamp`;
      
      // 캐시에서 먼저 확인 (만료 시간: 24시간)
      const cachedUrls = await AsyncStorage.getItem(cacheKey);
      const cachedTimestamp = await AsyncStorage.getItem(cacheTimestampKey);
      const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24시간
      
      if (cachedUrls && cachedTimestamp) {
        const cacheAge = Date.now() - parseInt(cachedTimestamp, 10);
        if (cacheAge < CACHE_EXPIRY_MS) {
          // 캐시가 유효함
          const parsedUrls = JSON.parse(cachedUrls);
          // URL 객체로 변환
          const urls = {};
          Object.keys(parsedUrls).forEach(imageName => {
            urls[imageName] = { uri: parsedUrls[imageName] };
          });
          setAdminImageUrls(urls);
          return; // 캐시에서 가져왔으므로 API 호출 생략
        }
        // 캐시가 만료되었으면 삭제하고 새로 로드
        await AsyncStorage.removeItem(cacheKey);
        await AsyncStorage.removeItem(cacheTimestampKey);
      }
      
      // 캐시에 없으면 Supabase Storage에서 직접 가져오기
      if (!supabase) {
        setAdminImageUrls({});
        return;
      }
      
      // Supabase Storage에서 직접 URL 생성 (캐시 버스팅을 위해 타임스탬프 추가)
      const urls = {};
      const currentTimestamp = Date.now(); // 현재 타임스탬프로 캐시 버스팅
      imageNames.forEach(imageName => {
        const trimmedName = String(imageName).trim();
        if (trimmedName) {
          const filePath = `assets/${trimmedName}`;
          const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);
          if (urlData?.publicUrl) {
            // 쿼리 파라미터로 캐시 버스팅 (브라우저/앱 레벨 캐시 무효화)
            urls[trimmedName] = `${urlData.publicUrl}?v=${currentTimestamp}`;
          }
        }
      });
      
      // 캐시에 저장 (타임스탬프와 함께)
      await AsyncStorage.setItem(cacheKey, JSON.stringify(urls));
      await AsyncStorage.setItem(cacheTimestampKey, Date.now().toString());
      
      // URL 객체로 변환
      const urlObjects = {};
      Object.keys(urls).forEach(imageName => {
        urlObjects[imageName] = { uri: urls[imageName] };
      });
      setAdminImageUrls(urlObjects);
    };
    
    loadAdminImageUrls();
  }, [adminSlotsCount, adminSlotImageNames.join(','), getConfig]);

  const adminSlotWidth = 100;
  const adminSlotHeight = 100;
  const adminSlotGap = 24;
  const adminSlotBorderWidth = 2;
  const adminSlotBorderColor = '#d1d5db';
  const adminSlotBorderStyle = 'dashed';
  const adminSlotBackgroundColor = '#f9fafb';
  const adminSlotBorderRadius = 20;
  const adminModalPaddingTop = 48;
  const adminModalPaddingBottom = 48;
  const adminModalPaddingLeft = 24;
  const adminModalPaddingRight = 24;
  const adminModalWidthPercent = 90;
  const adminModalMaxWidth = 400;
  
  // Admin 모달 슬롯 이미지 배열 생성 (모두 Supabase Storage에서 로드)
  const adminSlotImages = [];
  for (let i = 1; i <= adminSlotsCount; i++) {
    const imageName = getConfig(`login_admin_slot_${i}_image`, '');
    if (imageName) {
      adminSlotImages.push(adminImageUrls[imageName] || null);
    } else {
      adminSlotImages.push(null);
    }
  }
  
  // 모달 높이 계산
  const calculateAdminModalHeight = () => {
    const titleHeight = 30;
    const titleMarginBottom = 24;
    const slotsPerRow = 3;
    const rows = Math.ceil(adminSlotsCount / slotsPerRow);
    const slotsHeight = rows * adminSlotHeight + (rows - 1) * adminSlotGap;
    return titleHeight + titleMarginBottom + slotsHeight + adminModalPaddingTop + adminModalPaddingBottom;
  };

  // 로그인 상태 확인
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const currentUserId = await AsyncStorage.getItem('currentUserId');
        setCurrentUser(currentUserId);
      } catch (error) {
        setCurrentUser(null);
      }
    };

    checkLoginStatus();
  }, []);

  // 화면이 포커스될 때마다 로그인 상태만 확인
  useFocusEffect(
    React.useCallback(() => {
      const checkLoginStatus = async () => {
        try {
          const currentUserId = await AsyncStorage.getItem('currentUserId');
          setCurrentUser(currentUserId);
        } catch (error) {
          setCurrentUser(null);
        }
      };
      checkLoginStatus();
      // 화면 포커스 시 config 새로고침 (캐시 무시)
      if (university) {
        loadConfig(university, true);
      } else {
        loadConfig(null, true);
      }
    }, [university, loadConfig])
  );

  // university가 변경될 때마다 로고 이미지, 공지사항, 경조사를 병렬로 불러오기 (성능 최적화)
  useEffect(() => {
    const loadAllData = async () => {
      if (!university || !university.trim()) {
        setLogoImageUrl(null);
        setSavedNotices([]);
        setSavedLifeEvents([]);
        return;
      }

      try {
        const universityCode = university.toLowerCase();
        
        // 학교 이름을 소문자로 변환하여 display_name 확인
        const universityLower = university.toLowerCase();
        const displayName = getConfig(`${universityLower}_display_name`, '');
        
        // display_name이 있으면 그것을 사용, 없으면 university 그대로 사용
        const universityDisplayName = displayName || university;
        
        // 이미지 파일명 생성 (예: Cornell.png)
        const imageFileName = `${universityDisplayName}.png`;
        
        // 로고 이미지 Supabase에서 직접 가져오기
        if (supabase) {
          const filePath = `assets/${imageFileName}`;
          const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);
          if (urlData?.publicUrl) {
            setLogoImageUrl({ uri: urlData.publicUrl });
          } else {
            setLogoImageUrl(null);
          }
        } else {
          setLogoImageUrl(null);
        }
        
        // 공지사항, 경조사를 병렬로 불러오기
        const [noticesResponse, lifeEventsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/notices?university=${encodeURIComponent(universityCode)}`),
          fetch(`${API_BASE_URL}/api/life-events?university=${encodeURIComponent(universityCode)}`)
        ]);
        
        // 공지사항 처리
        if (noticesResponse.ok) {
          const noticesData = await noticesResponse.json();
          if (noticesData.success && noticesData.notices) {
            setSavedNotices(noticesData.notices);
          } else {
            if (__DEV__) {
              console.error('[HomeScreen] 공지사항 데이터 형식 오류:', noticesData);
            }
            setSavedNotices([]);
          }
        } else {
          if (__DEV__) {
            console.error(`[HomeScreen] 공지사항 로드 실패: ${noticesResponse.status} ${noticesResponse.statusText}`, {
              url: `${API_BASE_URL}/api/notices?university=${encodeURIComponent(universityCode)}`,
              university,
              universityCode
            });
          }
          setSavedNotices([]);
        }

        // 경조사 처리
        if (lifeEventsResponse.ok) {
          const lifeEventsData = await lifeEventsResponse.json();
          if (lifeEventsData.success && lifeEventsData.lifeEvents) {
            setSavedLifeEvents(lifeEventsData.lifeEvents);
          } else {
            if (__DEV__) {
              console.error('[HomeScreen] 경조사 데이터 형식 오류:', lifeEventsData);
            }
            setSavedLifeEvents([]);
          }
        } else {
          if (__DEV__) {
            console.error(`[HomeScreen] 경조사 로드 실패: ${lifeEventsResponse.status} ${lifeEventsResponse.statusText}`, {
              url: `${API_BASE_URL}/api/life-events?university=${encodeURIComponent(universityCode)}`,
              university,
              universityCode
            });
          }
          setSavedLifeEvents([]);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[HomeScreen] 데이터 로드 오류:', error, {
            university,
            universityCode: university ? university.toLowerCase() : null,
            API_BASE_URL
          });
        }
        setLogoImageUrl(null);
        setSavedNotices([]);
        setSavedLifeEvents([]);
      }
    };

    loadAllData();
  }, [university, getConfig]);

  // 화면이 포커스될 때마다 데이터 새로고침 (로고 이미지, 공지사항, 경조사 모두 병렬 로드)
  const intervalRef = useRef(null);
  
  useFocusEffect(
    React.useCallback(() => {
      if (!university || configLoading) return; // config가 로드되기 전에는 실행하지 않음
      
      const loadAllData = async () => {
        if (!university || !university.trim()) {
          setLogoImageUrl(null);
          setSavedNotices([]);
          setSavedLifeEvents([]);
          return;
        }
        
        try {
          const universityCode = university.toLowerCase();
          
          // 학교 이름을 소문자로 변환하여 display_name 확인
          const universityLower = university.toLowerCase();
          const displayName = getConfig(`${universityLower}_display_name`, '');
          
          // display_name이 있으면 그것을 사용, 없으면 university 그대로 사용
          const universityDisplayName = displayName || university;
          
          // 이미지 파일명 생성 (예: Cornell.png)
          const imageFileName = `${universityDisplayName}.png`;
          
          // 로고 이미지 캐싱 확인
          const logoCacheKey = `home_logo_url_${imageFileName}`;
          let logoUrl = null;
          
          try {
            const cachedLogoUrl = await AsyncStorage.getItem(logoCacheKey);
            if (cachedLogoUrl) {
              logoUrl = cachedLogoUrl;
              setLogoImageUrl({ uri: cachedLogoUrl });
            }
          } catch (cacheError) {
            // 캐시 읽기 오류는 무시
          }
          
          // 공지사항과 경조사 캐시 확인
          const noticesCacheKey = `home_notices_${universityCode}`;
          const lifeEventsCacheKey = `home_life_events_${universityCode}`;
          const cacheTimestampKey = `home_data_timestamp_${universityCode}`;
          
          let cachedNotices = null;
          let cachedLifeEvents = null;
          let cacheTimestamp = null;
          
          try {
            const [cachedNoticesStr, cachedLifeEventsStr, timestampStr] = await Promise.all([
              AsyncStorage.getItem(noticesCacheKey),
              AsyncStorage.getItem(lifeEventsCacheKey),
              AsyncStorage.getItem(cacheTimestampKey)
            ]);
            
            if (cachedNoticesStr) {
              cachedNotices = JSON.parse(cachedNoticesStr);
            }
            if (cachedLifeEventsStr) {
              cachedLifeEvents = JSON.parse(cachedLifeEventsStr);
            }
            if (timestampStr) {
              cacheTimestamp = parseInt(timestampStr, 10);
            }
            
            // 캐시가 있고 5분 이내면 캐시된 데이터 사용
            const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
            const CACHE_DURATION = 5 * 60 * 1000; // 5분
            
            if (cacheAge < CACHE_DURATION && cachedNotices && cachedLifeEvents) {
              // 캐시된 데이터를 먼저 표시
              setSavedNotices(cachedNotices);
              setSavedLifeEvents(cachedLifeEvents);
              
              // 백그라운드에서 새 데이터 가져오기 (캐시가 있으면 비동기로 업데이트)
              // 로고 이미지 Supabase에서 직접 가져오기
              if (!logoUrl && supabase) {
                const filePath = `assets/${imageFileName}`;
                const { data: urlData } = supabase.storage
                  .from('images')
                  .getPublicUrl(filePath);
                if (urlData?.publicUrl) {
                  AsyncStorage.setItem(logoCacheKey, urlData.publicUrl).catch(() => {});
                  setLogoImageUrl({ uri: urlData.publicUrl });
                }
              }
              
              Promise.all([
                fetch(`${API_BASE_URL}/api/notices?university=${encodeURIComponent(universityCode)}`),
                fetch(`${API_BASE_URL}/api/life-events?university=${encodeURIComponent(universityCode)}`)
              ]).then(([noticesResponse, lifeEventsResponse]) => {
                
                // 공지사항 업데이트
                if (noticesResponse.ok) {
                  noticesResponse.json().then(noticesData => {
                    if (noticesData.success && noticesData.notices) {
                      AsyncStorage.setItem(noticesCacheKey, JSON.stringify(noticesData.notices)).catch(() => {});
                      AsyncStorage.setItem(cacheTimestampKey, Date.now().toString()).catch(() => {});
                      setSavedNotices(noticesData.notices);
                    }
                  }).catch(() => {});
                }
                
                // 경조사 업데이트
                if (lifeEventsResponse.ok) {
                  lifeEventsResponse.json().then(lifeEventsData => {
                    if (lifeEventsData.success && lifeEventsData.lifeEvents) {
                      AsyncStorage.setItem(lifeEventsCacheKey, JSON.stringify(lifeEventsData.lifeEvents)).catch(() => {});
                      AsyncStorage.setItem(cacheTimestampKey, Date.now().toString()).catch(() => {});
                      setSavedLifeEvents(lifeEventsData.lifeEvents);
                    }
                  }).catch(() => {});
                }
              }).catch(() => {});
              
              return; // 캐시가 있으면 여기서 종료
            }
          } catch (cacheError) {
            // 캐시 읽기 오류는 무시하고 API 호출 계속
          }
          
          // 캐시가 없거나 만료되었으면 Supabase에서 직접 가져오기
          // 로고 이미지 Supabase에서 직접 가져오기
          if (!logoUrl && supabase) {
            const filePath = `assets/${imageFileName}`;
            const { data: urlData } = supabase.storage
              .from('images')
              .getPublicUrl(filePath);
            if (urlData?.publicUrl) {
              try {
                await AsyncStorage.setItem(logoCacheKey, urlData.publicUrl);
              } catch (cacheError) {
                // 캐시 저장 실패는 무시
              }
              setLogoImageUrl({ uri: urlData.publicUrl });
            } else {
              setLogoImageUrl(null);
            }
          }
          
          // 공지사항, 경조사를 병렬로 불러오기
          const [noticesResponse, lifeEventsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/notices?university=${encodeURIComponent(universityCode)}`),
            fetch(`${API_BASE_URL}/api/life-events?university=${encodeURIComponent(universityCode)}`)
          ]);
          
          // 공지사항 처리
          if (noticesResponse.ok) {
            const noticesData = await noticesResponse.json();
            if (noticesData.success && noticesData.notices) {
              // 캐시에 저장
              try {
                await AsyncStorage.setItem(noticesCacheKey, JSON.stringify(noticesData.notices));
                await AsyncStorage.setItem(cacheTimestampKey, Date.now().toString());
              } catch (cacheError) {
                // 캐시 저장 실패는 무시
              }
              setSavedNotices(noticesData.notices);
            } else {
              if (__DEV__) {
                console.error('[HomeScreen] 공지사항 데이터 형식 오류:', noticesData);
              }
              setSavedNotices([]);
            }
          } else {
            if (__DEV__) {
              console.error(`[HomeScreen] 공지사항 로드 실패: ${noticesResponse.status} ${noticesResponse.statusText}`, {
                url: `${API_BASE_URL}/api/notices?university=${encodeURIComponent(universityCode)}`,
                university,
                universityCode
              });
            }
            // 오류 시 캐시된 데이터가 있으면 사용
            if (cachedNotices) {
              setSavedNotices(cachedNotices);
            } else {
              setSavedNotices([]);
            }
          }

          // 경조사 처리
          if (lifeEventsResponse.ok) {
            const lifeEventsData = await lifeEventsResponse.json();
            if (lifeEventsData.success && lifeEventsData.lifeEvents) {
              // 캐시에 저장
              try {
                await AsyncStorage.setItem(lifeEventsCacheKey, JSON.stringify(lifeEventsData.lifeEvents));
                await AsyncStorage.setItem(cacheTimestampKey, Date.now().toString());
              } catch (cacheError) {
                // 캐시 저장 실패는 무시
              }
              setSavedLifeEvents(lifeEventsData.lifeEvents);
            } else {
              if (__DEV__) {
                console.error('[HomeScreen] 경조사 데이터 형식 오류:', lifeEventsData);
              }
              setSavedLifeEvents([]);
            }
          } else {
            if (__DEV__) {
              console.error(`[HomeScreen] 경조사 로드 실패: ${lifeEventsResponse.status} ${lifeEventsResponse.statusText}`, {
                url: `${API_BASE_URL}/api/life-events?university=${encodeURIComponent(universityCode)}`,
                university,
                universityCode
              });
            }
            // 오류 시 캐시된 데이터가 있으면 사용
            if (cachedLifeEvents) {
              setSavedLifeEvents(cachedLifeEvents);
            } else {
              setSavedLifeEvents([]);
            }
          }
        } catch (error) {
          if (__DEV__) {
            console.error('[HomeScreen] 데이터 로드 오류:', error, {
              university,
              universityCode: university ? university.toLowerCase() : null,
              API_BASE_URL
            });
          }
          // 에러 발생 시 빈 배열로 설정하여 UI가 깨지지 않도록 함
          setSavedNotices([]);
          setSavedLifeEvents([]);
        }
      };
      
      // 즉시 새로고침
      loadAllData();
      
      // 2분(120초)마다 자동 새로고침 (새 글 확인)
      intervalRef.current = setInterval(() => {
        loadAllData();
      }, 2 * 60 * 1000); // 2분마다
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [university, getConfig, configLoading])
  );

  // API에서 불러온 공지사항만 사용
  // activeTab에 따라 필터링
  const filteredNotices = activeTab === '전체'
    ? savedNotices
    : savedNotices.filter(notice => notice.category === activeTab);
  const allNotices = filteredNotices;
  const currentPage = pageByTab[activeTab] || 1;
  const totalPages = Math.ceil(allNotices.length / noticesItemsPerPage);
  const startIndex = (currentPage - 1) * noticesItemsPerPage;
  const endIndex = startIndex + noticesItemsPerPage;
  const notices = allNotices.slice(startIndex, endIndex);
  const tabs = noticeTabs;
  
  const handlePageChange = (newPage) => {
    setPageByTab(prev => ({
      ...prev,
      [activeTab]: newPage,
    }));
  };
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // 탭 변경 시 페이지는 유지 (이미 pageByTab에서 관리됨)
  };

  // 경조사 관련 변수
  // activeLifeEventTab에 따라 필터링
  const filteredLifeEvents = activeLifeEventTab === '전체' 
    ? savedLifeEvents 
    : savedLifeEvents.filter(event => event.category === activeLifeEventTab);
  const allLifeEvents = filteredLifeEvents;
  const currentLifeEventPage = pageByLifeEventTab[activeLifeEventTab] || 1;
  const totalLifeEventPages = Math.ceil(allLifeEvents.length / lifeEventsItemsPerPage);
  const startLifeEventIndex = (currentLifeEventPage - 1) * lifeEventsItemsPerPage;
  const endLifeEventIndex = startLifeEventIndex + lifeEventsItemsPerPage;
  const lifeEvents = allLifeEvents.slice(startLifeEventIndex, endLifeEventIndex);
  
  const handleLifeEventPageChange = (newPage) => {
    setPageByLifeEventTab(prev => ({
      ...prev,
      [activeLifeEventTab]: newPage,
    }));
  };
  
  const handleLifeEventTabChange = (tab) => {
    setActiveLifeEventTab(tab);
  };


  return (
    <>
    <ScrollView className="flex-1" style={{ backgroundColor: colors.primary }} showsVerticalScrollIndicator={false}>
      {/* 로고가 들어있는 흰색 박스 */}
      <View className="bg-white px-5 items-center justify-end" style={{ height: 130, paddingBottom: 10, position: 'relative' }}>
        {logoImageUrl ? (
          <Image
            source={logoImageUrl}
            style={{ width: 256, height: 60 }}
            resizeMode="contain"
            cache="force-cache"
          />
        ) : null}
        {/* admin일 때만 제어판 이모티콘 표시 */}
        {currentUser === 'admin' && (
          <>
            {/* 왼쪽 상단 집 모양 아이콘 - 학교 선택 */}
            <TouchableOpacity
              onPress={() => setShowUniSelection(true)}
              style={{
                position: 'absolute',
                left: getConfigNumber('popup_admin_home_icon_position_left', 20),
                top: '50%',
                transform: [{ translateY: -15 }],
                padding: getConfigNumber('popup_admin_home_icon_padding', 8),
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons 
                name={getConfig('popup_admin_home_icon_name', 'home-outline')} 
                size={getConfigNumber('popup_admin_home_icon_size', 24)} 
                color={getConfig('popup_admin_home_icon_color', '#000000')} 
              />
            </TouchableOpacity>
            
            {/* 오른쪽 상단 설정 아이콘 */}
            <TouchableOpacity
              onPress={() => navigation.navigate('PopupManage')}
              style={{
                position: 'absolute',
                right: getConfigNumber('popup_admin_settings_icon_position_right', 20),
                top: '50%',
                transform: [{ translateY: -15 }],
                padding: getConfigNumber('popup_admin_settings_icon_padding', 8),
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons 
                name={getConfig('popup_admin_settings_icon_name', 'settings-outline')} 
                size={getConfigNumber('popup_admin_settings_icon_size', 24)} 
                color={getConfig('popup_admin_settings_icon_color', '#000000')} 
              />
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {/* 공지사항 영역 - 하나의 흰색 박스 */}
      <View className="p-4">
        <View className="bg-white rounded-lg pt-4 px-4 pb-4" style={{ marginBottom: 16 }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold" style={{ color: colors.primary }}>
              📣 Events & Notices
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('WriteNotice', { category: activeTab === '전체' ? getConfig('notice_tab1') : activeTab })}
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
          
          {/* 탭 버튼 */}
          <View className="flex-row mb-4 border-b border-gray-200">
            {tabs.map((tab, index) => (
              <TouchableOpacity
                key={`notice-tab-${index}-${tab}`}
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

          {/* 공지사항 리스트 */}
          <View style={{ height: 288 }}>
            {notices.map((notice, index) => (
              <TouchableOpacity 
                key={notice.id} 
                className={`bg-gray-50 rounded-lg ${index < notices.length - 1 ? 'mb-3' : ''}`}
                style={{ padding: 16 }}
                onPress={() => navigation.navigate('ViewNotice', { noticeId: notice.id })}
              >
                {/* 제목 */}
                <View style={{ marginBottom: 8 }}>
                  <Text className="text-base font-bold text-gray-900" numberOfLines={2} style={{ lineHeight: 20 }}>
                    {notice.title}
                  </Text>
                </View>
                
                {/* 메타 정보 */}
                <View className="flex-row items-center">
                  <Text className="text-xs text-gray-500 mr-2">
                    {notice.created_at ? (() => {
                      // UTC 날짜를 그대로 사용하여 날짜만 표시 (시간대 변환 없이)
                      const date = new Date(notice.created_at);
                      const year = date.getUTCFullYear();
                      const month = date.getUTCMonth();
                      const day = date.getUTCDate();
                      const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
                      return `${year}년 ${monthNames[month]} ${day}일`;
                    })() : ''}
                  </Text>
                  <Text className="text-xs text-gray-500 mr-2">
                    {notice.nickname || getEmailPrefix(notice.author)}
                  </Text>
                  <Text className="text-xs text-gray-500">👁️ {notice.views || 0}</Text>
                </View>
              </TouchableOpacity>
            ))}
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

        {/* 동문 경조사 영역 */}
        <View className="bg-white rounded-lg pt-4 px-4 pb-4" style={{ marginBottom: 16 }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold" style={{ color: colors.primary }}>
              🎈 Alumni Life Events
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('WriteLifeEvent')}
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
          
          {/* 탭 버튼 */}
          <View className="flex-row mb-4 border-b border-gray-200">
            {lifeEventTabs.map((tab, index) => (
              <TouchableOpacity
                key={`lifeevent-tab-${index}-${tab}`}
                onPress={() => handleLifeEventTabChange(tab)}
                className="flex-1 pb-3 items-center"
                style={{
                  borderBottomWidth: activeLifeEventTab === tab ? 2 : 0,
                  borderBottomColor: activeLifeEventTab === tab ? colors.primary : 'transparent',
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{
                    color: activeLifeEventTab === tab ? colors.primary : '#666',
                  }}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 경조사 리스트 */}
          <View style={{ height: 288 }}>
            {lifeEvents.map((lifeEvent, index) => (
              <TouchableOpacity 
                key={lifeEvent.id} 
                className={`bg-gray-50 rounded-lg ${index < lifeEvents.length - 1 ? 'mb-3' : ''}`}
                style={{ padding: 16 }}
                onPress={() => navigation.navigate('ViewLifeEvent', { lifeEventId: lifeEvent.id })}
              >
                {/* 제목 */}
                <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* 경조사 카테고리 태그 - 탭 이름과 동일하게 표시 */}
                  {lifeEvent.category && lifeEvent.category !== '전체' && (() => {
                    // lifeEventTabs에서 해당 카테고리의 인덱스 찾기 (대소문자 및 공백 무시)
                    // 정확히 일치하는 경우 먼저 확인
                    let categoryIndex = lifeEventTabs.indexOf(lifeEvent.category);
                    let matchedTabName = null;
                    
                    // 정확히 일치하지 않으면 대소문자 및 공백 무시하고 비교
                    if (categoryIndex === -1) {
                      const normalizedCategory = lifeEvent.category.trim().toLowerCase();
                      
                      // config에서 가져온 탭 이름들을 정규화하여 비교
                      const tab1 = getConfig('life_event_tab1');
                      const tab2 = getConfig('life_event_tab2');
                      const tab3 = getConfig('life_event_tab3');
                      
                      // 알려진 매핑: 데이터베이스에 저장된 영문 값과 config 탭 이름 매핑
                      const categoryMapping = {
                        'business': tab1,
                        'biz': tab1, // 'biz'도 tab1으로 매핑
                        'obituary': tab2,
                        'wedding': tab3
                      };
                      
                      // 매핑에서 찾기
                      let mappedTab = categoryMapping[normalizedCategory];
                      
                      // 매핑에 없으면 config 탭 이름들을 직접 비교
                      if (!mappedTab || !mappedTab.trim()) {
                        // 각 탭 이름을 정규화하여 비교
                        if (tab1 && tab1.trim().toLowerCase() === normalizedCategory) {
                          mappedTab = tab1;
                        } else if (tab2 && tab2.trim().toLowerCase() === normalizedCategory) {
                          mappedTab = tab2;
                        } else if (tab3 && tab3.trim().toLowerCase() === normalizedCategory) {
                          mappedTab = tab3;
                        }
                      }
                      
                      if (mappedTab && mappedTab.trim() && lifeEventTabs.includes(mappedTab)) {
                        categoryIndex = lifeEventTabs.indexOf(mappedTab);
                        matchedTabName = mappedTab;
                      } else {
                        // 매핑에 없으면 부분 문자열로 비교
                        categoryIndex = lifeEventTabs.findIndex(tab => {
                          if (tab) {
                            const normalizedTab = tab.trim().toLowerCase();
                            // 정확히 일치하거나, 부분 문자열로 포함되는 경우
                            if (normalizedTab === normalizedCategory || 
                                normalizedTab.includes(normalizedCategory) || 
                                normalizedCategory.includes(normalizedTab)) {
                              matchedTabName = tab; // 매칭된 탭 이름 저장
                              return true;
                            }
                          }
                          return false;
                        });
                      }
                    } else {
                      // 정확히 일치하는 경우 해당 탭 이름 사용
                      matchedTabName = lifeEventTabs[categoryIndex];
                    }
                    
                    // tab1, tab2, tab3에 따라 색상 결정 (인덱스 1, 2, 3이 각각 tab1, tab2, tab3)
                    // lifeEventTabs에 있으면 해당 색상, 없으면 기본 색상 사용
                    let backgroundColor = '#E0F6FF';
                    let textColor = '#000080';
                    
                    if (categoryIndex === 1) {
                      // tab1: 빨강
                      backgroundColor = '#FFE4E1';
                      textColor = '#DC143C';
                    } else if (categoryIndex === 2) {
                      // tab2: 파랑
                      backgroundColor = '#E0F6FF';
                      textColor = '#000080';
                    } else if (categoryIndex === 3) {
                      // tab3: 노랑
                      backgroundColor = '#FFF9C4';
                      textColor = '#B8860B';
                    }
                    // categoryIndex가 -1이면 기본 색상 유지
                    
                    // 태그 텍스트: lifeEventTabs에서 매칭된 탭 이름이 있으면 그것을 사용, 없으면 원본 카테고리 사용
                    const tagText = matchedTabName || lifeEvent.category;
                    
                    // 모든 카테고리에 태그 표시 (lifeEventTabs에 있으면 색상 적용, 없으면 기본 색상)
                    return (
                      <View
                        style={{
                          backgroundColor: backgroundColor,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          marginRight: 6,
                          marginBottom: 2,
                        }}
                      >
                        <Text
                          style={{
                            color: textColor,
                            fontSize: 11,
                            fontWeight: '600',
                          }}
                        >
                          {tagText}
                        </Text>
                      </View>
                    );
                  })()}
                  <Text className="text-base font-bold text-gray-900" numberOfLines={2} style={{ lineHeight: 20, flex: 1 }}>
                    {lifeEvent.title}
                  </Text>
                </View>
                
                {/* 메타 정보 */}
                <View className="flex-row items-center">
                  <Text className="text-xs text-gray-500 mr-2">
                    {lifeEvent.created_at ? (() => {
                      // UTC 날짜를 그대로 사용하여 날짜만 표시 (시간대 변환 없이)
                      const date = new Date(lifeEvent.created_at);
                      const year = date.getUTCFullYear();
                      const month = date.getUTCMonth();
                      const day = date.getUTCDate();
                      const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
                      return `${year}년 ${monthNames[month]} ${day}일`;
                    })() : ''}
                  </Text>
                  <Text className="text-xs text-gray-500 mr-2">
                    {lifeEvent.nickname || getEmailPrefix(lifeEvent.author)}
                  </Text>
                  <Text className="text-xs text-gray-500">👁️ {lifeEvent.views || 0}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* 페이지네이션 버튼 */}
          <View className="flex-row justify-center items-center" style={{ paddingTop: 16 }}>
            <TouchableOpacity
              onPress={() => handleLifeEventPageChange(Math.max(1, currentLifeEventPage - 1))}
              disabled={currentLifeEventPage === 1}
              className={`px-4 py-2 mx-1 rounded ${
                currentLifeEventPage === 1 ? 'opacity-50 bg-gray-200' : 'bg-gray-200'
              }`}
            >
              <Text className={`text-sm ${
                currentLifeEventPage === 1 ? 'text-gray-400' : 'text-gray-700'
              }`}>
                이전
              </Text>
            </TouchableOpacity>

            {/* 페이지 번호 버튼들 - 최대 4개만 표시 */}
            {(() => {
              const maxVisiblePages = 4;
              let pagesToShow = [];
              
              if (totalLifeEventPages <= maxVisiblePages) {
                // 전체 페이지가 4개 이하: 모두 표시
                pagesToShow = Array.from({ length: totalLifeEventPages }, (_, i) => i + 1);
              } else {
                // 전체 페이지가 5개 이상: 현재 페이지 중심으로 4개만 표시
                let startPage = Math.max(1, currentLifeEventPage - 1);
                let endPage = Math.min(totalLifeEventPages, startPage + maxVisiblePages - 1);
                
                // 끝에 가까우면 시작점 조정
                if (endPage - startPage < maxVisiblePages - 1) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }
                
                pagesToShow = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
              }
              
              return pagesToShow.map((pageNum) => (
                <TouchableOpacity
                  key={pageNum}
                  onPress={() => handleLifeEventPageChange(pageNum)}
                  className="px-4 py-2 mx-1 rounded min-w-[40px] items-center"
                  style={{
                    backgroundColor: currentLifeEventPage === pageNum ? colors.primary : '#E5E7EB'
                  }}
                >
                  <Text className={`text-sm font-medium ${
                    currentLifeEventPage === pageNum ? 'text-white' : 'text-gray-700'
                  }`}>
                    {pageNum}
                  </Text>
                </TouchableOpacity>
              ));
            })()}

            <TouchableOpacity
              onPress={() => handleLifeEventPageChange(Math.min(totalLifeEventPages, currentLifeEventPage + 1))}
              disabled={currentLifeEventPage >= totalLifeEventPages}
              className={`px-4 py-2 mx-1 rounded ${
                currentLifeEventPage >= totalLifeEventPages ? 'opacity-50 bg-gray-200' : 'bg-gray-200'
              }`}
            >
              <Text className={`text-sm ${
                currentLifeEventPage >= totalLifeEventPages ? 'text-gray-400' : 'text-gray-700'
              }`}>
                다음
              </Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>

        </ScrollView>
        <GlobalPopup routeName="home" />
        
        {/* 학교 선택 모달 (관리자 모드용) - LoginScreen과 동일한 구조 */}
        {showUniSelection && (
          <Modal
            visible={showUniSelection}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowUniSelection(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={1}
              onPress={() => setShowUniSelection(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl"
                style={{ 
                  width: `${adminModalWidthPercent}%`, 
                  maxWidth: adminModalMaxWidth,
                  paddingTop: adminModalPaddingTop,
                  paddingBottom: adminModalPaddingBottom,
                  paddingLeft: adminModalPaddingLeft,
                  paddingRight: adminModalPaddingRight,
                  minHeight: calculateAdminModalHeight(),
                }}
              >
                <Text className="text-xl font-bold mb-6 text-center" style={{ color: LOGIN_COLORS.primary }}>
                  Admin University
                </Text>
                
                <View style={{ 
                  flexDirection: 'row', 
                  flexWrap: 'wrap', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  gap: adminSlotGap,
                  rowGap: adminSlotGap,
                  width: '100%',
                }}>
                  {adminSlotImages.map((imageSource, index) => {
                    // 아이콘 파일명은 항상 {소문자학교이름}-icon.png 형식 (예: cornell-icon.png, nyu-icon.png)
                    const imageName = getConfig(`login_admin_slot_${index + 1}_image`, '');
                    let universityCode = null; // users 테이블에 저장할 소문자 코드
                    let universityDisplayName = null; // 표시용 display name
                    if (imageName) {
                      // 파일명에서 소문자 코드 추출 (예: cornell-icon.png -> cornell)
                      universityCode = imageName.split('-')[0].toLowerCase();
                      // display_name config 확인하여 표시용 이름 가져오기
                      const displayName = getConfig(`${universityCode}_display_name`, '');
                      universityDisplayName = displayName || universityCode.charAt(0).toUpperCase() + universityCode.slice(1);
                    }
                    
                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={async () => {
                          if (universityCode && universityDisplayName) {
                            try {
                              // 학교 변경 - 먼저 데이터 초기화
                              setSavedNotices([]);
                              setSavedLifeEvents([]);
                              
                              // 표시용 display name 저장
                              await AsyncStorage.setItem('currentUserUniversity', universityDisplayName);
                              await updateUniversity(universityDisplayName);
                              
                              // 즉시 데이터 다시 불러오기 (university 변경 후)
                              // 약간의 지연을 두어 updateUniversity가 완료되도록 함
                              setTimeout(async () => {
                                try {
                                  const noticesResponse = await fetch(`${API_BASE_URL}/api/notices?university=${encodeURIComponent(universityCode)}`);
                                  if (noticesResponse.ok) {
                                    const noticesData = await noticesResponse.json();
                                    if (noticesData.success && noticesData.notices) {
                                      setSavedNotices(noticesData.notices);
                                    }
                                  }
                                  
                                  const lifeEventsResponse = await fetch(`${API_BASE_URL}/api/life-events?university=${encodeURIComponent(universityCode)}`);
                                  if (lifeEventsResponse.ok) {
                                    const lifeEventsData = await lifeEventsResponse.json();
                                    if (lifeEventsData.success && lifeEventsData.lifeEvents) {
                                      setSavedLifeEvents(lifeEventsData.lifeEvents);
                                    }
                                  }
                                } catch (error) {
                                  // 에러 처리
                                }
                              }, 100);
                              
                              setShowUniSelection(false);
                            } catch (error) {
                              setShowUniSelection(false);
                            }
                          }
                        }}
                        style={{ alignItems: 'center', justifyContent: 'center' }}
                        activeOpacity={0.7}
                        disabled={!imageSource || !universityCode || !universityDisplayName}
                      >
                        <View
                          style={{
                            width: adminSlotWidth,
                            height: adminSlotHeight,
                            borderRadius: adminSlotBorderRadius,
                            borderWidth: imageSource ? 0 : adminSlotBorderWidth,
                            borderColor: adminSlotBorderColor,
                            borderStyle: adminSlotBorderStyle,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: adminSlotBackgroundColor,
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
            </TouchableOpacity>
          </Modal>
        )}
        </>
      );
    }
