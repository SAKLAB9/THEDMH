import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, Alert, TouchableOpacity, Dimensions, TextInput, Modal, Linking, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import API_BASE_URL from '../config/api';
import { useUniversity } from '../contexts/UniversityContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { getUniColors } from '../utils/uniColors';

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

export default function ViewBoardScreen({ route, navigation }) {
  const { university } = useUniversity();
  const { getConfig, getConfigNumber, getColorConfig } = useAppConfig();
  const config = { getColorConfig };
  const { postId, selectedChannel } = route?.params || {};
  
  // selectedChannel에 따라 university와 색상 결정
  const targetUniversity = useMemo(() => {
    return selectedChannel === 'MIUHub' ? 'miuhub' : (selectedChannel || university || null);
  }, [selectedChannel, university]);
  
  const uniColors = useMemo(() => getUniColors(targetUniversity, config), [targetUniversity, getColorConfig]);
  const colors = useMemo(() => ({
    primary: uniColors.primary,
    buttonTextColor: uniColors.buttonTextColor,
  }), [uniColors]);
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // 대댓글 작성 중인 댓글 ID
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState(null);
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

  // 관심리스트 확인 함수 (selectedChannel 의존성 추가)
  const checkFavorite = React.useCallback(async () => {
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const userId = await AsyncStorage.getItem('currentUserId') || 'guest';
      // selectedChannel에 따라 다른 storage key 사용 (BoardScreen과 동일)
      const storageKey = selectedChannel === 'MIUHub' 
        ? `favoritePosts_miuhub_${userId}`
        : `favoritePosts_${userId}`;
      
      const favorites = await AsyncStorage.getItem(storageKey);
      if (favorites) {
        const favoriteList = JSON.parse(favorites);
        setIsFavorite(favoriteList.includes(parseInt(postId)));
      } else {
        setIsFavorite(false);
      }
    } catch (error) {
    }
  }, [postId, selectedChannel]);

  useEffect(() => {
    if (postId) {
      checkFavorite();
    }
  }, [postId, checkFavorite]);

  // 화면이 포커스될 때마다 currentUser와 관심리스트 다시 로드
  useFocusEffect(
    React.useCallback(() => {
      loadCurrentUser();
      if (postId) {
        // 수정 후 돌아왔을 때 데이터 새로고침
        loadBoard();
      }
    }, [loadCurrentUser, postId, loadBoard])
  );

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
      // selectedChannel에 따라 다른 storage key 사용 (BoardScreen과 동일)
      const storageKey = selectedChannel === 'MIUHub' 
        ? `favoritePosts_miuhub_${userId}`
        : `favoritePosts_${userId}`;
      
      const favorites = await AsyncStorage.getItem(storageKey);
      let favoriteList = favorites ? JSON.parse(favorites) : [];
      const postIdNum = parseInt(postId);

      if (isFavorite) {
        // 관심리스트에서 제거
        favoriteList = favoriteList.filter(id => id !== postIdNum);
        setIsFavorite(false);
        showToast('관심리스트에서 제거되었습니다.');
      } else {
        // 관심리스트에 추가
        if (!favoriteList.includes(postIdNum)) {
          favoriteList.push(postIdNum);
        }
        setIsFavorite(true);
        showToast('관심리스트에 추가되었습니다.');
      }

      await AsyncStorage.setItem(storageKey, JSON.stringify(favoriteList));
      // 상태 업데이트 후 다시 확인 (동기화)
      await checkFavorite();
    } catch (error) {
      console.error('관심리스트 업데이트 실패:', error);
      showToast('오류가 발생했습니다.');
    }
  };

  // 댓글 로드 함수
  const loadComments = React.useCallback(async () => {
    if (!postId || !targetUniversity) {
      return;
    }

    try {
      const universityCode = targetUniversity.toLowerCase();
      const commentsResponse = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments?university=${encodeURIComponent(universityCode)}`);
      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json();
        if (commentsData.success && commentsData.comments) {
          setComments(commentsData.comments);
        }
      }
    } catch (error) {
      console.error('댓글 로드 오류:', error);
    }
  }, [postId, targetUniversity]);

  // 저장된 featured 데이터 불러오기
  const loadFeaturedData = React.useCallback(async () => {
    if (!postId || selectedChannel !== 'MIUHub') {
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
      const featuredResponse = await fetch(`${API_BASE_URL}/api/featured?university=miuhub&type=board`);
      if (featuredResponse.ok) {
        const featuredData = await featuredResponse.json();
        if (featuredData.success && featuredData.featured) {
          // 현재 postId와 일치하는 featured 찾기
          const currentFeatured = featuredData.featured.find(
            f => f.contentId === parseInt(postId) && f.type === 'board'
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
      console.error('Featured 데이터 로드 오류:', error);
      // 에러 발생 시 기본값으로 초기화
      setAdCategoryPage('1');
      setAdCategoryPosition('1');
      setAdAllPage('1');
      setAdAllPosition('1');
      setAdStartDate(new Date());
      setAdEndDate(new Date());
    }
  }, [postId, selectedChannel]);

  // 게시글 데이터 로드 함수
  const loadBoard = React.useCallback(async () => {
      if (!postId || !targetUniversity) {
        return;
      }

      setLoading(true);
      try {
        const universityCode = targetUniversity.toLowerCase();
        const response = await fetch(`${API_BASE_URL}/api/posts/${postId}?university=${encodeURIComponent(universityCode)}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.post) {
            setBoard(data.post);
            
            // 댓글도 함께 로드
            await loadComments();
          
          // 관심리스트 확인
          await checkFavorite();
          } else {
            Alert.alert('오류', '게시글을 찾을 수 없습니다.');
            if (navigation.canGoBack()) {
              if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main');
            }
            } else {
              navigation.navigate('Main');
            }
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: '게시글을 불러올 수 없습니다.' }));
          Alert.alert('오류', errorData.error || '게시글을 불러올 수 없습니다.');
          if (navigation.canGoBack()) {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main');
            }
          } else {
            navigation.navigate('Main');
          }
        }
      } catch (error) {
        Alert.alert('오류', '게시글을 불러오는 중 오류가 발생했습니다.');
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Main');
        }
      } finally {
        setLoading(false);
      }
  }, [postId, targetUniversity, navigation, getConfig, loadComments, checkFavorite]);

  const handleDelete = async () => {
    if (!board) return;

    try {
      if (!university) {
        Alert.alert('오류', 'university 정보가 없습니다.');
        return;
      }
      const normalizedUniversity = targetUniversity.toLowerCase();
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}?university=${encodeURIComponent(normalizedUniversity)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '삭제 실패' }));
        throw new Error(errorData.error || '게시글 삭제에 실패했습니다.');
      }

      // 삭제 성공 시 즉시 board를 null로 설정하여 주기적 새로고침 중단
      setBoard(null);

      Alert.alert('성공', '게시글이 삭제되었습니다.', [
        {
          text: '확인',
          onPress: () => {
            // goBack() 사용 - BoardScreen의 useFocusEffect에서 selectedChannel 상태를 유지함
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main');
            }
          }
        }
      ]);
    } catch (error) {
      Alert.alert('오류', error.message || '게시글 삭제 중 오류가 발생했습니다.');
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      '게시글 삭제',
      '정말로 이 게시글을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            handleDelete();
          }
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
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: commentText.trim(),
          author: userEmail,
          parentId: replyingTo || null, // 대댓글인 경우 부모 댓글 ID
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

  // 댓글 개수 계산 (댓글 + 대댓글)
  const getTotalCommentCount = () => {
    return comments.reduce((total, comment) => {
      return total + 1 + (comment.replies ? comment.replies.length : 0);
    }, 0);
  };

  // 댓글 삭제
  const handleCommentDelete = async (commentId) => {
    try {
      const normalizedUniversity = targetUniversity.toLowerCase();
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments/${commentId}?university=${encodeURIComponent(normalizedUniversity)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('댓글 삭제에 실패했습니다.');
      }

      // 댓글 목록 새로고침
      await loadComments();
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!board) {
    return null;
  }

  const contentBlocks = board.content_blocks || [];

  return (
    <View className="flex-1" style={{ backgroundColor: colors.primary }}>
      {/* 게시글 보기 영역 */}
      <View className="flex-1 bg-white" style={{ marginTop: 72 }}>
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <Text className="text-xl font-bold" style={{ color: colors.primary }}>게시판</Text>
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
              {board.title}
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
                {board.created_at ? (() => {
                  // UTC 날짜를 그대로 사용하여 날짜만 표시 (시간대 변환 없이)
                  const date = new Date(board.created_at);
                  const year = date.getUTCFullYear();
                  const month = date.getUTCMonth();
                  const day = date.getUTCDate();
                  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
                  return `${year}년 ${monthNames[month]} ${day}일`;
                })() : ''}
              </Text>
              <Text className="text-sm text-gray-600 mr-4">
                {board.nickname || board.author || ''}
              </Text>
              <Text className="text-sm text-gray-600">
                👁️ {board.views || 0}
              </Text>
            </View>
            <View className="flex-row items-center">
              {/* 신고 버튼 */}
              <TouchableOpacity
                onPress={() => {
                  setReportType('board');
                  setReportContentId(postId);
                  setShowReportModal(true);
                }}
                className="mr-4"
              >
                <Ionicons name="flag-outline" size={20} color="#9ca3af" />
              </TouchableOpacity>
              
              {/* 작성자이거나 관리자일 때 삭제/수정 버튼 표시 */}
              {(board.author === currentUser || currentUser === 'admin') && (
                <>
              <TouchableOpacity
                onPress={confirmDelete}
                className="mr-4"
              >
                <Text className="text-sm font-semibold" style={{ color: '#000000' }}>삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('WriteBoard', { 
                  category: board.category,
                  editBoard: board,
                  selectedChannel
                })}
              >
                <Text className="text-sm font-semibold" style={{ color: '#000000' }}>수정</Text>
              </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* 본문 내용 */}
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

          {/* RSVP 버튼 */}
          {board.url && board.url.trim() !== '' && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  let urlToOpen = board.url.trim();
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
              <Text className="text-base font-semibold text-white">{getConfig('lifeevent_view_rsvp_button', '')}</Text>
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
                            console.error('신고 처리 오류:', error);
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
                                  console.error('신고 처리 오류:', error);
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
                        type: reportType === 'board' ? 'board' : 'comment',
                        contentId: reportContentId,
                        reason: reportReason,
                        description: reportDescription.trim(),
                        university: targetUniversity.toLowerCase(),
                        reporterId: currentUserId || 'anonymous',
                        authorId: reportType === 'board' 
                          ? board.author 
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
                      const requestBody = {
                        contentId: postId,
                        type: 'board',
                        category: board?.category || '전체',
                        categoryPage: parseInt(adCategoryPage) || 1,
                        categoryPosition: parseInt(adCategoryPosition) || 1,
                        allPage: parseInt(adAllPage) || 1,
                        allPosition: parseInt(adAllPosition) || 1,
                        startDate: `${adStartDate.getFullYear()}-${String(adStartDate.getMonth() + 1).padStart(2, '0')}-${String(adStartDate.getDate()).padStart(2, '0')}`,
                        endDate: `${adEndDate.getFullYear()}-${String(adEndDate.getMonth() + 1).padStart(2, '0')}-${String(adEndDate.getDate()).padStart(2, '0')}`,
                        university: currentUniversity,
                      };
                      console.log('광고 저장 요청:', requestBody);
                      const response = await fetch(`${API_BASE_URL}/api/featured`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody),
                      });
                      const responseData = await response.json().catch(() => ({}));
                      console.log('광고 저장 응답:', response.status, responseData);
                      if (!response.ok) {
                        throw new Error(responseData.error || responseData.message || '설정 저장에 실패했습니다.');
                      }
                      // 저장된 featured ID 업데이트
                      if (responseData.featured && responseData.featured.id) {
                        setCurrentFeaturedId(responseData.featured.id);
                      }
                      Alert.alert('완료', '설정이 완료되었습니다.');
                      setShowAdModal(false);
                    } catch (error) {
                      console.error('광고 저장 오류:', error);
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
    </View>
  );
}

