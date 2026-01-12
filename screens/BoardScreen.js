import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, TextInput, Alert, Modal, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import API_BASE_URL from '../config/api';
import { useUniversity } from '../contexts/UniversityContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { getUniColors } from '../utils/uniColors';
import GlobalPopup from '../components/GlobalPopup';

export default function BoardScreen({ navigation, route }) {
  const { university } = useUniversity();
  const { getConfig, getConfigNumber, getColorConfig, config: appConfig, loadConfig } = useAppConfig();
  const config = { getColorConfig };
  
  // selectedChannel에 따라 색상 결정
  // route.params에서 selectedChannel을 받으면 그것을 사용, 없으면 university 사용
  const [selectedChannel, setSelectedChannel] = useState(
    route?.params?.selectedChannel || university || null
  );
  
  // university가 변경되면 selectedChannel도 업데이트 (route.params.selectedChannel이 없을 때만)
  // 단, 사용자가 직접 MIUHub를 선택한 경우에는 university로 덮어쓰지 않음
  useEffect(() => {
    // route.params.selectedChannel이 있으면 무시 (사용자가 직접 선택한 경우)
    if (route?.params?.selectedChannel) {
      return;
    }
    
    // selectedChannel이 'MIUHub'인 경우 university로 덮어쓰지 않음
    if (selectedChannel === 'MIUHub') {
      return;
    }
    
    if (university) {
      setSelectedChannel(university);
    } else if (!university) {
      setSelectedChannel(null);
    }
  }, [university, route?.params?.selectedChannel, selectedChannel]);
  
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
  
  // selectedChannel 변경 추적용 ref
  const selectedChannelRef = useRef(selectedChannel);
  
  // selectedChannel이 변경되면 즉시 해당 채널의 캐시 확인 및 표시
  useEffect(() => {
    const prevChannel = selectedChannelRef.current;
    
    // selectedChannel이 실제로 변경되었을 때만 실행
    if (prevChannel === selectedChannel) {
      return;
    }
    
    // selectedChannelRef를 먼저 업데이트 (useFocusEffect가 실행되기 전에)
    selectedChannelRef.current = selectedChannel;
    
    // 채널이 변경되면 즉시 이전 데이터 초기화 (깜빡임 방지)
    setSavedPosts([]);
    
    // 채널이 변경되면 캐시 무시하고 새로 로드 (MIUHub <-> 학교 탭 전환 시)
    loadPostsData(true);
  }, [selectedChannel, university]);
  
  const uniColors = useMemo(() => getUniColors(targetUniversity, config), [targetUniversity, getColorConfig, appConfig]);
  
  const colors = useMemo(() => ({
    primary: uniColors.primary,
    buttonTextColor: uniColors.buttonTextColor,
  }), [uniColors]);
  const [activeTab, setActiveTab] = useState('전체');
  const tabs = useMemo(() => {
    const tabs = ['전체'];
    const tab1 = getConfig('board_tab1');
    const tab2 = getConfig('board_tab2');
    const tab3 = getConfig('board_tab3');
    const tab4 = getConfig('board_tab4');
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
    if (!tabs.includes(activeTab)) {
      setActiveTab('전체');
    }
  }, [tabs, activeTab]);
  const itemsPerPage = getConfigNumber('board_items_per_page', 10);
  const [savedPosts, setSavedPosts] = useState([]);
  const [favoritePosts, setFavoritePosts] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  
  // 필터링 상태
  const [titleSearch, setTitleSearch] = useState('');
  const [contentSearch, setContentSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showPartnersModal, setShowPartnersModal] = useState(false);

  // Partners 모달 자동 닫기 타이머
  const partnersAutoCloseSeconds = getConfigNumber('partners_modal_auto_close_seconds', 1) * 1000;
  useEffect(() => {
    let timer;
    if (showPartnersModal) {
      timer = setTimeout(() => {
        setShowPartnersModal(false);
        setSelectedChannel('MIUHub');
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


  // 토스트 메시지 표시
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 2000);
  };

  // 관심리스트 토글
  const toggleFavorite = async (postId, event) => {
    if (event) event.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const userId = await AsyncStorage.getItem('currentUserId') || 'guest';
      // selectedChannel에 따라 다른 storage key 사용
      const storageKey = selectedChannel === 'MIUHub' 
        ? `favoritePosts_miuhub_${userId}`
        : `favoritePosts_${userId}`;
      
      const favorites = await AsyncStorage.getItem(storageKey);
      let favoriteList = favorites ? JSON.parse(favorites) : [];
      const postIdNum = parseInt(postId);

      if (favoriteList.includes(postIdNum)) {
        favoriteList = favoriteList.filter(id => id !== postIdNum);
        showToast('관심리스트에서 제거되었습니다.');
      } else {
        if (!favoriteList.includes(postIdNum)) {
          favoriteList.push(postIdNum);
        }
        showToast('관심리스트에 추가되었습니다.');
      }
      await AsyncStorage.setItem(storageKey, JSON.stringify(favoriteList));
      setFavoritePosts(favoriteList);
    } catch (error) {
      showToast('오류가 발생했습니다.');
    }
  };

  // Posts 데이터 로드 함수 (뷰수/댓글수는 캐시 안 쓰고 항상 최신)
  const loadPostsData = React.useCallback(async (forceRefresh = false) => {
      // selectedChannelRef를 사용하여 최신 값 확인 (클로저 문제 방지)
      const currentSelectedChannel = selectedChannelRef.current;
      // selectedChannel이 MIUHub이면 miuhub 테이블 사용, 아니면 university 사용
      const targetUni = currentSelectedChannel === 'MIUHub' ? 'miuhub' : (university || null);
      
      if (!targetUni || !targetUni.trim()) {
        setSavedPosts([]);
        return;
      }

      try {
        const universityCode = targetUni.toLowerCase();
        const cacheKey = `posts_${universityCode}`;
        const cacheTimestampKey = `posts_timestamp_${universityCode}`;
        const CACHE_DURATION = 2 * 60 * 1000; // 2분
        const now = Date.now();
        
        // forceRefresh가 true이면 캐시 무시하고 바로 API 호출
        if (forceRefresh) {
        } else {
          // 캐시 확인 (뷰수/댓글수는 제외하고 나머지만 캐시 사용)
          const cachedData = await AsyncStorage.getItem(cacheKey);
          const cachedTimestamp = await AsyncStorage.getItem(cacheTimestampKey);
          
          // 캐시가 있고 2분 이내면 캐시 먼저 표시하고 백그라운드에서 뷰수/댓글수 업데이트
          if (cachedData && cachedTimestamp && (now - parseInt(cachedTimestamp, 10)) < CACHE_DURATION) {
            const cachedPosts = JSON.parse(cachedData);
            
            // 캐시된 데이터를 즉시 표시 (빠른 응답)
            setSavedPosts(cachedPosts);
            
            // 백그라운드에서 뷰수/댓글수만 최신 데이터로 업데이트
            fetch(`${API_BASE_URL}/api/posts?university=${encodeURIComponent(universityCode)}`, {
              headers: { 'Cache-Control': 'no-cache' }
            })
              .then(async response => {
                if (response.ok) {
                  const responseText = await response.text();
                  try {
                    return JSON.parse(responseText);
                  } catch (e) {
                    return null;
                  }
                }
                return null;
              })
              .then(postsData => {
                if (postsData && postsData.success && postsData.posts) {
                  // 캐시된 데이터와 최신 데이터를 병합 (뷰수와 댓글수 업데이트)
                  const updatedPosts = cachedPosts.map(cachedPost => {
                    const latestPost = postsData.posts.find(p => p.id === cachedPost.id);
                    if (latestPost) {
                      return {
                        ...cachedPost,
                        views: latestPost.views,
                        commentCount: latestPost.commentCount || 0
                      };
                    }
                    return cachedPost;
                  });
                  setSavedPosts(updatedPosts);
                  // 업데이트된 데이터를 캐시에 저장
                  AsyncStorage.setItem(cacheKey, JSON.stringify(updatedPosts)).catch(() => {});
                }
              })
              .catch(() => {
                // 백그라운드 업데이트 실패는 무시 (이미 캐시된 데이터 표시됨)
              });
            
            return; // 캐시 사용 시 여기서 종료
          }
        }
        
        // 캐시가 없거나 만료되었거나 forceRefresh이면 새로 로드
        const postsResponse = await fetch(`${API_BASE_URL}/api/posts?university=${encodeURIComponent(universityCode)}`);
        if (postsResponse.ok) {
          // 응답 텍스트를 받는 즉시 파싱 (성능 최적화)
          const postsText = await postsResponse.text();
          try {
            const postsData = JSON.parse(postsText);
            if (postsData.success && postsData.posts) {
              setSavedPosts(postsData.posts);
              // 캐시 저장 (비동기, 블로킹하지 않음)
              AsyncStorage.setItem(cacheKey, JSON.stringify(postsData.posts)).catch(() => {});
              AsyncStorage.setItem(cacheTimestampKey, now.toString()).catch(() => {});
            } else {
              setSavedPosts([]);
            }
          } catch (parseError) {
            setSavedPosts([]);
          }
        } else {
          await postsResponse.text().catch(() => '');
          // 오류 시 캐시된 데이터가 있으면 사용
          const errorCachedData = await AsyncStorage.getItem(cacheKey);
          if (errorCachedData) {
            setSavedPosts(JSON.parse(errorCachedData));
          } else {
            setSavedPosts([]);
          }
        }
      } catch (error) {
        // 에러 발생 시 캐시된 데이터가 있으면 사용
        try {
          const cacheKey = `posts_${targetUni.toLowerCase()}`;
          const cachedData = await AsyncStorage.getItem(cacheKey);
          if (cachedData) {
            setSavedPosts(JSON.parse(cachedData));
          } else {
            setSavedPosts([]);
          }
        } catch {
          setSavedPosts([]);
        }
      }
  }, [university, selectedChannel]);

  // university 또는 selectedChannel이 변경될 때마다 Posts 데이터 불러오기
  // 초기 로드 (캐시 확인)
  useEffect(() => {
    loadPostsData();
  }, [loadPostsData]);


  // 관심리스트 로드 함수
  const loadFavoritePosts = React.useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem('currentUserId') || 'guest';
      const storageKey = selectedChannel === 'MIUHub' 
        ? `favoritePosts_miuhub_${userId}`
        : `favoritePosts_${userId}`;
      
      const favorites = await AsyncStorage.getItem(storageKey);
      if (favorites) {
        const favoriteList = JSON.parse(favorites);
        setFavoritePosts(favoriteList);
      } else {
        setFavoritePosts([]);
      }
    } catch (error) {
      setFavoritePosts([]);
    }
  }, [selectedChannel]);

  // selectedChannel이 변경될 때마다 관심리스트 로드
  useEffect(() => {
    loadFavoritePosts();
  }, [loadFavoritePosts]);

  // 화면이 포커스될 때마다 route.params에서 selectedChannel 업데이트 및 데이터 새로고침
  const intervalRef = useRef(null);
  const modalJustClosedRef = useRef(false);
  
  // 모달이 닫힐 때 추적
  useEffect(() => {
    if (!showPartnersModal) {
      // 모달이 닫혔다는 것을 표시 (다음 useFocusEffect 실행 시 차단)
      modalJustClosedRef.current = true;
      // 짧은 시간 후 리셋 (모달이 닫힌 후 useFocusEffect가 실행될 시간을 줌)
      setTimeout(() => {
        modalJustClosedRef.current = false;
      }, 100);
    }
  }, [showPartnersModal]);
  
  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      
      // selectedChannelRef를 최신 값으로 업데이트 (useEffect보다 먼저 실행될 수 있음)
      const lastSelectedChannel = selectedChannelRef.current;
      const currentSelectedChannel = selectedChannel;
      
      // selectedChannel이 변경되었다면 selectedChannelRef를 즉시 업데이트
      if (lastSelectedChannel !== currentSelectedChannel) {
        selectedChannelRef.current = currentSelectedChannel;
        // selectedChannel이 변경되었으므로 refreshData를 완전히 스킵 (loadPostsData가 처리함)
        return () => {
          isMounted = false;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        };
      }
      
      // 모달이 방금 닫혔다면 refreshData를 실행하지 않음 (loadPostsData가 이미 처리함)
      if (modalJustClosedRef.current) {
        modalJustClosedRef.current = false; // 리셋
        return () => {
          isMounted = false;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        };
      }
      
      // refreshFeatured 파라미터가 있으면 (제거됨 - featured 로직 제거)
      if (route?.params?.refreshFeatured) {
        // 파라미터 제거 (다음 포커스 시 다시 실행되지 않도록)
        navigation.setParams({ refreshFeatured: undefined });
      }
      
      // 화면 포커스 시 config 새로고침 (캐시 무시)
      // university를 직접 사용하여 admin으로 학교 변경 시 즉시 반영되도록 함
      if (university) {
        loadConfig(university, true);
      } else {
        loadConfig(null, true);
      }
      
      const refreshData = async () => {
      
      // route.params에서 selectedChannel이 전달되었을 때만 업데이트
        let currentChannel = currentSelectedChannel; // selectedChannelRef의 최신 값 사용
        
        // route.params가 있고 selectedChannel과 다를 때만 업데이트
        if (route?.params?.selectedChannel && route.params.selectedChannel !== currentSelectedChannel) {
          setSelectedChannel(route.params.selectedChannel);
          currentChannel = route.params.selectedChannel; // 업데이트된 값 사용
        }
        
        // currentChannel에 따라 targetUni 결정
        const targetUni = currentChannel === 'MIUHub' ? 'miuhub' : (university || null);
        
        if (!targetUni) {
          if (isMounted) {
            setSavedPosts([]);
          }
          return;
        }

        try {
          const universityCode = targetUni.toLowerCase();
          const cacheKey = `posts_${universityCode}`;
          const cacheTimestampKey = `posts_timestamp_${universityCode}`;
          const now = Date.now();
          const CACHE_DURATION = 2 * 60 * 1000; // 2분
          
          // 캐시 확인
          const cachedData = await AsyncStorage.getItem(cacheKey);
          const cachedTimestamp = await AsyncStorage.getItem(cacheTimestampKey);
          
          // 캐시가 있고 2분 이내면 기존 데이터 유지하고 새로운 것만 추가, 뷰수 업데이트
          if (cachedData && cachedTimestamp && (now - parseInt(cachedTimestamp, 10)) < CACHE_DURATION && isMounted) {
            const cachedPosts = JSON.parse(cachedData);
            // 기존 데이터의 가장 최신 created_at 찾기 (새로운 항목만 가져오기 위해)
            const latestCreatedAt = cachedPosts.length > 0 
              ? Math.max(...cachedPosts.map(p => new Date(p.created_at || 0).getTime()))
              : 0;
            
            // 기존 데이터 유지 (빈 배열로 초기화하지 않음)
            // 새로운 항목만 가져오고 뷰수/댓글수 업데이트
            const sinceParam = latestCreatedAt > 0 ? `&since=${latestCreatedAt}` : '';
            fetch(`${API_BASE_URL}/api/posts?university=${encodeURIComponent(universityCode)}${sinceParam}`, {
              headers: { 'Cache-Control': 'no-cache' }
            })
              .then(async response => {
                if (response.ok && isMounted) {
                  const responseText = await response.text();
                  try {
                    const postsData = JSON.parse(responseText);
                    if (postsData && postsData.success && postsData.posts) {
                      // 기존 posts의 ID 집합 생성 (중복 체크용)
                      const existingIds = new Set(cachedPosts.map(p => p.id));
                      
                      // 새로운 항목만 필터링 (기존에 없는 것만)
                      const newPosts = postsData.posts.filter(p => !existingIds.has(p.id));
                      
                      // 기존 항목의 뷰수와 댓글수 업데이트
                      const updatedPosts = cachedPosts.map(cachedPost => {
                        const latestPost = postsData.posts.find(p => p.id === cachedPost.id);
                        if (latestPost) {
                          return {
                            ...cachedPost,
                            views: latestPost.views,
                            commentCount: latestPost.commentCount || 0
                          };
                        }
                        return cachedPost;
                      });
                      
                      // 새로운 항목을 앞에 추가 (최신순 유지)
                      const finalPosts = [...newPosts, ...updatedPosts];
                      
                      if (isMounted) {
                        setSavedPosts(finalPosts);
                        AsyncStorage.setItem(cacheKey, JSON.stringify(finalPosts)).catch(() => {});
                      }
                    }
                  } catch (e) {
                    // 파싱 오류는 무시 (기존 데이터 유지)
                  }
                }
              })
              .catch(() => {
                // 오류는 무시 (기존 데이터 유지)
              });
            return; // 캐시가 있으면 여기서 종료
          }
          
          // 캐시가 없거나 만료되었으면 새로 로드 (기존 데이터는 유지)
          const postsResponse = await fetch(`${API_BASE_URL}/api/posts?university=${encodeURIComponent(universityCode)}`);
          if (postsResponse.ok && isMounted) {
            const postsText = await postsResponse.text();
            try {
              const postsData = JSON.parse(postsText);
              if (postsData.success && postsData.posts) {
                setSavedPosts(postsData.posts);
                // 캐시 저장
                AsyncStorage.setItem(cacheKey, JSON.stringify(postsData.posts)).catch(() => {});
                AsyncStorage.setItem(cacheTimestampKey, now.toString()).catch(() => {});
              } else if (isMounted) {
                // 데이터가 없으면 기존 데이터 유지 (빈 배열로 초기화하지 않음)
                if (!cachedData) {
                  setSavedPosts([]);
                }
              }
            } catch (parseError) {
              // 파싱 오류 시 기존 데이터 유지
              if (!cachedData && isMounted) {
                setSavedPosts([]);
              }
            }
          } else if (isMounted) {
            // 오류 시 기존 데이터 유지 (빈 배열로 초기화하지 않음)
            if (!cachedData) {
              setSavedPosts([]);
            }
          }
        } catch (error) {
          // 오류 시 캐시된 데이터가 있으면 사용
          if (isMounted) {
            const cacheKey = `posts_${targetUni.toLowerCase()}`;
            const cachedData = await AsyncStorage.getItem(cacheKey).catch(() => null);
            if (!cachedData) {
              setSavedPosts([]);
            }
          }
        }
        
        // 관심리스트 다시 로드
        try {
          const userId = await AsyncStorage.getItem('currentUserId') || 'guest';
          const storageKey = currentChannel === 'MIUHub' 
            ? `favoritePosts_miuhub_${userId}`
            : `favoritePosts_${userId}`;
          
          const favorites = await AsyncStorage.getItem(storageKey);
          if (isMounted) {
            if (favorites) {
              const favoriteList = JSON.parse(favorites);
              setFavoritePosts(favoriteList);
            } else {
              setFavoritePosts([]);
            }
          }
        } catch (error) {
          if (isMounted) {
            setFavoritePosts([]);
          }
        }
      };
      
      // selectedChannel이 변경 중이 아닐 때만 즉시 새로고침
      // selectedChannel 변경은 loadPostsData가 처리하므로 refreshData는 스킵
      // 또한 화면이 이미 포커스되어 있고 selectedChannel이 변경되지 않았을 때만 실행
      const shouldRefresh = !route?.params?.selectedChannel || route.params.selectedChannel === selectedChannel;
      if (shouldRefresh) {
        refreshData();
      }
      
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
    }, [route?.params?.selectedChannel, university, loadConfig, selectedChannel])
  );

  // API에서 불러온 게시글만 사용
  const allPosts = savedPosts;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handlePageChange = (newPage) => {
    setPageByTab(prev => ({
      ...prev,
      [activeTab]: newPage,
    }));
  };

  // 필터링 로직 (카테고리, 제목 검색, 내용 검색) - useMemo로 변경하여 activeTab 변경 시 즉시 재계산
  const filteredPosts = useMemo(() => {
    // 카테고리 필터
    let filtered = activeTab === '전체'
      ? allPosts
      : allPosts.filter(post => post.category === activeTab);
    
    // 관심리스트 필터
    if (showFavoritesOnly) {
      filtered = filtered.filter(post => favoritePosts.includes(parseInt(post.id)));
    }
    
    // 제목 검색
    if (titleSearch.trim()) {
      const searchTerm = titleSearch.trim().toLowerCase();
      filtered = filtered.filter(post => {
        return post.title && post.title.toLowerCase().includes(searchTerm);
      });
    }
    
    // 내용 검색
    if (contentSearch.trim()) {
      const searchTerm = contentSearch.trim().toLowerCase();
      filtered = filtered.filter(post => {
        return post.text_content && post.text_content.toLowerCase().includes(searchTerm);
      });
    }
    
    // 최신순 정렬 (기본)
    filtered.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // 최신순
    });
    
    return filtered;
  }, [allPosts, activeTab, titleSearch, contentSearch, showFavoritesOnly, favoritePosts, getConfig]);

  // 페이지네이션
  const currentPage = pageByTab[activeTab] || 1;
  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  let posts = filteredPosts.slice(startIndex, endIndex);

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
              // MIUHub 선택과 동시에 데이터 로드 시작 (selectedChannel 변경 시 useEffect에서 자동으로 loadPostsData 호출됨)
              setSelectedChannel('MIUHub');
              setPageByTab(prev => ({
                ...prev,
                [activeTab]: 1,
              }));
              // 모달은 별도로 열기 (데이터 로드와 동시에)
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
            <Text className="text-xl font-bold" style={{ color: colors.primary }}>📌 Board</Text>
            <View className="flex-row items-center">
              <Text className="text-sm font-bold mr-2" style={{ color: colors.primary }}>게시판 글쓰기</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('WriteBoard', { selectedChannel })}
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

          {/* 제목 검색, 내용 검색 - 탭 위, 나란히 배치 */}
          <View className="mb-4" style={{ flexDirection: 'row', gap: 8 }}>
            {/* 제목 검색 */}
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
            }}>
              <TextInput
                placeholder="제목 검색"
                placeholderTextColor="#9ca3af"
                value={titleSearch}
                onChangeText={setTitleSearch}
                style={{ 
                  flex: 1, 
                  fontSize: 12,
                  color: '#374151',
                  paddingVertical: 0,
                  paddingHorizontal: 0,
                  ...(Platform.OS === 'android' ? {
                    textAlignVertical: 'center',
                    includeFontPadding: false,
                    lineHeight: 12,
                    height: 20,
                  } : {
                    lineHeight: 14,
                    paddingTop: 1,
                    paddingBottom: 1,
                  }),
                }}
              />
            </View>
            
            {/* 내용 검색 */}
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
            }}>
              <TextInput
                placeholder="내용 검색"
                placeholderTextColor="#9ca3af"
                value={contentSearch}
                onChangeText={setContentSearch}
                style={{ 
                  flex: 1, 
                  fontSize: 12,
                  color: '#374151',
                  paddingVertical: 0,
                  paddingHorizontal: 0,
                  ...(Platform.OS === 'android' ? {
                    textAlignVertical: 'center',
                    includeFontPadding: false,
                    lineHeight: 12,
                    height: 20,
                  } : {
                    lineHeight: 14,
                    paddingTop: 1,
                    paddingBottom: 1,
                  }),
                }}
              />
            </View>
          </View>

          {/* 탭 버튼 */}
          <View className="flex-row mb-4 border-b border-gray-200">
            {tabs.map((tab, index) => (
              <TouchableOpacity
                key={`board-tab-${index}-${tab}`}
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

          {/* 게시글 리스트 - 경조사와 동일한 스타일 */}
          <View style={{ flex: 1 }}>
            {posts.map((post, index) => {
                const isFavorite = favoritePosts.includes(parseInt(post.id));
                return (
                  <TouchableOpacity 
                    key={post.adId || post.id} 
                    className={`bg-gray-50 rounded-lg ${index < posts.length - 1 ? 'mb-3' : ''}`}
                    style={{ padding: 16 }}
                    onPress={() => navigation.navigate('ViewBoard', { postId: post.id, selectedChannel })}
                  >
                    {/* 제목 */}
                    <View className="flex-row items-start justify-between" style={{ marginBottom: 8 }}>
                      <View className="flex-row items-center" style={{ flex: 1, marginRight: 8 }}>
                        {post.isAd && (
                          <View 
                            style={{ 
                              borderWidth: 1,
                              borderColor: selectedChannel === 'MIUHub' 
                                ? miuhubColors.border
                                : '#D1D5DB',
                              paddingHorizontal: 4,
                              paddingVertical: 1,
                              borderRadius: 3,
                              marginRight: 6,
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
                        )}
                        <Text className="text-base font-bold text-gray-900" numberOfLines={2} style={{ lineHeight: 20, flex: 1 }}>
                          {post.title}
                        </Text>
                      </View>
                      <Text className="text-xs text-gray-500" style={{ flexShrink: 0 }}>
                        {post.nickname || '🐾'}
                      </Text>
                    </View>
                    
                    {/* 메타 정보 */}
                    <View className="flex-row items-center justify-between">
                      {/* 날짜 - 왼쪽 정렬 */}
                      <Text className="text-xs text-gray-500">
                        {post.created_at ? (() => {
                          // UTC 날짜를 그대로 사용하여 날짜만 표시 (시간대 변환 없이)
                          const date = new Date(post.created_at);
                          const year = date.getUTCFullYear();
                          const month = date.getUTCMonth();
                          const day = date.getUTCDate();
                          const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
                          return `${year}년 ${monthNames[month]} ${day}일`;
                        })() : ''}
                      </Text>
                      {/* 하트, 뷰수, 댓글수 - 오른쪽 정렬 */}
                      <View className="flex-row items-center">
                        <TouchableOpacity
                          onPress={(e) => toggleFavorite(post.id, e)}
                          style={{ marginRight: 4 }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={{ fontSize: 12 }}>
                            {isFavorite ? '❤️' : '🤍'}
                          </Text>
                        </TouchableOpacity>
                        <Text className="text-xs text-gray-500" style={{ marginRight: 4 }}>👁️ {post.views || 0}</Text>
                        <Text className="text-xs text-gray-500">💬 {post.commentCount || 0}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
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
          setSelectedChannel('MIUHub');
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
              setSelectedChannel('MIUHub');
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
                      setSelectedChannel('MIUHub');
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
      <GlobalPopup routeName="board" />
    </View>
  );
}
