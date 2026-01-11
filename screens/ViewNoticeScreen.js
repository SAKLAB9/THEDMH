import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, Alert, TouchableOpacity, Dimensions, TextInput, Modal, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import API_BASE_URL from '../config/api';
import { getCategoryPassword } from './categoryPasswords';
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

  // 이미지 URI를 절대 경로로 변환
  const getImageUri = (uri) => {
    if (!uri) return uri;
    // 이미 절대 경로인 경우 (http://, https://, data:)
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:')) {
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

export default function ViewNoticeScreen({ route, navigation }) {
  const { university } = useUniversity();
  const { getConfig, getColorConfig, config: appConfig } = useAppConfig();
  const config = { getColorConfig };
  const uniColors = useMemo(() => getUniColors(university, config), [university, getColorConfig, appConfig]);
  const colors = useMemo(() => ({
    primary: uniColors.primary || '#000000',
    buttonTextColor: uniColors.buttonTextColor || '#FFFFFF',
  }), [uniColors]);
  const { noticeId } = route.params;
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true); // 초기 로딩 상태를 true로 변경
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  const [currentUser, setCurrentUser] = useState(null);
  
  // targetUniversity 변수 추가 (신고 API 호출 시 필요)
  const targetUniversity = university || null;

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
      console.error('currentUser 로드 실패:', error);
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  // 화면이 포커스될 때마다 currentUser만 다시 로드
  useFocusEffect(
    React.useCallback(() => {
      loadCurrentUser();
    }, [loadCurrentUser])
  );

  // 공지사항 데이터 로드
  useEffect(() => {
    const loadNotice = async () => {
      if (!noticeId || !university || !university.trim()) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const universityCode = university.toLowerCase();
        const cacheKey = `notice_${noticeId}_${universityCode}`;
        
        // 캐시에서 먼저 확인 (동기적으로 빠르게 처리)
        let cachedNotice = null;
        let cacheTimestamp = null;
        try {
          const cachedData = await AsyncStorage.getItem(cacheKey);
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            cacheTimestamp = parsedData.timestamp || 0;
            const cacheAge = Date.now() - cacheTimestamp;
            const CACHE_DURATION = 5 * 60 * 1000; // 5분
            
            if (cacheAge < CACHE_DURATION && parsedData.notice) {
              cachedNotice = parsedData.notice;
            }
          }
        } catch (cacheError) {
          // 캐시 읽기 오류는 무시
        }
        
        // 캐시가 있으면 즉시 표시하고 로딩 종료
        if (cachedNotice) {
          // content_blocks 파싱 확인 (캐시에서 가져온 데이터도 파싱 필요)
          let notice = { ...cachedNotice };
          if (notice.content_blocks && typeof notice.content_blocks === 'string') {
            try {
              notice.content_blocks = JSON.parse(notice.content_blocks);
            } catch (e) {
              notice.content_blocks = [];
            }
          }
          if (!Array.isArray(notice.content_blocks)) {
            notice.content_blocks = [];
          }
          setNotice(notice);
          setLoading(false);
          
          // 백그라운드에서 새 데이터 가져오기 (캐시가 오래되었을 때만)
          const cacheAge = Date.now() - (cacheTimestamp || 0);
          if (cacheAge > 2 * 60 * 1000) { // 2분 이상 지났을 때만 업데이트
            fetch(`${API_BASE_URL}/api/notices/${noticeId}?university=${encodeURIComponent(universityCode)}`)
              .then(response => {
                if (response.ok) {
                  return response.json();
                }
                return null;
              })
              .then(data => {
                if (data && data.success && data.notice) {
                  // content_blocks 파싱
                  let updatedNotice = data.notice;
                  if (updatedNotice.content_blocks && typeof updatedNotice.content_blocks === 'string') {
                    try {
                      updatedNotice.content_blocks = JSON.parse(updatedNotice.content_blocks);
                    } catch (e) {
                      updatedNotice.content_blocks = [];
                    }
                  }
                  if (!Array.isArray(updatedNotice.content_blocks)) {
                    updatedNotice.content_blocks = [];
                  }
                  AsyncStorage.setItem(cacheKey, JSON.stringify({
                    notice: updatedNotice,
                    timestamp: Date.now()
                  })).catch(() => {});
                  setNotice(updatedNotice);
                }
              })
              .catch(() => {});
          }
          
          return; // 캐시가 있으면 여기서 종료
        }
        
        // 캐시가 없으면 API 호출 (타임아웃 설정)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
        
        const url = `${API_BASE_URL}/api/notices/${noticeId}?university=${encodeURIComponent(universityCode)}`;
        const response = await fetch(url, { signal: controller.signal });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.notice) {
            // content_blocks 파싱
            let notice = data.notice;
            if (notice.content_blocks && typeof notice.content_blocks === 'string') {
              try {
                notice.content_blocks = JSON.parse(notice.content_blocks);
              } catch (e) {
                notice.content_blocks = [];
              }
            }
            if (!Array.isArray(notice.content_blocks)) {
              notice.content_blocks = [];
            }
            
            // 캐시에 저장
            try {
              await AsyncStorage.setItem(cacheKey, JSON.stringify({
                notice: notice,
                timestamp: Date.now()
              }));
            } catch (cacheError) {
              // 캐시 저장 실패는 무시
            }
            setNotice(notice);
          } else {
            if (__DEV__) {
              console.error(`[ViewNoticeScreen] 공지사항을 찾을 수 없음`);
            }
            Alert.alert('오류', '공지사항을 찾을 수 없습니다.');
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main');
            }
          }
        } else {
          // 에러 응답 처리
          let errorData = { error: '공지사항을 불러올 수 없습니다.' };
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              errorData = await response.json();
            }
          } catch (parseError) {
            // 파싱 실패는 무시
          }
          
          if (__DEV__) {
            console.error(`[ViewNoticeScreen] 서버 오류:`, {
              status: response.status,
              statusText: response.statusText,
              url
            });
          }
          Alert.alert('오류', errorData.error || '공지사항을 불러올 수 없습니다.');
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Main');
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          if (__DEV__) {
            console.error('[ViewNoticeScreen] 요청 타임아웃');
          }
          Alert.alert('오류', '요청 시간이 초과되었습니다. 다시 시도해주세요.');
        } else if (__DEV__) {
          console.error('[ViewNoticeScreen] 공지사항 로드 오류:', error);
        }
        
        // 에러 발생 시에도 캐시가 있으면 표시
        if (!notice) {
          Alert.alert('오류', '공지사항을 불러오는 중 오류가 발생했습니다.');
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Main');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadNotice();
  }, [noticeId, university]);

  // 작성 날짜 포맷 함수 (다른 게시판과 동일한 형식)
  const formatDate = (dateString) => {
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

  const handleDelete = async () => {
    if (!notice) return;

    // 비밀번호 확인
    const noticeTab1 = getConfig('notice_tab1');
    const correctPassword = getCategoryPassword(university, notice.category, noticeTab1);
    if (deletePassword !== correctPassword) {
      Alert.alert('비밀번호 오류', '비밀번호가 올바르지 않습니다.');
      setDeletePassword('');
      return;
    }

    try {
      if (!university) {
        Alert.alert('오류', 'university 정보가 없습니다.');
        return;
      }
      const normalizedUniversity = university.toLowerCase();
      const response = await fetch(`${API_BASE_URL}/api/notices/${noticeId}?university=${encodeURIComponent(normalizedUniversity)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '삭제 실패' }));
        throw new Error(errorData.error || '공지사항 삭제에 실패했습니다.');
      }

      Alert.alert('성공', '공지사항이 삭제되었습니다.', [
        {
          text: '확인',
          onPress: () => navigation.navigate('Main', { screen: 'Home' })
        }
      ]);
    } catch (error) {
      console.error('공지사항 삭제 실패:', error);
      Alert.alert('오류', error.message || '공지사항 삭제 중 오류가 발생했습니다.');
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      '공지사항 삭제',
      '정말로 이 공지사항을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            setShowPasswordModal(true);
          }
        }
      ]
    );
  };

  const handlePasswordSubmit = () => {
    if (!deletePassword) {
      Alert.alert('오류', '비밀번호를 입력해주세요.');
      return;
    }
    setShowPasswordModal(false);
    handleDelete();
  };

  // 점진적 렌더링: 레이아웃은 즉시 표시, 데이터는 로드되는 대로 표시
  const contentBlocks = notice?.content_blocks || [];

  return (
    <View className="flex-1" style={{ backgroundColor: colors.primary }}>
      {/* 공지사항 보기 영역 */}
      <View className="flex-1 bg-white" style={{ marginTop: 72 }}>
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <Text className="text-xl font-bold" style={{ color: colors.primary }}>공지사항</Text>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main');
              }
            }}
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
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* 제목 */}
          {notice?.title ? (
            <Text className="text-2xl font-bold mb-4" style={{ color: '#000000' }}>
              {notice.title}
            </Text>
          ) : null}

          {/* 메타 정보 */}
          {notice && (
            <View className="flex-row items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <View className="flex-row items-center">
                {notice.created_at && (
                  <Text className="text-sm text-gray-600 mr-4">
                    {formatDate(notice.created_at)}
                  </Text>
                )}
                {(notice.nickname || notice.author) && (
                  <Text className="text-sm text-gray-600 mr-4">
                    {notice.nickname || getEmailPrefix(notice.author)}
                  </Text>
                )}
                <Text className="text-sm text-gray-600">
                  👁️ {notice.views || 0}
                </Text>
              </View>
              <View className="flex-row items-center">
                {/* 신고 버튼 */}
                <TouchableOpacity
                  onPress={() => {
                    setShowReportModal(true);
                  }}
                  className="mr-4"
                >
                  <Ionicons name="flag-outline" size={20} color="#9ca3af" />
                </TouchableOpacity>
                
                {/* 작성자이거나 관리자일 때 삭제/수정 버튼 표시 */}
                {(notice.author === currentUser || currentUser === 'admin') && (
                <>
              <TouchableOpacity
                onPress={confirmDelete}
                className="mr-4"
              >
                <Text className="text-sm font-semibold" style={{ color: '#000000' }}>삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('WriteNotice', { 
                  category: notice.category,
                  editNotice: notice 
                })}
              >
                <Text className="text-sm font-semibold" style={{ color: '#000000' }}>수정</Text>
              </TouchableOpacity>
                </>
              )}
              </View>
            </View>
          )}

          {/* 본문 내용 */}
          {contentBlocks.length > 0 && (
            <View className="mt-4">
              {contentBlocks.map((block, index) => {
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
              })}
            </View>
          )}

          {/* RSVP 버튼 */}
          {notice?.url && notice.url.trim() !== '' && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  let urlToOpen = notice.url.trim();
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
                  console.error('URL 열기 오류:', error);
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
        </ScrollView>
      </View>

      {/* 비밀번호 입력 모달 */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPasswordModal(false);
          setDeletePassword('');
        }}
      >
        <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0, 0, 0, 0.5)', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <View style={{ 
            backgroundColor: '#FFFFFF', 
            borderRadius: 12, 
            padding: 24, 
            width: '80%',
            maxWidth: 400
          }}>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: 'bold', 
              marginBottom: 16,
              color: '#000000'
            }}>
              비밀번호 입력
            </Text>
            <Text style={{ 
              fontSize: 14, 
              color: '#666666', 
              marginBottom: 16
            }}>
              삭제를 위해 비밀번호를 입력해주세요.
            </Text>
            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="비밀번호"
              secureTextEntry
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                marginBottom: 16
              }}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={() => {
                  setShowPasswordModal(false);
                  setDeletePassword('');
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  marginRight: 8
                }}
              >
                <Text style={{ color: '#666666', fontSize: 16 }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePasswordSubmit}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: '#EF4444',
                  borderRadius: 8
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                    if (!targetUniversity) {
                      Alert.alert('오류', 'university 정보가 없습니다.');
                      return;
                    }

                    const currentUserId = await AsyncStorage.getItem('currentUserId');
                    const response = await fetch(`${API_BASE_URL}/api/reports`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        type: 'notice',
                        contentId: noticeId,
                        reason: reportReason,
                        description: reportDescription.trim(),
                        university: targetUniversity.toLowerCase(),
                        reporterId: currentUserId || 'anonymous',
                        authorId: notice.author || null,
                      }),
                    });

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({ error: '신고 실패' }));
                      throw new Error(errorData.error || '신고 접수에 실패했습니다.');
                    }

                    Alert.alert('완료', '신고가 접수되었습니다. 검토 후 조치하겠습니다.', [
                      {
                        text: '확인',
                        onPress: () => {
                          setShowReportModal(false);
                          setReportReason('');
                          setReportDescription('');
                        }
                      }
                    ]);
                  } catch (error) {
                    Alert.alert('오류', `신고 처리 중 오류가 발생했습니다: ${error.message}`);
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
    </View>
  );
}

