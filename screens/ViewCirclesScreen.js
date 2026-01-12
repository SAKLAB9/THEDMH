import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, Alert, TouchableOpacity, Dimensions, Linking, TextInput, Modal, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import API_BASE_URL from '../config/api';
import { useUniversity } from '../contexts/UniversityContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { getUniColors } from '../utils/uniColors';
import { getEmailPrefix } from '../config/supabase';

const { width: screenWidth } = Dimensions.get('window');

function ImageBlock({ uri }) {
  // ScrollView px-6 (24px * 2) + 내용 영역 p-3 (12px * 2) = 72px
  const contentPadding = 72;
  const maxImageWidth = screenWidth - contentPadding;
  const [imageSize, setImageSize] = useState({ width: maxImageWidth, height: 200 });

  // 이미지 URI를 절대 경로로 변환 및 경로 수정
  const getImageUri = (uri) => {
    if (!uri) return null;
    
    // data: URL은 그대로 반환
    if (uri.startsWith('data:')) {
      return uri;
    }
    
    // Supabase Storage URL인 경우 경로 수정 및 이미지 최적화
    if (uri.includes('supabase.co/storage/v1/object/public/images/')) {
      // /images/nyu/images/ -> /images/nyu/ 로 수정 (중복된 /images/ 제거)
      // 또는 /images/nyu/board_images/ -> /images/nyu/ 로 수정
      // 또는 /images/nyu/circle_images/ -> /images/nyu/ 로 수정
      let fixedUri = uri.replace(/\/images\/([^\/]+)\/images\//g, '/images/$1/');
      fixedUri = fixedUri.replace(/\/images\/([^\/]+)\/board_images\//g, '/images/$1/');
      fixedUri = fixedUri.replace(/\/images\/([^\/]+)\/circle_images\//g, '/images/$1/');
      
      // 슬래시 중복 제거 (// -> /) - 하지만 https://는 유지
      fixedUri = fixedUri.replace(/([^:])\/+/g, '$1/');
      
      // 이미지 최적화 파라미터 추가
      // 모바일 화면에 맞춰 400px로 설정 (매우 빠른 로딩)
      // 일반 모바일 폭(375-414px)과 비슷하지만 충분히 선명함
      const optimizedWidth = 400;
      const optimizedQuality = 75;
      
      // 기존 쿼리 파라미터가 있으면 &로 추가, 없으면 ?로 시작
      if (fixedUri.includes('?')) {
        fixedUri += `&width=${optimizedWidth}&quality=${optimizedQuality}`;
      } else {
        fixedUri += `?width=${optimizedWidth}&quality=${optimizedQuality}`;
      }
      
      return fixedUri;
    }
    
    // 이미 절대 경로인 경우 (http://, https://)
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return uri;
    }
    
    // 상대 경로인 경우 절대 경로로 변환
    if (uri.startsWith('/')) {
      return `${API_BASE_URL}${uri}`;
    }
    
    // 그 외의 경우
    return `${API_BASE_URL}/${uri}`;
  };

  const imageUri = getImageUri(uri);

  useEffect(() => {
    if (!imageUri) return;
    
    Image.getSize(imageUri, (width, height) => {
      const aspectRatio = height / width;
      // 가로폭을 내용 박스 안에 맞춤 (비율 유지)
      let displayWidth = maxImageWidth;
      let displayHeight = displayWidth * aspectRatio;
      
      // 세로는 비율에 맞게 자동 조정 (최대 높이 제한 없음)
      setImageSize({ width: displayWidth, height: displayHeight });
    }, (error) => {
      // 에러가 발생해도 기본 크기로 표시 (이미지가 없거나 삭제된 경우)
    });
  }, [imageUri, maxImageWidth]);

  return (
    <View className="relative mb-3" style={{ width: '100%', alignItems: 'center' }}>
      <Image
        source={{ uri: imageUri }}
        style={{ 
          width: imageSize.width, 
          height: imageSize.height, 
          borderRadius: 8,
          maxWidth: '100%'
        }}
        resizeMode="contain"
        onError={() => {}}
      />
    </View>
  );
}

export default function ViewCirclesScreen({ route, navigation }) {
  const { university } = useUniversity();
  const { getConfig, getColorConfig } = useAppConfig();
  const config = { getColorConfig };
  const { circleId, selectedChannel, circlePreview, forceRefresh } = route?.params || {};
  
  // selectedChannel에 따라 university와 색상 결정
  const targetUniversity = useMemo(() => {
    return selectedChannel === 'MIUHub' ? 'miuhub' : (selectedChannel || university || null);
  }, [selectedChannel, university]);
  
  const uniColors = useMemo(() => getUniColors(targetUniversity, config), [targetUniversity, getColorConfig]);
  const colors = useMemo(() => ({
    primary: uniColors.primary,
    buttonTextColor: uniColors.buttonTextColor,
  }), [uniColors]);
  const [circle, setCircle] = useState(null);
  const [loading, setLoading] = useState(false); // 초기 로딩 상태를 false로 변경 (점진적 렌더링)
  const viewsIncrementedRef = useRef(false); // 뷰수 증가 플래그 (한 번만 실행)
  
  // circlePreview가 있으면 즉시 표시 (성능 최적화)
  useEffect(() => {
    if (circlePreview && !circle) {
      // 기본 정보만 있는 preview 데이터로 즉시 표시
      setCircle({
        ...circlePreview,
        content_blocks: [], // 내용은 아직 없음
        images: [] // 이미지도 아직 없음
      });
    }
  }, [circlePreview, circle]);
  
  // 뷰수 증가 함수 (별도 호출, 캐시 무관)
  const incrementViews = React.useCallback(async () => {
    if (!circleId || !targetUniversity || !targetUniversity.trim()) {
      return;
    }
    
    // 중복 호출 방지 (호출 전에 즉시 플래그 설정)
    if (viewsIncrementedRef.current) {
      return;
    }
    
    // 즉시 플래그 설정하여 중복 호출 방지
    viewsIncrementedRef.current = true;
    
    try {
      const universityCode = targetUniversity.toLowerCase();
      
      const response = await fetch(
        `${API_BASE_URL}/api/circles/${circleId}/increment-views?university=${encodeURIComponent(universityCode)}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 뷰수 업데이트 (캐시 무관)
          setCircle(prev => prev ? { ...prev, views: data.views } : prev);
        } else {
          // 실패 시 플래그 리셋
          viewsIncrementedRef.current = false;
        }
      } else {
        // 실패 시 플래그 리셋
        viewsIncrementedRef.current = false;
        // 404 에러는 조용히 처리 (다른 학교로 넘어갔을 때 발생할 수 있음)
      }
    } catch (error) {
      // 실패 시 플래그 리셋
      viewsIncrementedRef.current = false;
    }
  }, [circleId, targetUniversity]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState(null); // 'circle' or 'comment'
  const [reportContentId, setReportContentId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [showAdModal, setShowAdModal] = useState(false);
  const [adCategoryPage, setAdCategoryPage] = useState('1');
  const [adCategoryPosition, setAdCategoryPosition] = useState('1');
  const [adAllPage, setAdAllPage] = useState('1');
  const [adAllPosition, setAdAllPosition] = useState('1');
  const [adStartDate, setAdStartDate] = useState(new Date());
  const [adEndDate, setAdEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [currentFeaturedId, setCurrentFeaturedId] = useState(null);

  useEffect(() => {
    if (!circleId) {
      Alert.alert('오류', '소모임 ID가 없습니다.');
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Main');
      }
      return;
    }
  }, [circleId]);

  // 관심리스트 확인 함수 (selectedChannel 의존성 추가)
  const checkFavorite = React.useCallback(async () => {
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const userId = await AsyncStorage.getItem('currentUserId') || 'guest';
      // selectedChannel에 따라 다른 storage key 사용 (CirclesScreen과 동일)
      const storageKey = selectedChannel === 'MIUHub' 
        ? `favoriteCircles_miuhub_${userId}`
        : `favoriteCircles_${userId}`;
      
      const favorites = await AsyncStorage.getItem(storageKey);
      if (favorites) {
        const favoriteList = JSON.parse(favorites);
        setIsFavorite(favoriteList.includes(parseInt(circleId)));
      } else {
        setIsFavorite(false);
      }
    } catch (error) {
    }
  }, [circleId, selectedChannel]);

  useEffect(() => {
    if (circleId) {
      checkFavorite();
    }
  }, [circleId, checkFavorite]);

  // 현재 로그인한 사용자 ID 불러오기
  const loadCurrentUser = React.useCallback(async () => {
    try {
      // currentUserId를 우선 확인 (admin 체크를 위해)
      const userId = await AsyncStorage.getItem('currentUserId');
      if (userId === 'admin') {
        setCurrentUser('admin');
        return;
      }
      // 일반 사용자는 이메일 또는 userId 사용
      const userEmail = await AsyncStorage.getItem('currentUserEmail') || userId;
      const user = userEmail && userEmail !== 'guest' ? userEmail : null;
      setCurrentUser(user);
    } catch (error) {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  // 초기 로드 (뷰수 증가 포함)
  useEffect(() => {
    viewsIncrementedRef.current = false; // circleId나 targetUniversity가 변경되면 리셋
    if (circleId) {
      loadCircle(false); // 캐시 확인 후 로드
      // 뷰수 증가는 약간의 지연 후 실행 (데이터 로드 완료 후)
      setTimeout(() => {
        incrementViews();
      }, 500);
    }
  }, [circleId, targetUniversity, loadCircle, incrementViews]);
  
  // 화면이 포커스될 때마다 currentUser와 관심리스트 다시 로드
  useFocusEffect(
    React.useCallback(() => {
      loadCurrentUser();
      if (circleId) {
        // 수정 후 돌아왔을 때 데이터 새로고침 (forceRefresh가 true면 강제 새로고침)
        loadCircle(forceRefresh === true);
      }
    }, [loadCurrentUser, circleId, loadCircle, forceRefresh])
  );
  
  // targetUniversity가 변경되면 데이터 초기화 (다른 학교로 넘어갔을 때)
  useEffect(() => {
    if (targetUniversity && targetUniversity.trim()) {
      // targetUniversity가 변경되면 이전 데이터 초기화
      setCircle(null);
      viewsIncrementedRef.current = false;
    }
  }, [targetUniversity]);


  // 댓글 로드 함수
  const loadComments = React.useCallback(async () => {
    if (!circleId || !targetUniversity) {
      return;
    }

    try {
      const universityCode = targetUniversity.toLowerCase();
      
      const commentsResponse = await fetch(`${API_BASE_URL}/api/circles/${circleId}/comments?university=${encodeURIComponent(universityCode)}`);
      
      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json();
        
        if (commentsData.success && commentsData.comments) {
          setComments(commentsData.comments);
        } else {
          setComments([]);
        }
      }
    } catch (error) {
    }
  }, [circleId, targetUniversity]);

  // 저장된 featured 데이터 불러오기
  const loadFeaturedData = React.useCallback(async () => {
    if (!circleId || selectedChannel !== 'MIUHub') {
      // 기본값으로 초기화
      setAdCategoryPage('1');
      setAdCategoryPosition('1');
      setAdAllPage('1');
      setAdAllPosition('1');
      setAdStartDate(new Date());
      setAdEndDate(new Date());
      return;
    }

    try {
      const featuredResponse = await fetch(`${API_BASE_URL}/api/featured?university=miuhub&type=circle`);
      if (featuredResponse.ok) {
        const featuredData = await featuredResponse.json();
        if (featuredData.success && featuredData.featured) {
          // 현재 circleId와 일치하는 featured 찾기
          const currentFeatured = featuredData.featured.find(
            f => f.contentId === parseInt(circleId) && f.type === 'circle'
          );
          
          if (currentFeatured) {
            // 저장된 값으로 상태 업데이트
            setCurrentFeaturedId(currentFeatured.id);
            setAdCategoryPage(String(currentFeatured.categoryPage || '1'));
            setAdCategoryPosition(String(currentFeatured.categoryPosition || '1'));
            setAdAllPage(String(currentFeatured.allPage || '1'));
            setAdAllPosition(String(currentFeatured.allPosition || '1'));
            
            if (currentFeatured.startDate) {
              setAdStartDate(new Date(currentFeatured.startDate));
            }
            if (currentFeatured.endDate) {
              setAdEndDate(new Date(currentFeatured.endDate));
            }
          } else {
            // 저장된 값이 없으면 기본값으로 초기화
            setCurrentFeaturedId(null);
            setAdCategoryPage('1');
            setAdCategoryPosition('1');
            setAdAllPage('1');
            setAdAllPosition('1');
            setAdStartDate(new Date());
            setAdEndDate(new Date());
          }
        }
      }
    } catch (error) {
      // 에러 발생 시 기본값으로 초기화
      setAdCategoryPage('1');
      setAdCategoryPosition('1');
      setAdAllPage('1');
      setAdAllPosition('1');
      setAdStartDate(new Date());
      setAdEndDate(new Date());
    }
  }, [circleId, selectedChannel]);

  // 소모임 데이터 로드 함수 (content_blocks와 images만 로드)
  const loadCircle = React.useCallback(async (forceRefresh = false) => {
      if (!circleId || !targetUniversity || !targetUniversity.trim()) {
        return;
      }

      // circlePreview가 있으면 기본 정보는 이미 표시되므로 content만 로드
      if (circlePreview && !forceRefresh) {
        setLoading(false);
      } else {
        setLoading(true);
      }
      
      try {
        const universityCode = targetUniversity.toLowerCase();
        
        if (!universityCode || !universityCode.trim()) {
          Alert.alert('오류', '대학 정보가 없습니다.');
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Main');
          }
          setLoading(false);
          return;
        }
        
        const cacheKey = `circle_${circleId}_${universityCode}`;
        const contentCacheKey = `circle_content_${circleId}_${universityCode}`;
        
        // 캐시 확인 (circlePreview가 없을 때만)
        if (!forceRefresh && !circlePreview) {
          const cachedData = await AsyncStorage.getItem(cacheKey);
          if (cachedData) {
            try {
              const { circle: cachedCircle, timestamp } = JSON.parse(cachedData);
              const CACHE_DURATION = 5 * 60 * 1000; // 5분
              
              if (Date.now() - timestamp < CACHE_DURATION) {
                // 캐시된 데이터가 있으면 즉시 표시
                let parsedCircle = { ...cachedCircle };
                if (parsedCircle.content_blocks && typeof parsedCircle.content_blocks === 'string') {
                  try {
                    parsedCircle.content_blocks = JSON.parse(parsedCircle.content_blocks);
                  } catch (e) {
                    parsedCircle.content_blocks = [];
                  }
                }
                if (!Array.isArray(parsedCircle.content_blocks)) {
                  parsedCircle.content_blocks = [];
                }
                setCircle(parsedCircle);
                setLoading(false);
                
                // 백그라운드에서 최신 데이터 확인
                fetch(`${API_BASE_URL}/api/circles/${circleId}?university=${encodeURIComponent(universityCode)}`)
                  .then(response => {
                    if (response.ok) {
                      return response.json();
                    }
                    return null;
                  })
                  .then(data => {
                    if (data && data.success && data.circle) {
                      let updatedCircle = data.circle;
                      if (updatedCircle.content_blocks && typeof updatedCircle.content_blocks === 'string') {
                        try {
                          updatedCircle.content_blocks = JSON.parse(updatedCircle.content_blocks);
                        } catch (e) {
                          updatedCircle.content_blocks = [];
                        }
                      }
                      if (!Array.isArray(updatedCircle.content_blocks)) {
                        updatedCircle.content_blocks = [];
                      }
                      AsyncStorage.setItem(cacheKey, JSON.stringify({
                        circle: updatedCircle,
                        timestamp: Date.now()
                      })).catch(() => {});
                      setCircle(updatedCircle);
                    }
                  })
                  .catch(() => {});
                
                // 댓글과 관심리스트 로드
                await Promise.all([
                  loadComments(),
                  checkFavorite()
                ]);
                
                return; // 캐시가 있으면 여기서 종료
              }
            } catch (e) {
              // 캐시 파싱 실패 시 계속 진행
            }
          }
        }
        
        // 캐시가 없거나 만료되었으면 API 호출
        const url = `${API_BASE_URL}/api/circles/${circleId}?university=${encodeURIComponent(universityCode)}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const responseText = await response.text();
          
          // 텍스트만 먼저 파싱해서 즉시 표시
          try {
            const data = JSON.parse(responseText);
            
            if (data.success && data.circle) {
              // content_blocks가 JSON 문자열인 경우 파싱
              let fullCircle = { ...data.circle };
              if (fullCircle.content_blocks && typeof fullCircle.content_blocks === 'string') {
                try {
                  fullCircle.content_blocks = JSON.parse(fullCircle.content_blocks);
                } catch (e) {
                  fullCircle.content_blocks = [];
                }
              }
              if (!Array.isArray(fullCircle.content_blocks)) {
                fullCircle.content_blocks = [];
              }
              
              // circlePreview가 있으면 기본 정보는 유지하고 content_blocks와 images만 업데이트
              if (circlePreview && circle) {
                // 텍스트 블록만 먼저 추출해서 즉시 표시
                const textBlocks = fullCircle.content_blocks.filter(block => block.type === 'text');
                
                // 텍스트 블록만 먼저 표시
                setCircle({
                  ...circle,
                  content_blocks: textBlocks,
                  images: [], // 이미지는 나중에
                  text_content: fullCircle.text_content || ''
                });
                
                // 나머지 블록(이미지 포함)은 백그라운드에서 처리
                setTimeout(() => {
                  setCircle({
                    ...circle,
                    content_blocks: fullCircle.content_blocks,
                    images: fullCircle.images || [],
                    text_content: fullCircle.text_content || ''
                  });
                  
                  // content만 별도 캐시에 저장
                  AsyncStorage.setItem(contentCacheKey, JSON.stringify({
                    content: {
                      content_blocks: fullCircle.content_blocks,
                      images: fullCircle.images || [],
                      text_content: fullCircle.text_content || ''
                    },
                    timestamp: Date.now()
                  })).catch(() => {});
                }, 0);
              } else {
                // circlePreview가 없으면 텍스트 블록만 먼저 표시
                const textBlocks = fullCircle.content_blocks.filter(block => block.type === 'text');
                setCircle({
                  ...fullCircle,
                  content_blocks: textBlocks,
                  images: [] // 이미지는 나중에
                });
                
                // 나머지 블록(이미지 포함)은 백그라운드에서 처리
                setTimeout(() => {
                  setCircle(fullCircle);
                  
                  // 전체 캐시에 저장
                  AsyncStorage.setItem(cacheKey, JSON.stringify({
                    circle: fullCircle,
                    timestamp: Date.now()
                  })).catch(() => {});
                }, 0);
              }
              
              // 댓글과 관심리스트를 병렬로 로드 (성능 최적화)
              await Promise.all([
                loadComments(),
                checkFavorite()
              ]);
            } else {
              // 소모임을 찾을 수 없음 (다른 학교일 수 있음)
              // 조용히 뒤로 가기
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main');
              }
            }
          } catch (parseError) {
            setLoading(false);
            // 파싱 오류 시 조용히 뒤로 가기
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main');
            }
          }
        } else {
          // 에러 응답 처리 (404는 조용히 처리)
          if (response.status === 404) {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main');
            }
          } else {
            const errorData = await response.json().catch(() => ({ error: '소모임을 불러올 수 없습니다.' }));
            Alert.alert('오류', errorData.error || '소모임을 불러올 수 없습니다.');
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main');
            }
          }
        }
      } catch (error) {
        Alert.alert('오류', '소모임을 불러오는 중 오류가 발생했습니다.');
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Main');
        }
      } finally {
        setLoading(false);
      }
  }, [circleId, targetUniversity, navigation, circlePreview, circle, loadComments, checkFavorite]);

  // 토스트 메시지 표시
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 2000);
  };

  // 관심리스트 추가/제거
  const toggleFavorite = async () => {
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const userId = await AsyncStorage.getItem('currentUserId') || 'guest';
      // selectedChannel에 따라 다른 storage key 사용 (CirclesScreen과 동일)
      const storageKey = selectedChannel === 'MIUHub' 
        ? `favoriteCircles_miuhub_${userId}`
        : `favoriteCircles_${userId}`;
      
      const favorites = await AsyncStorage.getItem(storageKey);
      let favoriteList = favorites ? JSON.parse(favorites) : [];
      const circleIdNum = parseInt(circleId);

      if (isFavorite) {
        // 관심리스트에서 제거
        favoriteList = favoriteList.filter(id => id !== circleIdNum);
        setIsFavorite(false);
        showToast('관심리스트에서 제거되었습니다.');
      } else {
        // 관심리스트에 추가
        if (!favoriteList.includes(circleIdNum)) {
          favoriteList.push(circleIdNum);
        }
        setIsFavorite(true);
        showToast('관심리스트에 추가되었습니다.');
      }

      await AsyncStorage.setItem(storageKey, JSON.stringify(favoriteList));
      // 상태 업데이트 후 다시 확인 (동기화)
      await checkFavorite();
    } catch (error) {
      showToast('오류가 발생했습니다.');
    }
  };

  // 작성 날짜 포맷 함수 (다른 게시판과 동일한 형식)
  const formatCreatedDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      return `${year}년 ${monthNames[month]} ${day}일`;
    } catch (e) {
      return '';
    }
  };

  // 이벤트 날짜 포맷 함수 (eventDate용)
  const formatDate = (dateString) => {
    if (!dateString) return '날짜미정';
    // "날짜미정" 문자열인 경우
    if (dateString === '날짜미정' || dateString.includes('날짜미정')) {
      return '날짜미정';
    }
    // "날짜 시간미정" 형식인 경우 날짜 부분만 추출
    if (dateString.includes('시간미정')) {
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
        hour12: true, // AM/PM 형식
      });
    } catch (e) {
      return '시간미정';
    }
  };

  const handleDelete = async () => {
    if (!circle) return;

    try {
      if (!university) {
        Alert.alert('오류', 'university 정보가 없습니다.');
        return;
      }
      const normalizedUniversity = targetUniversity.toLowerCase();
      const response = await fetch(`${API_BASE_URL}/api/circles/${circleId}?university=${encodeURIComponent(normalizedUniversity)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '삭제 실패' }));
        throw new Error(errorData.error || '소모임 삭제에 실패했습니다.');
      }

      // 삭제 성공 시 캐시 무효화
      try {
        const universityCode = normalizedUniversity;
        
        // 개별 circle 캐시 무효화
        const circleCacheKey = `circle_${circleId}_${universityCode}`;
        const circleContentCacheKey = `circle_content_${circleId}_${universityCode}`;
        
        // circles 목록 캐시 무효화
        const circlesCacheKey = `circles_${universityCode}`;
        const circlesTimestampKey = `circles_timestamp_${universityCode}`;
        
        await Promise.all([
          AsyncStorage.removeItem(circleCacheKey),
          AsyncStorage.removeItem(circleContentCacheKey),
          AsyncStorage.removeItem(circlesCacheKey),
          AsyncStorage.removeItem(circlesTimestampKey)
        ]);
      } catch (cacheError) {
        // 캐시 무효화 실패는 무시 (중요하지 않음)
        if (__DEV__) {
          console.warn('[ViewCirclesScreen] 캐시 무효화 실패:', cacheError);
        }
      }

      // 삭제 성공 시 즉시 circle을 null로 설정하여 주기적 새로고침 중단
      setCircle(null);
      
      Alert.alert('성공', '소모임이 삭제되었습니다.', [
        {
          text: '확인',
          onPress: () => {
            // goBack() 사용 - CirclesScreen의 useFocusEffect에서 캐시가 무효화되어 있으므로 자동으로 새로고침됨
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main');
            }
          }
        }
      ]);
    } catch (error) {
      Alert.alert('오류', error.message || '소모임 삭제 중 오류가 발생했습니다.');
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      '소모임 삭제',
      '정말로 이 소모임을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: handleDelete
        }
      ]
    );
  };

  // 댓글 작성
  const handleCommentSubmit = async () => {
    // 중복 제출 방지
    if (isSubmittingComment) {
      return;
    }

    if (!commentText.trim()) {
      Alert.alert('입력 오류', '댓글 내용을 입력해주세요.');
      return;
    }

    if (!targetUniversity) {
      Alert.alert('오류', 'university 정보가 없습니다.');
      return;
    }

    setIsSubmittingComment(true);

    try {
      // 현재 사용자 이메일 가져오기
      const userEmail = await AsyncStorage.getItem('currentUserEmail') || await AsyncStorage.getItem('currentUserId') || '';
      
      const normalizedUniversity = targetUniversity.toLowerCase();
      
      const response = await fetch(`${API_BASE_URL}/api/circles/${circleId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: commentText.trim(),
          author: userEmail,
          parentId: replyingTo || null,
          university: normalizedUniversity,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '댓글 작성에 실패했습니다.' }));
        throw new Error(errorData.error || '댓글 작성에 실패했습니다.');
      }

      const result = await response.json();
      
      if (result.success) {
        setCommentText('');
        setReplyingTo(null);
        // 댓글 목록 새로고침
        await loadComments();
      } else {
        throw new Error(result.error || '댓글 작성에 실패했습니다.');
      }
    } catch (error) {
      Alert.alert('오류', error.message || '댓글 작성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 댓글 삭제
  const handleCommentDelete = async (commentId) => {
    try {
      if (!university) {
        Alert.alert('오류', 'university 정보가 없습니다.');
        return;
      }
      const normalizedUniversity = targetUniversity.toLowerCase();
      const response = await fetch(`${API_BASE_URL}/api/circles/${circleId}/comments/${commentId}?university=${encodeURIComponent(normalizedUniversity)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('댓글 삭제에 실패했습니다.');
      }

      // 댓글 목록 새로고침
      await loadComments();
    } catch (error) {
      Alert.alert('오류', '댓글 삭제 중 오류가 발생했습니다.');
    }
  };

  const confirmCommentDelete = (commentId) => {
    Alert.alert(
      '댓글 삭제',
      '정말로 이 댓글을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            handleCommentDelete(commentId);
          }
        }
      ]
    );
  };

  // 댓글 개수 계산 (댓글 + 대댓글)
  const getTotalCommentCount = () => {
    return comments.reduce((total, comment) => {
      return total + 1 + (comment.replies ? comment.replies.length : 0);
    }, 0);
  };

  const handleClose = async () => {
    try {
      if (!university) {
        Alert.alert('오류', 'university 정보가 없습니다.');
        return;
      }
      const normalizedUniversity = targetUniversity.toLowerCase();
      const response = await fetch(`${API_BASE_URL}/api/circles/${circleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isClosed: !circle.isClosed,
          university: normalizedUniversity
          // 다른 필드는 undefined로 보내서 마감 상태만 업데이트
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '마감 실패' }));
        throw new Error(errorData.error || errorData.message || '소모임 마감에 실패했습니다.');
      }

      const result = await response.json();
      if (result.success && result.circle) {
        setCircle(result.circle);
        // 마감 후 데이터 새로고침
        Alert.alert('성공', circle.isClosed ? '소모임이 다시 열렸습니다.' : '소모임이 마감되었습니다.');
      } else {
        throw new Error('마감 상태 업데이트 실패');
      }
    } catch (error) {
      Alert.alert('오류', error.message || '소모임 마감 중 오류가 발생했습니다.');
    }
  };

  const confirmClose = () => {
    const action = circle.isClosed ? '다시 열기' : '마감';
    const title = circle.isClosed 
      ? '소모임 다시 열기'
      : '소모임 마감';
    const message = circle.isClosed
      ? '정말로 이 소모임을 다시 열하시겠습니까?'
      : '정말로 이 소모임을 마감하시겠습니까?';
    Alert.alert(
      title,
      message,
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: action,
          onPress: handleClose
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!circle) {
    return null;
  }

  const contentBlocks = circle.content_blocks || [];

  return (
    <View className="flex-1" style={{ backgroundColor: colors.primary }}>
      {/* 소모임 보기 영역 */}
      <View className="flex-1 bg-white" style={{ marginTop: 72 }}>
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <Text className="text-xl font-bold" style={{ color: colors.primary }}>소모임</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 8, marginRight: -8 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text className="text-xl font-bold text-gray-400">✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          className="px-6 pt-4" 
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 400 }}
        >
          {/* 제목 */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-2xl font-bold flex-1" style={{ color: '#000000' }}>
              {circle.title}
            </Text>
            <View className="flex-row items-center">
              {/* MIUHub이고 admin일 때만 광고 버튼 표시 */}
              {selectedChannel === 'MIUHub' && currentUser === 'admin' && (
                <TouchableOpacity 
                  onPress={async () => {
                    // 저장된 featured 데이터 불러오기
                    await loadFeaturedData();
                    setShowAdModal(true);
                  }}
                  className="mr-4"
                >
                  <Ionicons name="settings-outline" size={20} color="#000000" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={toggleFavorite}
                style={{ 
                  padding: 8,
                  marginLeft: selectedChannel === 'MIUHub' && currentUser === 'admin' ? 0 : 12,
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text 
                  style={{ 
                    fontSize: 18,
                  }}
                >
                  {isFavorite ? '❤️' : '🤍'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 메타 정보 */}
          <View className="flex-row items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-600 mr-4">
                {formatCreatedDate(circle.created_at)}
              </Text>
              <Text className="text-sm text-gray-600 mr-4">
                {getEmailPrefix(circle.author)}
              </Text>
              <Text className="text-sm text-gray-600">
                👁️ {circle.views || 0}
              </Text>
            </View>
            <View className="flex-row items-center">
              {/* 신고 버튼 */}
              <TouchableOpacity
                onPress={() => {
                  setReportType('circle');
                  setReportContentId(circleId);
                  setShowReportModal(true);
                }}
                className="mr-4"
              >
                <Ionicons name="flag-outline" size={20} color="#9ca3af" />
              </TouchableOpacity>
              
              {/* 작성자이거나 관리자일 때 마감 버튼 표시 */}
              {(circle.author === currentUser || currentUser === 'admin') && (
                <TouchableOpacity
                  onPress={confirmClose}
                  className="mr-4"
                >
                  <Text className="text-sm font-semibold" style={{ color: '#FF0000' }}>
                    {circle.isClosed ? '모집' : '마감'}
                  </Text>
                </TouchableOpacity>
              )}
              {/* 작성자이거나 관리자일 때 삭제/수정 버튼 표시 */}
              {(circle.author === currentUser || currentUser === 'admin') && (
                <>
                  <TouchableOpacity
                    onPress={confirmDelete}
                    className="mr-4"
                  >
                    <Text className="text-sm font-semibold" style={{ color: '#000000' }}>삭제</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('WriteCircles', { 
                      category: circle.category,
                      editCircle: circle,
                      selectedChannel: selectedChannel
                    })}
                  >
                    <Text className="text-sm font-semibold" style={{ color: '#000000' }}>수정</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* 추가 정보 (Circles 전용) */}
          {(circle.category || circle.keywords || circle.region || circle.location || circle.eventDate || circle.participants || circle.fee || circle.contact || circle.accountNumber) && (
            <View className="mb-6 pb-4 border-b border-gray-200">
              {circle.category && (
                <View className="flex-row items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700 mr-2">카테고리:</Text>
                  <Text className="text-sm text-gray-600">{circle.category}</Text>
                </View>
              )}
              {circle.keywords && (
                <View className="flex-row items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700 mr-2">키워드:</Text>
                  <Text className="text-sm text-gray-600">{circle.keywords}</Text>
                </View>
              )}
              {circle.region && (
                <View className="flex-row items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700 mr-2">지역:</Text>
                  <Text className="text-sm text-gray-600">{circle.region}</Text>
                </View>
              )}
              {circle.location && (
                <View className="flex-row items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700 mr-2">장소:</Text>
                  <Text className="text-sm text-gray-600">{circle.location}</Text>
                </View>
              )}
              {circle.eventDate && (
                <>
                  <View className="flex-row items-center mb-2">
                    <Text className="text-sm font-semibold text-gray-700 mr-2">날짜:</Text>
                    <Text className="text-sm text-gray-600">{formatDate(circle.eventDate)}</Text>
                  </View>
                  <View className="flex-row items-center mb-2">
                    <Text className="text-sm font-semibold text-gray-700 mr-2">시간:</Text>
                    <Text className="text-sm text-gray-600">{formatTime(circle.eventDate)}</Text>
                  </View>
                </>
              )}
              {circle.participants && (
                <View className="flex-row items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700 mr-2">참가인원:</Text>
                  <Text className="text-sm text-gray-600">{circle.participants}</Text>
                </View>
              )}
              {circle.fee && (
                <View className="flex-row items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700 mr-2">참가비:</Text>
                  <Text className="text-sm text-gray-600">{typeof circle.fee === 'number' ? circle.fee.toLocaleString() + '원' : circle.fee}</Text>
                </View>
              )}
              {circle.contact && (
                <View className="flex-row items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700 mr-2">연락처:</Text>
                  <Text className="text-sm text-gray-600">{circle.contact}</Text>
                </View>
              )}
              {circle.accountNumber && (
                <View className="flex-row items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700 mr-2">계좌번호:</Text>
                  <Text className="text-sm text-gray-600">{circle.accountNumber}</Text>
                </View>
              )}
            </View>
          )}

          {/* 본문 내용 */}
          <View className="mt-4">
            {contentBlocks && contentBlocks.length > 0 ? (
              // contentBlocks가 있으면 순서대로 표시
              contentBlocks.map((block, index) => {
                if (block.type === 'image') {
                  return (
                    <ImageBlock 
                      key={block.id || `image_${index}`} 
                      uri={block.uri} 
                    />
                  );
                } else if (block.type === 'text') {
                  return (
                    <Text 
                      key={block.id || `text_${index}`}
                      className="text-base mb-4"
                      style={{ 
                        color: '#333',
                        lineHeight: 24
                      }}
                    >
                      {block.content}
                    </Text>
                  );
                }
                return null;
              })
            ) : (
              // contentBlocks가 없고 images 배열에만 이미지가 있는 경우 (레거시 데이터)
              circle.images && Array.isArray(circle.images) && circle.images.length > 0 && (
                <>
                  {circle.images.map((imageUrl, index) => {
                    return (
                      <ImageBlock 
                        key={`image_array_${index}`} 
                        uri={imageUrl} 
                      />
                    );
                  })}
                </>
              )
            )}
          </View>

          {/* URL 버튼 */}
          {circle.url && circle.url.trim() !== '' && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  let urlToOpen = circle.url.trim();
                  if (!urlToOpen.startsWith('http://') && !urlToOpen.startsWith('https://')) {
                    urlToOpen = `https://${urlToOpen}`;
                  }
                  const canOpen = await Linking.canOpenURL(urlToOpen);
                  if (canOpen) {
                    await Linking.openURL(urlToOpen);
                  } else {
                    Alert.alert('오류', '유효하지 않은 URL입니다.');
                  }
                } catch (error) {
                  Alert.alert('오류', 'URL을 열 수 없습니다.');
                }
              }}
              className="mt-6 mb-4 items-center"
              style={{ 
                backgroundColor: colors.primary,
                width: '50%',
                alignSelf: 'center',
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 25
              }}
            >
              <Text className="text-base font-semibold text-white">{getConfig('notice_view_rsvp_button', '')}</Text>
            </TouchableOpacity>
          )}

          {/* 댓글 섹션 */}
          <View className="mt-8 pt-6 border-t border-gray-200">
            <Text className="text-lg font-bold mb-4" style={{ color: '#000000' }}>댓글 ({getTotalCommentCount()})</Text>

            {/* 댓글 작성 (일반 댓글만) */}
            {!replyingTo && (
              <View className="mb-6">
                <View className="flex-row items-end">
                  <TextInput
                    className="border border-gray-300 rounded-lg text-base bg-white flex-1 mr-2"
                    style={{ padding: 10, minHeight: 40 }}
                    placeholder="댓글을 입력하세요"
                    placeholderTextColor="#9ca3af"
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                  />
                  <TouchableOpacity
                    onPress={handleCommentSubmit}
                    className="px-4 py-2 rounded-lg"
                    style={{ backgroundColor: isSubmittingComment ? '#9ca3af' : colors.primary }}
                    disabled={isSubmittingComment}
                  >
                    <Text className="text-sm font-semibold text-white">
                      {isSubmittingComment ? '처리 중...' : '등록'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 댓글 목록 */}
            {comments.map((comment) => (
              <View key={comment.id} className="mb-4">
                {/* 댓글 */}
                <View className="mb-2 pb-3 border-b border-gray-100">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                      <Text className="text-xs text-gray-500 mr-3">
                        {comment.created_at ? (() => {
                          const date = new Date(comment.created_at);
                          const year = date.getUTCFullYear();
                          const month = date.getUTCMonth();
                          const day = date.getUTCDate();
                          const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
                          return `${year}년 ${monthNames[month]} ${day}일`;
                        })() : ''}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setReplyingTo(comment.id);
                        }}
                      >
                        <Text className="text-xs text-gray-500">대댓글</Text>
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            const currentUserId = await AsyncStorage.getItem('currentUserId');
                            const response = await fetch(`${API_BASE_URL}/api/reports`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                type: 'comment',
                                contentId: comment.id,
                                reason: 'inappropriate',
                                description: '',
                                university: targetUniversity.toLowerCase(),
                                reporterId: currentUserId || 'anonymous',
                                authorId: comment.author || null,
                              }),
                            });

                            const result = await response.json();
                            
                            if (response.ok) {
                              // 댓글 목록 새로고침
                              Alert.alert('완료', '댓글이 신고 처리되었습니다.');
                            } else {
                              Alert.alert('오류', result.error || '신고 처리에 실패했습니다.');
                            }
                          } catch (error) {
                            Alert.alert('오류', `신고 처리 중 오류가 발생했습니다: ${error.message}`);
                          }
                        }}
                      >
                        <Ionicons name="flag-outline" size={16} color="#9ca3af" />
                      </TouchableOpacity>
                      {(comment.author === currentUser || currentUser === 'admin') && (
                        <TouchableOpacity
                          onPress={() => confirmCommentDelete(comment.id)}
                        >
                          <Text className="text-xs text-gray-500">삭제</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <Text 
                    className="text-sm" 
                    style={{ 
                      color: '#333', 
                      lineHeight: 20
                    }}
                  >
                    {comment.content}
                  </Text>
                </View>

                {/* 대댓글 작성 입력창 (해당 댓글 아래) */}
                {replyingTo === comment.id && (
                  <View className="ml-4 pl-4 mb-3 pb-3 border-l-2 border-gray-200">
                    <View className="flex-row items-center mb-2 px-2 py-1 bg-gray-50 rounded">
                      <Text className="text-xs text-gray-600">대댓글 작성 중</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setReplyingTo(null);
                          setCommentText('');
                        }}
                        className="ml-auto"
                      >
                        <Text className="text-xs text-gray-500">취소</Text>
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row items-end">
                      <TextInput
                        className="border border-gray-300 rounded-lg text-base bg-white flex-1 mr-2"
                        style={{ padding: 10, minHeight: 40 }}
                        placeholder="대댓글을 입력하세요"
                        placeholderTextColor="#9ca3af"
                        value={commentText}
                        onChangeText={setCommentText}
                        multiline
                      />
                      <TouchableOpacity
                        onPress={handleCommentSubmit}
                        className="px-4 py-2 rounded-lg"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Text className="text-sm font-semibold text-white">등록</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* 대댓글 목록 */}
                {comment.replies && comment.replies.length > 0 && (
                  <View className="ml-4 pl-4 border-l-2 border-gray-200">
                    {comment.replies.map((reply) => (
                      <View key={reply.id} className="mb-2 pb-2 border-b border-gray-50">
                        <View className="flex-row items-center justify-between mb-1">
                          <Text className="text-xs text-gray-500">
                            {reply.created_at ? (() => {
                              const date = new Date(reply.created_at);
                              const year = date.getUTCFullYear();
                              const month = date.getUTCMonth();
                              const day = date.getUTCDate();
                              const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
                              return `${year}년 ${monthNames[month]} ${day}일`;
                            })() : ''}
                          </Text>
                          <View className="flex-row items-center gap-3">
                            <TouchableOpacity
                              onPress={async () => {
                                try {
                                  const currentUserId = await AsyncStorage.getItem('currentUserId');
                                  const response = await fetch(`${API_BASE_URL}/api/reports`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      type: 'comment',
                                      contentId: reply.id,
                                      reason: 'inappropriate',
                                      description: '',
                                      university: targetUniversity.toLowerCase(),
                                      reporterId: currentUserId || 'anonymous',
                                      authorId: reply.author || null,
                                    }),
                                  });

                                  const result = await response.json();
                                  
                                  if (response.ok) {
                                    // 댓글 목록 새로고침
                                    Alert.alert('완료', '댓글이 신고 처리되었습니다.');
                                  } else {
                                    Alert.alert('오류', result.error || '신고 처리에 실패했습니다.');
                                  }
                                } catch (error) {
                                  Alert.alert('오류', `신고 처리 중 오류가 발생했습니다: ${error.message}`);
                                }
                              }}
                            >
                              <Ionicons name="flag-outline" size={16} color="#9ca3af" />
                            </TouchableOpacity>
                            {(reply.author === currentUser || currentUser === 'admin') && (
                              <TouchableOpacity
                                onPress={() => confirmCommentDelete(reply.id)}
                              >
                                <Text className="text-xs text-gray-500">삭제</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        <Text 
                          className="text-sm" 
                          style={{ 
                            color: '#333', 
                            lineHeight: 20
                          }}
                        >
                          {reply.content}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

            {comments.length === 0 && (
              <Text className="text-sm text-gray-400 text-center py-4">
                아직 댓글이 없습니다.
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
      
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

      {/* 신고 모달 */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowReportModal(false);
          setReportReason('');
          setReportDescription('');
        }}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          activeOpacity={1}
          onPress={() => {
            setShowReportModal(false);
            setReportReason('');
            setReportDescription('');
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6"
            style={{ width: '90%', maxWidth: 400 }}
          >
            <Text className="text-xl font-bold mb-4 text-center" style={{ color: colors.primary }}>
              콘텐츠 신고
            </Text>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-2">신고 사유</Text>
              <View className="flex-row flex-wrap gap-2">
                {['spam', 'inappropriate', 'harassment', 'other'].map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setReportReason(reason)}
                    className="px-4 py-2 rounded-lg border"
                    style={{
                      borderColor: reportReason === reason ? colors.primary : '#d1d5db',
                      backgroundColor: reportReason === reason ? colors.primary : 'transparent',
                    }}
                  >
                    <Text
                      className="text-sm"
                      style={{
                        color: reportReason === reason ? '#FFFFFF' : '#6b7280',
                      }}
                    >
                      {reason === 'spam' ? '스팸' : 
                       reason === 'inappropriate' ? '부적절한 내용' :
                       reason === 'harassment' ? '괴롭힘' : '기타'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-2">상세 설명 (선택사항)</Text>
              <TextInput
                value={reportDescription}
                onChangeText={setReportDescription}
                placeholder="신고 사유를 자세히 설명해주세요"
                multiline
                numberOfLines={4}
                className="border rounded-lg px-4 py-3"
                style={{
                  borderColor: colors.primary,
                  borderWidth: 1,
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowReportModal(false);
                  setReportReason('');
                  setReportDescription('');
                }}
                className="flex-1 py-3 rounded-lg items-center"
                style={{
                  backgroundColor: '#e5e7eb',
                }}
              >
                <Text className="text-gray-700 font-semibold">취소</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={async () => {
                  if (!reportReason) {
                    Alert.alert('입력 오류', '신고 사유를 선택해주세요.');
                    return;
                  }

                  try {
                    const currentUserId = await AsyncStorage.getItem('currentUserId');
                    const response = await fetch(`${API_BASE_URL}/api/reports`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        type: reportType === 'circle' ? 'circle' : 'comment',
                        contentId: reportContentId,
                        reason: reportReason,
                        description: reportDescription.trim(),
                        university: targetUniversity.toLowerCase(),
                        reporterId: currentUserId || 'anonymous',
                        authorId: reportType === 'circle' 
                          ? circle.author 
                          : (() => {
                              // 댓글 또는 대댓글 찾기
                              for (const comment of comments) {
                                if (comment.id === reportContentId) {
                                  return comment.author;
                                }
                                if (comment.replies) {
                                  for (const reply of comment.replies) {
                                    if (reply.id === reportContentId) {
                                      return reply.author;
                                    }
                                  }
                                }
                              }
                              return null;
                            })(),
                      }),
                    });

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({ error: '신고 실패' }));
                      throw new Error(errorData.error || '신고 접수에 실패했습니다.');
                    }

                    const result = await response.json();
                    
                    // 삭제된 경우 처리
                    if (result.deleted) {
                      if (reportType === 'circle') {
                        // 글 삭제: 3번 신고 모였지만 즉시 반영하지 않음 (나갔다 들어와야 없어짐)
                        Alert.alert('완료', result.message || '신고가 접수되었습니다. 검토 후 조치하겠습니다.', [
                          {
                            text: '확인',
                            onPress: () => {
                              setShowReportModal(false);
                              setReportReason('');
                              setReportDescription('');
                            }
                          }
                        ]);
                      } else {
                        // 댓글/대댓글 삭제: 1번 신고하면 즉시 반영
                        Alert.alert('완료', result.message || '댓글이 삭제되었습니다.', [
                          {
                            text: '확인',
                            onPress: () => {
                              setShowReportModal(false);
                              setReportReason('');
                              setReportDescription('');
                              loadComments(); // 댓글 목록 즉시 리프레시
                            }
                          }
                        ]);
                      }
                    } else {
                      // 삭제되지 않은 경우 (신고만 접수)
                      Alert.alert('완료', result.message || '신고가 접수되었습니다. 검토 후 조치하겠습니다.', [
                        {
                          text: '확인',
                          onPress: () => {
                            setShowReportModal(false);
                            setReportReason('');
                            setReportDescription('');
                          }
                        }
                      ]);
                    }
                  } catch (error) {
                    Alert.alert('오류', error.message || '신고 접수 중 오류가 발생했습니다.');
                  }
                }}
                className="flex-1 py-3 rounded-lg items-center"
                style={{
                  backgroundColor: colors.primary,
                }}
              >
                <Text className="text-white font-semibold">신고하기</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 광고 설정 모달 */}
      <Modal
        visible={showAdModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAdModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, width: '90%', maxHeight: '80%' }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold">노출 설정</Text>
              <TouchableOpacity
                onPress={() => setShowAdModal(false)}
                style={{ padding: 4 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text className="text-xl font-bold" style={{ color: '#666' }}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              <Text className="text-sm font-semibold mb-2">카테고리 페이지</Text>
              <View className="flex-row mb-4">
                <View className="flex-1 mr-2">
                  <Text className="text-xs text-gray-600 mb-1">페이지</Text>
                  <TextInput
                    value={adCategoryPage}
                    onChangeText={setAdCategoryPage}
                    keyboardType="numeric"
                    className="border border-gray-300 rounded px-3 py-2"
                  />
                </View>
                <View className="flex-1 ml-2">
                  <Text className="text-xs text-gray-600 mb-1">위치</Text>
                  <TextInput
                    value={adCategoryPosition}
                    onChangeText={setAdCategoryPosition}
                    keyboardType="numeric"
                    className="border border-gray-300 rounded px-3 py-2"
                  />
                </View>
              </View>

              <Text className="text-sm font-semibold mb-2">전체 페이지</Text>
              <View className="flex-row mb-4">
                <View className="flex-1 mr-2">
                  <Text className="text-xs text-gray-600 mb-1">페이지</Text>
                  <TextInput
                    value={adAllPage}
                    onChangeText={setAdAllPage}
                    keyboardType="numeric"
                    className="border border-gray-300 rounded px-3 py-2"
                  />
                </View>
                <View className="flex-1 ml-2">
                  <Text className="text-xs text-gray-600 mb-1">위치</Text>
                  <TextInput
                    value={adAllPosition}
                    onChangeText={setAdAllPosition}
                    keyboardType="numeric"
                    className="border border-gray-300 rounded px-3 py-2"
                  />
                </View>
              </View>

              <Text className="text-sm font-semibold mb-2">기간</Text>
              <View className="flex-row mb-4">
                <View className="flex-1 mr-2">
                  <Text className="text-xs text-gray-600 mb-1">시작일</Text>
                  <TouchableOpacity
                    onPress={() => setShowStartDatePicker(true)}
                    className="border border-gray-300 rounded px-3 py-2"
                  >
                    <Text>{adStartDate.toLocaleDateString('ko-KR')}</Text>
                  </TouchableOpacity>
                  {showStartDatePicker && (
                    <DateTimePicker
                      value={adStartDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => {
                        setShowStartDatePicker(Platform.OS === 'ios');
                        if (selectedDate) setAdStartDate(selectedDate);
                      }}
                    />
                  )}
                </View>
                <View className="flex-1 ml-2">
                  <Text className="text-xs text-gray-600 mb-1">종료일</Text>
                  <TouchableOpacity
                    onPress={() => setShowEndDatePicker(true)}
                    className="border border-gray-300 rounded px-3 py-2"
                  >
                    <Text>{adEndDate.toLocaleDateString('ko-KR')}</Text>
                  </TouchableOpacity>
                  {showEndDatePicker && (
                    <DateTimePicker
                      value={adEndDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => {
                        setShowEndDatePicker(Platform.OS === 'ios');
                        if (selectedDate) setAdEndDate(selectedDate);
                      }}
                    />
                  )}
                </View>
              </View>

              <View className="flex-row justify-end mt-4">
                {currentFeaturedId && (
                  <TouchableOpacity
                    onPress={async () => {
                      Alert.alert(
                        '삭제',
                        '노출 설정을 삭제하시겠습니까?',
                        [
                          {
                            text: '취소',
                            style: 'cancel'
                          },
                          {
                            text: '삭제',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const response = await fetch(`${API_BASE_URL}/api/featured/${currentFeaturedId}`, {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    university: targetUniversity.toLowerCase()
                                  }),
                                });
                                const responseData = await response.json().catch(() => ({}));
                                if (!response.ok) {
                                  throw new Error(responseData.error || responseData.message || '삭제에 실패했습니다.');
                                }
                                Alert.alert('완료', '노출 설정이 삭제되었습니다.');
                                setShowAdModal(false);
                                setCurrentFeaturedId(null);
                                // Featured 데이터 새로고침
                                await loadFeaturedData();
                                // featured 삭제 후 CirclesScreen으로 돌아가면서 새로고침
                                if (navigation.canGoBack()) {
                                  navigation.navigate('Main', { screen: 'Club', params: { selectedChannel, refreshFeatured: true } });
                                }
                              } catch (error) {
                                Alert.alert('오류', error.message || '삭제 중 오류가 발생했습니다.');
                              }
                            }
                          }
                        ]
                      );
                    }}
                    className="px-4 py-2 mr-2"
                    style={{ backgroundColor: '#FF0000' }}
                  >
                    <Text className="text-white">삭제</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const currentUniversity = targetUniversity;
                      // 전체 페이지 featured만 설정하려면 categoryPage를 null로 저장
                      // categoryPage가 비어있거나 0이면 null로, 아니면 파싱된 값 사용
                      const categoryPageValue = adCategoryPage && adCategoryPage.trim() !== '' && parseInt(adCategoryPage) !== 0 
                        ? parseInt(adCategoryPage) 
                        : null;
                      const categoryPositionValue = categoryPageValue !== null && adCategoryPosition && adCategoryPosition.trim() !== '' 
                        ? parseInt(adCategoryPosition) 
                        : null;
                      
                      // categoryPage가 null이면 전체 탭 featured이므로 category를 "전체"로 설정
                      // categoryPage가 있으면 해당 카테고리 탭 featured이므로 게시글의 category 사용
                      const categoryValue = categoryPageValue === null ? '전체' : (circle?.category || '전체');
                      
                      const requestBody = {
                        contentId: circleId,
                        type: 'circle',
                        category: categoryValue,
                        categoryPage: categoryPageValue,
                        categoryPosition: categoryPositionValue,
                        allPage: parseInt(adAllPage) || 1,
                        allPosition: parseInt(adAllPosition) || 1,
                        startDate: `${adStartDate.getFullYear()}-${String(adStartDate.getMonth() + 1).padStart(2, '0')}-${String(adStartDate.getDate()).padStart(2, '0')}`,
                        endDate: `${adEndDate.getFullYear()}-${String(adEndDate.getMonth() + 1).padStart(2, '0')}-${String(adEndDate.getDate()).padStart(2, '0')}`,
                        university: currentUniversity,
                      };
                      const response = await fetch(`${API_BASE_URL}/api/featured`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody),
                      });
                      const responseData = await response.json().catch(() => ({}));
                      if (!response.ok) {
                        throw new Error(responseData.error || responseData.message || '설정 저장에 실패했습니다.');
                      }
                      // 저장된 featured ID 업데이트
                      if (responseData.featured && responseData.featured.id) {
                        setCurrentFeaturedId(responseData.featured.id);
                      }
                      Alert.alert('완료', '설정이 완료되었습니다.');
                      setShowAdModal(false);
                      // featured 저장 후 CirclesScreen으로 돌아가면서 새로고침
                      if (navigation.canGoBack()) {
                        navigation.navigate('Main', { screen: 'Club', params: { selectedChannel, refreshFeatured: true } });
                      }
                    } catch (error) {
                      Alert.alert('오류', error.message || '설정 저장에 실패했습니다.');
                    }
                  }}
                  className="px-4 py-2"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text style={{ color: colors.buttonTextColor }}>저장</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

