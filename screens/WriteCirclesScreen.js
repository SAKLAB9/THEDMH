import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Alert, KeyboardAvoidingView, Platform, Dimensions, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
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
    // 이미 절대 경로인 경우 (http://, https://, data:, file:)
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:') || uri.startsWith('file://')) {
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

export default function WriteCirclesScreen({ navigation, route }) {
  const { university } = useUniversity();
  const { getConfig, getColorConfig } = useAppConfig();
  const config = { getColorConfig };
  const miuhubPrimary = getColorConfig('miuhub', 'primary_color');
  const categories = [
    getConfig('circles_tab1'),
    getConfig('circles_tab2'),
    getConfig('circles_tab3'),
    getConfig('circles_tab4')
  ].filter(cat => cat); // 빈 값 제거
  const defaultCategory = categories[0] || '';
  const { category: initialCategory = defaultCategory, editCircle, selectedChannel } = route?.params || {};
  
  // selectedChannel에 따라 university와 색상 결정
  const targetUniversity = useMemo(() => {
    return selectedChannel === 'MIUHub' ? 'miuhub' : (university || null);
  }, [selectedChannel, university]);
  
  const uniColors = useMemo(() => getUniColors(targetUniversity, config), [targetUniversity, getColorConfig]);
  const colors = useMemo(() => ({
    primary: uniColors.primary,
    buttonTextColor: uniColors.buttonTextColor,
  }), [uniColors]);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const initialTextBlockId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [contentBlocks, setContentBlocks] = useState([{ type: 'text', content: '', id: initialTextBlockId }]);
  const [focusedBlockIndex, setFocusedBlockIndex] = useState(0);
  const [focusedBlockId, setFocusedBlockId] = useState(initialTextBlockId);
  const textInputRefs = useRef({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [editCircleId, setEditCircleId] = useState(null);

  // 새로운 필드들
  const [keywords, setKeywords] = useState('');
  const [region, setRegion] = useState('서울');
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());

  // 날짜 선택기 열 때 tempDate 초기화
  useEffect(() => {
    if (showDatePicker && selectedDate) {
      setTempDate(selectedDate);
    } else if (showDatePicker) {
      setTempDate(new Date());
    }
  }, [showDatePicker]);
  const [location, setLocation] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedBaseAddress, setSelectedBaseAddress] = useState('');
  const [showDetailAddressInput, setShowDetailAddressInput] = useState(false);
  const [detailAddress, setDetailAddress] = useState('');
  const [participants, setParticipants] = useState('');
  const [fee, setFee] = useState('');
  const [contact, setContact] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollViewRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const regions = [
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

  // 날짜 포맷팅
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 시간 포맷팅
  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0시는 12시로 표시
    return `${hours}:${minutes} ${ampm}`;
  };

  // 날짜 선택 핸들러
  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && date) {
        setSelectedDate(date);
      }
    } else {
      // iOS에서는 임시로 저장 (확인 버튼을 눌러야 적용)
      if (date) {
        setTempDate(date);
      }
    }
  };

  // iOS 날짜 확인
  const confirmDate = () => {
    setSelectedDate(tempDate);
    setShowDatePicker(false);
  };

  // 시간 선택 핸들러
  const handleTimeChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (event.type === 'set' && date) {
        setSelectedTime(date);
      }
    } else {
      // iOS에서는 임시로 저장
      if (date) {
        setTempTime(date);
      }
    }
  };

  // iOS 시간 확인
  const confirmTime = () => {
    setSelectedTime(tempTime);
    setShowTimePicker(false);
  };

  // 수정 모드일 때 기존 데이터 불러오기
  useEffect(() => {
    if (editCircle) {
      setIsEditMode(true);
      setEditCircleId(editCircle.id);
      setTitle(editCircle.title || '');
        setUrl(editCircle.url || '');
        setContact(editCircle.contact || '');
        setAccountNumber(editCircle.accountNumber || '');
      setSelectedCategory(editCircle.category || initialCategory);
      // 키워드에서 # 제거 (입력란에는 # 없이 표시)
      const keywordsWithoutHash = editCircle.keywords ? editCircle.keywords.replace(/^#+/, '') : '';
      setKeywords(keywordsWithoutHash);
      setRegion(editCircle.region || '서울');
      setLocation(editCircle.location || '');
      setParticipants(editCircle.participants ? String(editCircle.participants) : '');
      setFee(editCircle.fee ? String(editCircle.fee) : '');
      
      // 날짜와 시간 설정 (ISO 형식만 지원, 날짜미정/시간미정은 더 이상 사용하지 않음)
      if (editCircle.eventDate && editCircle.eventDate !== '날짜미정' && !editCircle.eventDate.includes('날짜미정')) {
        try {
          // ISO 형식인 경우
          if (editCircle.eventDate.includes('T') || editCircle.eventDate.match(/^\d{4}-\d{2}-\d{2}/)) {
            const eventDate = new Date(editCircle.eventDate);
            if (!isNaN(eventDate.getTime())) {
              setSelectedDate(eventDate);
              // 시간이 "시간미정"이 아닌 경우에만 시간 설정
              if (!editCircle.eventDate.includes('시간미정')) {
                setSelectedTime(eventDate);
                setTempTime(eventDate);
              } else {
                // 기존 데이터에 시간미정이 있는 경우, 현재 시간으로 기본값 설정
                const defaultTime = new Date();
                defaultTime.setHours(12, 0, 0, 0); // 오후 12시로 기본값
                setSelectedTime(defaultTime);
                setTempTime(defaultTime);
              }
              setTempDate(eventDate);
            }
          } else if (editCircle.eventDate.includes('시간미정')) {
            // 기존 데이터에 "날짜 시간미정" 형식이 있는 경우
            const datePart = editCircle.eventDate.replace(' 시간미정', '').trim();
            // 날짜 문자열을 파싱 (예: "2025. 1. 1.")
            const dateMatch = datePart.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
            if (dateMatch) {
              const year = parseInt(dateMatch[1]);
              const month = parseInt(dateMatch[2]) - 1;
              const day = parseInt(dateMatch[3]);
              const eventDate = new Date(year, month, day);
              if (!isNaN(eventDate.getTime())) {
                setSelectedDate(eventDate);
                setTempDate(eventDate);
                // 시간은 기본값으로 설정 (오후 12시)
                const defaultTime = new Date();
                defaultTime.setHours(12, 0, 0, 0);
                setSelectedTime(defaultTime);
                setTempTime(defaultTime);
              }
            }
          }
        } catch (e) {
          console.error('날짜 파싱 오류:', e);
        }
      } else {
        // 기존 데이터에 날짜가 없는 경우, 오늘 날짜와 기본 시간 설정
        const today = new Date();
        setSelectedDate(today);
        setTempDate(today);
        const defaultTime = new Date();
        defaultTime.setHours(12, 0, 0, 0);
        setSelectedTime(defaultTime);
        setTempTime(defaultTime);
      }
      
      // contentBlocks 초기화
      let blocks = [];
      
      // content_blocks가 있으면 사용
      if (editCircle.content_blocks && editCircle.content_blocks.length > 0) {
        // content_blocks를 복사하고 각 블록에 고유 ID가 없으면 생성
        blocks = editCircle.content_blocks.map((block, index) => {
          if (!block.id) {
            return {
              ...block,
              id: block.type === 'image' 
                ? `img_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
                : `text_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
            };
          }
          return block;
        });
      }
      
      // content_blocks에 이미지가 없고 images 배열에 이미지가 있는 경우 추가
      const hasImageInContentBlocks = blocks.some(block => block.type === 'image');
      if (!hasImageInContentBlocks && editCircle.images && Array.isArray(editCircle.images) && editCircle.images.length > 0) {
        // images 배열의 이미지를 contentBlocks에 추가
        const imageBlocks = editCircle.images.map((imageUrl, index) => ({
          type: 'image',
          uri: imageUrl,
          id: `img_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
        }));
        
        // 텍스트 블록이 있으면 이미지를 텍스트 뒤에 추가, 없으면 앞에 추가
        if (blocks.length > 0) {
          blocks = [...blocks, ...imageBlocks];
        } else {
          blocks = [...imageBlocks, { type: 'text', content: '', id: initialTextBlockId }];
        }
      }
      
      // blocks가 비어있으면 빈 텍스트 블록 생성
      if (blocks.length === 0) {
        blocks = [{ type: 'text', content: '', id: initialTextBlockId }];
      }
      
      setContentBlocks(blocks);
      
      // 첫 번째 블록으로 포커스 설정
      if (blocks.length > 0) {
        const firstBlock = blocks[0];
        setFocusedBlockId(firstBlock.id);
        setFocusedBlockIndex(0);
      }
    }
  }, [editCircle]);


  // contentBlocks 변경 시 스크롤 위치 복원 (사용자가 스크롤한 위치 유지)
  const prevContentBlocksLength = useRef(contentBlocks.length);
  useEffect(() => {
    // contentBlocks가 변경되었지만 사용자가 이미 스크롤한 경우 위치 복원
    if (prevContentBlocksLength.current !== contentBlocks.length && scrollPositionRef.current > 0) {
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: scrollPositionRef.current,
            animated: false
          });
        }
      }, 0);
    }
    prevContentBlocksLength.current = contentBlocks.length;
  }, [contentBlocks.length]);

  const pickImageForContent = async () => {
    // 권한 요청
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('오류', '권한이 필요합니다.');
      return;
    }

    // 이미지 선택 (다중 선택 가능)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.6, // 품질을 낮춰서 파일 크기 줄이기
      base64: true, // base64 데이터도 함께 요청
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // 현재 포커스된 블록의 인덱스 찾기
      const insertIndex = contentBlocks.findIndex(block => block.id === focusedBlockId);
      const targetIndex = insertIndex !== -1 ? insertIndex : contentBlocks.length - 1;
      
      // 선택된 모든 이미지 처리
      const newImageBlocks = [];
      for (const asset of result.assets) {
        const imageUri = asset.uri;
        let base64Data = asset.base64; // base64 데이터
        
        // base64가 없으면 FileSystem으로 읽기
        if (!base64Data) {
          try {
            base64Data = await FileSystem.readAsStringAsync(imageUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (error) {
            console.error('이미지 읽기 오류:', error);
            continue; // 이 이미지는 건너뛰고 다음 이미지 처리
          }
        }
        
        const mimeType = imageUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const base64WithHeader = `data:${mimeType};base64,${base64Data}`;
        const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        newImageBlocks.push({ 
          type: 'image', 
          uri: imageUri, 
          id: imageId,
          base64: base64WithHeader // base64 데이터도 함께 저장
        });
      }
      
      if (newImageBlocks.length === 0) {
        Alert.alert('오류', '이미지를 읽을 수 없습니다.');
        return;
      }
      
      // 이미지와 새 텍스트 블록 생성
      const newTextBlock = { type: 'text', content: '', id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
      
      setContentBlocks(prevBlocks => {
        const newBlocks = [...prevBlocks];
        let currentIndex = targetIndex + 1;
        // 모든 이미지를 순차적으로 삽입
        newImageBlocks.forEach((imageBlock, idx) => {
          newBlocks.splice(currentIndex, 0, imageBlock);
          currentIndex++;
        });
        // 마지막 이미지 다음에 새 텍스트 블록 추가
        newBlocks.splice(currentIndex, 0, newTextBlock);
        return newBlocks;
      });
      
      // 새 텍스트 블록으로 포커스 이동
      setTimeout(() => {
        setFocusedBlockIndex(targetIndex + newImageBlocks.length + 1);
        setFocusedBlockId(newTextBlock.id);
        if (textInputRefs.current[newTextBlock.id]) {
          textInputRefs.current[newTextBlock.id].focus();
        }
      }, 150);
    }
  };

  const removeBlock = (blockId) => {
    const newBlocks = contentBlocks.filter(block => block.id !== blockId);
    // 블록이 모두 삭제되면 빈 텍스트 블록 하나 추가
    if (newBlocks.length === 0) {
      setContentBlocks([{ type: 'text', content: '', id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }]);
    } else {
      setContentBlocks(newBlocks);
    }
  };

  const updateTextBlock = (blockId, text) => {
    const newBlocks = contentBlocks.map(block => 
      block.id === blockId ? { ...block, content: text } : block
    );
    setContentBlocks(newBlocks);
  };

  const handleKeyPress = (e, blockId, blockIndex) => {
    // 백스페이스나 딜리트 키를 눌렀을 때
    if (e.nativeEvent.key === 'Backspace' || e.nativeEvent.key === 'Delete') {
      const block = contentBlocks[blockIndex];
      // 텍스트 블록이고 내용이 비어있거나, 이미지 블록이면 삭제
      if (block.type === 'image' || (block.type === 'text' && block.content === '')) {
        removeBlock(blockId);
        // 이전 블록으로 포커스 이동
        if (blockIndex > 0) {
          const prevBlockId = contentBlocks[blockIndex - 1].id;
          if (textInputRefs.current[prevBlockId]) {
            textInputRefs.current[prevBlockId].focus();
          }
        }
      }
    }
  };

  const deleteImageBlock = (imageBlockId) => {
    Alert.alert(
      '오류',
      '이 이미지를 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            setContentBlocks(prevBlocks => {
              const newBlocks = prevBlocks.filter(block => block.id !== imageBlockId);
              // 빈 배열이 되면 빈 텍스트 블록 하나 추가
              if (newBlocks.length === 0) {
                const emptyBlock = { type: 'text', content: '', id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
                return [emptyBlock];
              }
              return newBlocks;
            });
          }
        }
      ]
    );
  };

  // 이미지를 base64로 변환하여 서버에 업로드
  const uploadImage = async (base64Data) => {
    try {
      if (!base64Data) {
        throw new Error('이미지 데이터가 없습니다.');
      }
      
      
      // 서버에 업로드
      if (!targetUniversity) {
        throw new Error('university 정보가 없습니다.');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: base64Data,
          filename: `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
          university: targetUniversity.toLowerCase()
        }),
      });

      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('서버 오류 응답:', errorText);
        throw new Error(`이미지 업로드 실패 (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      return result.url;
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      if (error.message && error.message.includes('Network request failed')) {
        throw new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
      }
      throw error;
    }
  };

  const handleSubmit = async () => {
    // 중복 제출 방지
    if (isSubmitting) {
      return;
    }

    // 제목 검증
    if (!title.trim()) {
      Alert.alert('오류', '제목을 입력해주세요.');
      return;
    }

    // 내용 검증
    const hasContent = contentBlocks.some(block => 
      block.type === 'text' && block.content.trim() !== '' || 
      block.type === 'image'
    );
    if (!hasContent) {
      Alert.alert('오류', '내용을 입력해주세요.');
      return;
    }

    // 카테고리 검증
    if (!selectedCategory) {
      Alert.alert('입력 오류', '카테고리를 선택해주세요.');
      return;
    }

    // 키워드 검증
    if (!keywords.trim()) {
      Alert.alert('입력 오류', '키워드를 입력해주세요.');
      return;
    }

    // 지역 검증
    if (!region) {
      Alert.alert('입력 오류', '지역을 선택해주세요.');
      return;
    }

    // 연락처 검증
    if (!contact.trim()) {
      Alert.alert('입력 오류', '연락처를 입력해주세요.');
      return;
    }

    // 날짜 검증
    if (!selectedDate) {
      Alert.alert('입력 오류', '날짜를 설정해주세요. 대략적인 날짜라도 설정해야 합니다.');
      return;
    }

    // 시간 검증
    if (!selectedTime) {
      Alert.alert('입력 오류', '시간을 설정해주세요. 대략적인 시간이라도 설정해야 합니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 이미지 블록들을 서버에 업로드하고 URL로 변환
      const updatedContentBlocks = await Promise.all(
        contentBlocks.map(async (block) => {
          if (block.type === 'image') {
            if (block.base64) {
              try {
                const uploadedUrl = await uploadImage(block.base64);
                return { ...block, uri: uploadedUrl, base64: undefined }; // base64는 서버에 보낼 필요 없으므로 제거
              } catch (error) {
                console.error('이미지 업로드 실패:', error);
                // 업로드 실패 시 에러 발생
                throw new Error(`이미지 업로드 실패: ${error.message}`);
              }
            } else {
              // base64가 없는 경우 - 로컬 파일 경로인지 확인
              if (block.uri && block.uri.startsWith('file://')) {
                // 로컬 파일 경로는 다른 기기에서 접근 불가
                throw new Error('이미지가 서버에 업로드되지 않았습니다. 이미지를 다시 선택해주세요.');
              }
              // 이미 서버 URL인 경우 그대로 사용
              return block;
            }
          }
          return block;
        })
      );

      // Circles 데이터 준비
      const images = updatedContentBlocks.filter(block => block.type === 'image').map(block => block.uri);
      const textContent = updatedContentBlocks.filter(block => block.type === 'text').map(block => block.content).join('\n');
      
      // 날짜와 시간 처리 (둘 다 필수이므로 항상 ISO 형식으로 저장)
      const dateTime = new Date(selectedDate);
      const time = new Date(selectedTime);
      dateTime.setHours(time.getHours());
      dateTime.setMinutes(time.getMinutes());
      const finalEventDate = dateTime.toISOString();
      
      // 기본값 설정 (placeholder 값들)
      const finalLocation = location.trim() || '장소미정';
      const finalParticipants = participants.trim() || '제한없음';
      const finalFee = fee.trim() || '무료';
      
      // 현재 로그인한 사용자 이메일 가져오기 (Circle 작성자 표시용)
      const currentUserEmail = await AsyncStorage.getItem('currentUserEmail') || await AsyncStorage.getItem('currentUserId');
      if (!currentUserEmail || currentUserEmail === 'guest') {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      // university 확인
      if (!targetUniversity) {
        Alert.alert('오류', '학교 정보를 불러올 수 없습니다.');
        return;
      }

      // university를 소문자로 변환 (서버에서 소문자로 처리하므로)
      const normalizedUniversity = targetUniversity.toLowerCase();

      // API 서버로 전송 (수정 모드면 PUT, 아니면 POST)
      const apiUrl = isEditMode 
        ? `${API_BASE_URL}/api/circles/${editCircleId}`
        : `${API_BASE_URL}/api/circles`;
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await fetch(apiUrl, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          contentBlocks: updatedContentBlocks,
          textContent: textContent,
          images: images,
          category: selectedCategory,
          keywords: keywords.trim() ? '#' + keywords.trim() : '',
          region: region,
          eventDate: finalEventDate,
          location: finalLocation,
          participants: finalParticipants,
          fee: finalFee,
          author: currentUserEmail, // 이메일 저장 (표시 시 @ 앞부분만 표시)
          url: url && url.trim() ? url.trim() : null,
          contact: contact && contact.trim() ? contact.trim() : null,
          accountNumber: accountNumber && accountNumber.trim() ? accountNumber.trim() : null,
          university: normalizedUniversity,
        }),
      });

      // 응답이 JSON인지 확인
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`서버가 JSON 대신 다른 형식을 반환했습니다. (${response.status})`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '서버 오류가 발생했습니다.' }));
        const errorMessage = errorData.message ? `${errorData.error || '서버 오류가 발생했습니다.'}\n\n상세: ${errorData.message}` : (errorData.error || '서버 오류가 발생했습니다.');
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // 저장 성공 시 캐시 무효화 (공지사항과 동일하게)
      try {
        const universityCode = normalizedUniversity.toLowerCase();
        
        // 수정 모드인 경우 해당 circle의 캐시 무효화
        if (isEditMode && editCircleId) {
          const circleCacheKey = `circle_${editCircleId}_${universityCode}`;
          const contentCacheKey = `circle_content_${editCircleId}_${universityCode}`;
          await AsyncStorage.removeItem(circleCacheKey);
          await AsyncStorage.removeItem(contentCacheKey);
        }
        
        // circles 목록 캐시 무효화 (새 글이 추가되거나 수정되었으므로)
        const circlesCacheKey = `circles_${universityCode}`;
        const circlesTimestampKey = `circles_timestamp_${universityCode}`;
        await Promise.all([
          AsyncStorage.removeItem(circlesCacheKey),
          AsyncStorage.removeItem(circlesTimestampKey)
        ]);
      } catch (cacheError) {
        // 캐시 무효화 실패는 무시 (중요하지 않음)
        if (__DEV__) {
          console.warn('[WriteCirclesScreen] 캐시 무효화 실패:', cacheError);
        }
      }

      Alert.alert('성공', isEditMode ? 'Circles가 수정되었습니다.' : 'Circles가 등록되었습니다.', [
        {
          text: '확인',
          onPress: () => {
            if (isEditMode && editCircleId) {
              // 수정 모드일 때 ViewCirclesScreen으로 돌아가서 강제 새로고침
              navigation.navigate('ViewCircles', {
                circleId: editCircleId,
                selectedChannel: selectedChannel,
                forceRefresh: true // 강제 새로고침 플래그
              });
            } else {
              // 새로 작성한 경우 goBack() 사용 - CirclesScreen의 useFocusEffect에서 selectedChannel 상태를 유지함
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main');
              }
            }
          }
        }
      ]);
    } catch (error) {
      console.error('Circles 저장 실패:', error);
      
      // 네트워크 오류인 경우 더 자세한 메시지
      let errorMessage = error.message || 'Circles 저장 중 오류가 발생했습니다.';
      
      if (error.message && (error.message.includes('Network request failed') || error.message.includes('Failed to fetch'))) {
        errorMessage = '서버에 연결할 수 없습니다.\n\n확인사항:\n1. 서버가 실행 중인지 확인 (cd server && npm start)\n2. config/api.js의 IP 주소가 올바른지 확인 (현재: ' + API_BASE_URL + ')\n3. 모바일과 컴퓨터가 같은 Wi-Fi에 연결되어 있는지 확인';
      } else if (error.message && error.message.includes('JSON')) {
        errorMessage = '서버 응답 오류입니다.\n\n확인사항:\n1. 서버가 정상 실행 중인지 확인\n2. 서버 로그 확인\n3. 서버 URL이 올바른지 확인: ' + API_BASE_URL;
      }
      
      Alert.alert('오류', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.primary }}>
      {/* Circles 작성 영역 */}
      <View className="flex-1 bg-white" style={{ marginTop: 70, ...(Platform.OS === 'web' ? { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', overflow: 'hidden' } : {})}}>
        <View className="flex-row items-center justify-between px-6 border-b border-gray-200" style={{ height: 60, paddingTop: 5, paddingBottom: 5, ...(Platform.OS === 'web' ? { flexShrink: 0 } : {})}}>
          <Text className="text-xl font-bold" style={{ color: colors.primary }}>{isEditMode ? '소모임 수정' : '소모임 만들기'}</Text>
          <TouchableOpacity
            onPress={() => {
              if (selectedChannel) {
                navigation.navigate('Main', { screen: 'Club', params: { selectedChannel } });
              } else {
                if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main');
              }
              }
            }}
            style={{ padding: 8, marginRight: -8 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text className="text-xl font-bold text-gray-400">✕</Text>
          </TouchableOpacity>
        </View>

        {(() => {
          const scrollViewContent = (
            <>
              <View>
                <Text className="text-base font-semibold text-gray-900 mb-2">카테고리</Text>
                <TouchableOpacity
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 flex-row items-center justify-between"
                  style={{ marginBottom: showCategoryPicker ? 0 : 16 }}
                >
                  <Text className="text-base text-gray-700">{selectedCategory}</Text>
                  <Text className="text-gray-400">▼</Text>
                </TouchableOpacity>

                {showCategoryPicker && (
                  <View 
                    className="bg-white border border-gray-300 rounded-lg shadow-sm mb-4"
                    style={{
                      marginTop: 0,
                      zIndex: 1000,
                      elevation: 5
                    }}
                  >
                    {categories.filter(cat => cat !== selectedCategory).map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => {
                          setSelectedCategory(cat);
                          setShowCategoryPicker(false);
                        }}
                        className="p-3 border-b border-gray-100"
                      >
                        <Text className="text-base" style={{ color: '#374151' }}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* 키워드 */}
              <Text className="text-base font-semibold text-gray-900 mb-2">키워드</Text>
              <View className="flex-row items-center border border-gray-300 rounded-lg bg-white mb-4" style={{
                paddingLeft: 10,
                paddingRight: 10,
                ...(Platform.OS === 'ios' ? {
                  paddingTop: 8,
                  paddingBottom: 12,
                } : {
                  paddingVertical: 10,
                }),
              }}>
                <Text style={{ fontSize: 16, color: '#374151', marginRight: 4 }}>#</Text>
              <TextInput
                  placeholder="키워드를 입력하세요 (예: 축구, 독서, 요리)"
                placeholderTextColor="#9ca3af"
                value={keywords}
                onChangeText={(text) => {
                    // # 제거 (입력란에는 # 없이 표시)
                    const cleanedText = text.startsWith('#') ? text.substring(1) : text;
                    setKeywords(cleanedText);
                }}
                style={{
                    flex: 1,
                    fontSize: 16,
                    color: '#374151',
                    paddingVertical: 0,
                    paddingHorizontal: 0,
                  ...(Platform.OS === 'ios' ? {
                    lineHeight: 20,
                    } : {
                      textAlignVertical: 'center',
                      includeFontPadding: false,
                    }),
                  ...(Platform.OS === 'web' ? {
                    outline: 'none',
                      border: 'none',
                      backgroundColor: 'transparent'
                  } : {})
                }}
              />
              </View>

              {/* 날짜 */}
              <View>
                <Text className="text-base font-semibold text-gray-900 mb-2">날짜</Text>
                <View className="flex-row items-center mb-4">
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    className="bg-gray-50 border border-gray-300 rounded-lg p-3 flex-row items-center justify-between"
                    style={{ flex: 1 }}
                  >
                    <Text className="text-base" style={{ color: selectedDate ? '#374151' : '#9ca3af' }}>
                      {selectedDate ? formatDate(selectedDate) : '날짜 선택'}
                    </Text>
                    <Text className="text-gray-400">📅</Text>
                  </TouchableOpacity>
                </View>
                {showDatePicker && (
                  <>
                    <DateTimePicker
                      value={selectedDate || tempDate || new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={handleDateChange}
                      minimumDate={new Date()}
                    />
                    {Platform.OS === 'ios' && (
                      <View className="flex-row justify-end mt-2" style={{ marginBottom: 16 }}>
                        <TouchableOpacity
                          onPress={() => setShowDatePicker(false)}
                          className="rounded-lg"
                          style={{
                            backgroundColor: getConfig('popup_manage_edit_button_background_color', '#e5e7eb'),
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 8,
                            marginRight: 8
                          }}
                        >
                          <Text style={{ color: miuhubPrimary }}>
                            취소
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={confirmDate}
                          className="rounded-lg"
                          style={{ 
                            backgroundColor: miuhubPrimary,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 8
                          }}
                        >
                          <Text style={{ color: '#ffffff' }}>
                            확인
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* 시간 */}
              <View>
                <Text className="text-base font-semibold text-gray-900 mb-2">시간</Text>
                <View className="flex-row items-center mb-4">
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    className="bg-gray-50 border border-gray-300 rounded-lg p-3 flex-row items-center justify-between"
                    style={{ flex: 1 }}
                  >
                    <Text className="text-base" style={{ color: selectedTime ? '#374151' : '#9ca3af' }}>
                      {selectedTime ? formatTime(selectedTime) : '시간 선택'}
                    </Text>
                    <Text className="text-gray-400">🕐</Text>
                  </TouchableOpacity>
                </View>
                {showTimePicker && (
                  <>
                    <DateTimePicker
                      value={selectedTime || tempTime || new Date()}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                      onChange={handleTimeChange}
                      is24Hour={false}
                    />
                    {(Platform.OS === 'ios' || Platform.OS === 'android') && (
                      <View className="flex-row justify-end mt-2 mb-4">
                        <TouchableOpacity
                          onPress={() => setShowTimePicker(false)}
                          className="px-4 py-2 bg-gray-200 rounded-lg mr-2"
                        >
                          <Text>취소</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={confirmTime}
                          className="px-4 py-2 rounded-lg"
                          style={{ backgroundColor: colors.primary }}
                        >
                          <Text className="text-white">확인</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* 지역 */}
              <View>
                <Text className="text-base font-semibold text-gray-900 mb-2">지역</Text>
                <TouchableOpacity
                  onPress={() => setShowRegionPicker(!showRegionPicker)}
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 flex-row items-center justify-between mb-4"
                >
                  <Text className="text-base text-gray-700">{region}</Text>
                  <Text className="text-gray-400">▼</Text>
                </TouchableOpacity>

                {showRegionPicker && (
                  <View 
                    className="bg-white border border-gray-300 rounded-lg shadow-sm mb-4"
                    style={{
                      marginTop: -16,
                      zIndex: 1000,
                      elevation: 5,
                      maxHeight: 144
                    }}
                  >
                    <ScrollView 
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      style={{ maxHeight: 144 }}
                    >
                      {regions.filter(r => r !== region).map((r) => (
                        <TouchableOpacity
                          key={r}
                          onPress={() => {
                            setRegion(r);
                            setShowRegionPicker(false);
                          }}
                          className="p-3 border-b border-gray-100"
                        >
                          <Text className="text-base" style={{ color: '#374151' }}>
                            {r}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* 장소 */}
              <Text className="text-base font-semibold text-gray-900 mb-2">장소</Text>
              <View className="flex-row items-center mb-4">
                <TouchableOpacity
                  onPress={() => setShowAddressModal(true)}
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 flex-row items-center justify-between"
                  style={{ flex: 1, marginRight: location ? 8 : 0 }}
                >
                  <Text className="text-base" style={{ color: location ? '#374151' : '#9ca3af' }}>
                    {location || '장소미정'}
                  </Text>
                  <Text className="text-gray-400">🔍</Text>
                </TouchableOpacity>
                {location && (
                  <TouchableOpacity
                    onPress={() => setLocation('')}
                    className="px-3 py-3 bg-gray-200 rounded-lg"
                  >
                    <Text className="text-sm text-gray-600">초기화</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 주소 검색 모달 */}
              <Modal
                visible={showAddressModal}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setShowAddressModal(false)}
              >
                <View style={{ flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 0, backgroundColor: '#fff' }}>
                  {!showDetailAddressInput ? (
                    <>
                  <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" style={{ paddingTop: Platform.OS === 'android' ? 20 : 0 }}>
                        <Text className="text-lg font-bold">장소 검색</Text>
                    <TouchableOpacity
                          onPress={() => {
                            setShowAddressModal(false);
                            setShowDetailAddressInput(false);
                          }}
                      style={{ padding: 8 }}
                    >
                      <Text className="text-xl font-bold text-gray-400">✕</Text>
                    </TouchableOpacity>
                  </View>
                  <WebView
                    source={{
                      html: `
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <meta charset="utf-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                            <style>
                              * { margin: 0; padding: 0; box-sizing: border-box; }
                              html, body { width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                              #container { width: 100%; height: 100%; display: flex; flex-direction: column; background: #fff; }
                              #searchBox { padding: 12px; border-bottom: 1px solid #e0e0e0; background: #fff; }
                              #searchInput { width: 100%; padding: 10px 12px; border: 1px solid #d0d0d0; border-radius: 6px; font-size: 16px; }
                              #searchInput:focus { outline: none; border-color: colors.primary; }
                              #searchButton { margin-top: 8px; width: 100%; padding: 10px; background: colors.primary; color: #fff; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; }
                              #searchButton:active { background: #45056a; }
                              #results { flex: 1; overflow-y: auto; padding: 8px; background: #f5f5f5; }
                              .result-item { background: #fff; padding: 14px; margin-bottom: 8px; border-radius: 8px; border: 1px solid #e0e0e0; cursor: pointer; }
                              .result-item:hover { background: #f9f9f9; border-color: colors.primary; }
                              .result-item:active { background: #f0f0f0; }
                              .place-name { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 6px; }
                              .place-address { font-size: 14px; color: #666; margin-bottom: 4px; }
                              .place-category { font-size: 12px; color: #999; }
                              .no-results { text-align: center; padding: 40px 20px; color: #999; }
                              .loading { text-align: center; padding: 20px; color: #999; }
                            </style>
                          </head>
                          <body>
                            <div id="container">
                              <div id="searchBox">
                                <input type="text" id="searchInput" placeholder="레스토랑, 건물명, 상호명 등을 검색하세요" autocomplete="off" />
                                <button id="searchButton" onclick="performSearch()">검색</button>
                              </div>
                              <div id="results">
                                <div class="no-results">검색어를 입력하고 검색 버튼을 누르세요</div>
                              </div>
                            </div>
                            <script>
                              (function() {
                                var searchInput = document.getElementById('searchInput');
                                var resultsDiv = document.getElementById('results');
                                var apiBaseUrl = ${JSON.stringify(API_BASE_URL)};
                                
                                // Enter 키로 검색
                                searchInput.addEventListener('keypress', function(e) {
                                  if (e.key === 'Enter') {
                                    performSearch();
                                  }
                                });
                                
                                window.performSearch = function() {
                                  var keyword = searchInput.value.trim();
                                  
                                  if (keyword.length < 2) {
                                    resultsDiv.innerHTML = '<div class="no-results">검색어를 2자 이상 입력하세요</div>';
                                    return;
                                  }
                                  
                                  resultsDiv.innerHTML = '<div class="loading">검색 중...</div>';
                                  
                                  // 서버를 통한 네이버 검색 API 호출
                                  var apiUrl = apiBaseUrl + '/api/places/search?query=' + encodeURIComponent(keyword);
                                  
                                  fetch(apiUrl, {
                                    method: 'GET',
                                    headers: {
                                      'Content-Type': 'application/json'
                                    }
                                  })
                                  .then(function(response) {
                                    return response.json();
                                  })
                                  .then(function(data) {
                                    if (data.success && data.items && data.items.length > 0) {
                                      displayResults(data.items);
                                    } else if (data.error) {
                                      resultsDiv.innerHTML = '<div class="no-results">' + data.error + '<br>' + (data.message || '') + '</div>';
                                    } else {
                                      resultsDiv.innerHTML = '<div class="no-results">검색 결과가 없습니다</div>';
                                        }
                                  })
                                  .catch(function(error) {
                                    console.error('검색 오류:', error);
                                    resultsDiv.innerHTML = '<div class="no-results">검색 중 오류가 발생했습니다.<br>서버가 실행 중인지 확인해주세요.</div>';
                                  });
                                };
                                
                                function displayResults(places) {
                                  if (!places || places.length === 0) {
                                    resultsDiv.innerHTML = '<div class="no-results">검색 결과가 없습니다</div>';
                                    return;
                                  }
                                  
                                  var html = '';
                                  places.forEach(function(place) {
                                    var placeName = (place.title || '').replace(/<[^>]*>/g, '');
                                    var address = place.address || place.roadAddress || '';
                                    var category = place.category || '';
                                    
                                    html += '<div class="result-item" onclick="selectPlace(\\'' + 
                                      placeName.replace(/'/g, "\\'").replace(/"/g, '&quot;') + '\\', \\'' + 
                                      address.replace(/'/g, "\\'").replace(/"/g, '&quot;') + '\\')">';
                                    html += '<div class="place-name">' + placeName + '</div>';
                                    if (address) {
                                      html += '<div class="place-address">' + address + '</div>';
                                    }
                                    if (category) {
                                      html += '<div class="place-category">' + category + '</div>';
                                    }
                                    html += '</div>';
                                  });
                                  
                                  resultsDiv.innerHTML = html;
                                }
                                
                                window.selectPlace = function(placeName, address) {
                                  var fullAddress = placeName;
                                  if (address) {
                                    fullAddress += ', ' + address;
                                  }
                                  
                                        if (window.ReactNativeWebView) {
                                          window.ReactNativeWebView.postMessage(JSON.stringify({
                                      type: 'address',
                                      address: fullAddress,
                                      placeName: placeName,
                                      zonecode: ''
                                    }));
                                }
                                };
                              })();
                            </script>
                          </body>
                        </html>
                      `
                    }}
                    style={{ flex: 1, backgroundColor: '#fff' }}
                    onMessage={(event) => {
                      try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.type === 'address') {
                          // 기본 주소를 저장하고 상세주소 입력 화면으로 전환
                          setSelectedBaseAddress(data.address);
                          setShowDetailAddressInput(true);
                        } else if (data.type === 'close') {
                          setShowAddressModal(false);
                          setShowDetailAddressInput(false);
                        }
                      } catch (e) {
                        console.error('주소 파싱 오류:', e);
                      }
                    }}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                    mixedContentMode="always"
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false}
                    onError={(syntheticEvent) => {
                      const { nativeEvent } = syntheticEvent;
                      console.error('WebView error: ', nativeEvent);
                    }}
                    onHttpError={(syntheticEvent) => {
                      const { nativeEvent } = syntheticEvent;
                      console.error('WebView HTTP error: ', nativeEvent);
                    }}
                    onLoadEnd={() => {
                    }}
                  />
                    </>
                  ) : (
                    <>
                      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200" style={{ paddingTop: Platform.OS === 'android' ? 20 : 0 }}>
                        <Text className="text-lg font-bold">상세주소 입력</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setShowDetailAddressInput(false);
                            setDetailAddress('');
                          }}
                          style={{ padding: 8 }}
                        >
                          <Text className="text-xl font-bold text-gray-400">✕</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1, padding: 16 }}>
                        <Text className="text-base font-semibold text-gray-900 mb-2">기본 주소</Text>
                        <View className="bg-gray-50 border border-gray-300 rounded-lg p-3 mb-4">
                          <Text className="text-base text-gray-700">{selectedBaseAddress}</Text>
                        </View>
                        <Text className="text-base font-semibold text-gray-900 mb-2">상세주소 (선택사항)</Text>
                        <TextInput
                          className="border border-gray-300 rounded-lg text-base bg-white mb-4"
                          placeholder="동/호수, 건물명 등을 입력하세요"
                          placeholderTextColor="#9ca3af"
                          value={detailAddress}
                          onChangeText={setDetailAddress}
                          style={{
                            padding: 12,
                            ...(Platform.OS === 'ios' ? {
                              paddingTop: 10,
                              paddingBottom: 14,
                              paddingLeft: 12,
                              paddingRight: 12,
                              lineHeight: 20,
                            } : {}),
                            ...(Platform.OS === 'web' ? {
                              outline: 'none',
                              border: '1px solid #d1d5db',
                              borderRadius: 8,
                              backgroundColor: '#ffffff'
                            } : {})
                          }}
                        />
                        <View className="flex-row justify-end mt-4">
                          <TouchableOpacity
                            onPress={() => {
                              setShowDetailAddressInput(false);
                              setDetailAddress('');
                            }}
                            className="px-6 py-3 bg-gray-200 rounded-lg mr-2"
                          >
                            <Text className="text-base font-semibold text-gray-700">취소</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              const fullAddress = detailAddress.trim() 
                                ? `${selectedBaseAddress} ${detailAddress.trim()}`
                                : selectedBaseAddress;
                              setLocation(fullAddress);
                              setShowAddressModal(false);
                              setShowDetailAddressInput(false);
                              setDetailAddress('');
                            }}
                            className="px-6 py-3 rounded-lg"
                            style={{ backgroundColor: colors.primary }}
                          >
                            <Text className="text-base font-semibold text-white">확인</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </Modal>

              {/* 참가인원 */}
              <Text className="text-base font-semibold text-gray-900 mb-2">참가인원</Text>
              <TextInput
                className="border border-gray-300 rounded-lg text-base bg-white mb-4"
                placeholder="제한없음"
                placeholderTextColor="#9ca3af"
                value={participants}
                onChangeText={(text) => {
                  // 숫자만 입력 가능하도록 필터링
                  const numericText = text.replace(/[^0-9]/g, '');
                  setParticipants(numericText);
                }}
                keyboardType="numeric"
                style={{
                  padding: 10,
                  ...(Platform.OS === 'ios' ? {
                    paddingTop: 8,
                    paddingBottom: 12,
                    paddingLeft: 10,
                    paddingRight: 10,
                    lineHeight: 20,
                  } : {}),
                  ...(Platform.OS === 'web' ? {
                    outline: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  } : {})
                }}
              />

              {/* 참가비 */}
              <Text className="text-base font-semibold text-gray-900 mb-2">참가비</Text>
              <TextInput
                className="border border-gray-300 rounded-lg text-base bg-white mb-4"
                placeholder="무료"
                placeholderTextColor="#9ca3af"
                value={fee}
                onChangeText={(text) => {
                  // 숫자만 입력 가능하도록 필터링
                  const numericText = text.replace(/[^0-9]/g, '');
                  // 천단위 콤마 추가
                  if (numericText) {
                    const formattedText = parseInt(numericText).toLocaleString('ko-KR');
                    setFee(formattedText);
                  } else {
                    setFee('');
                  }
                }}
                keyboardType="numeric"
                style={{
                  padding: 10,
                  ...(Platform.OS === 'ios' ? {
                    paddingTop: 8,
                    paddingBottom: 12,
                    paddingLeft: 10,
                    paddingRight: 10,
                    lineHeight: 20,
                  } : {}),
                  ...(Platform.OS === 'web' ? {
                    outline: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  } : {})
                }}
              />

              <Text className="text-base font-semibold text-gray-900 mb-2">연락처</Text>
              <TextInput
                className="border border-gray-300 rounded-lg text-base bg-white mb-4"
                placeholder="핸드폰 번호 or 이메일 주소"
                placeholderTextColor="#9ca3af"
                value={contact}
                onChangeText={setContact}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  padding: 10,
                  ...(Platform.OS === 'ios' ? {
                    paddingTop: 8,
                    paddingBottom: 12,
                    paddingLeft: 10,
                    paddingRight: 10,
                    lineHeight: 20,
                  } : {}),
                  ...(Platform.OS === 'web' ? {
                    outline: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  } : {})
                }}
              />

              <Text className="text-base font-semibold text-gray-900 mb-2">계좌번호 (optional)</Text>
              <TextInput
                className="border border-gray-300 rounded-lg text-base bg-white mb-4"
                placeholder="계좌번호를 입력하세요"
                placeholderTextColor="#9ca3af"
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  padding: 10,
                  ...(Platform.OS === 'ios' ? {
                    paddingTop: 8,
                    paddingBottom: 12,
                    paddingLeft: 10,
                    paddingRight: 10,
                    lineHeight: 20,
                  } : {}),
                  ...(Platform.OS === 'web' ? {
                    outline: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  } : {})
                }}
              />

              <Text className="text-base font-semibold text-gray-900 mb-2">제목</Text>
              <TextInput
                className="border border-gray-300 rounded-lg text-base bg-white mb-4"
                placeholder="제목을 입력하세요"
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
                style={{
                  padding: 10,
                  ...(Platform.OS === 'android' ? {
                    textAlignVertical: 'center',
                    includeFontPadding: false,
                  } : Platform.OS === 'ios' ? {
                    lineHeight: 20,
                  } : {}),
                  ...(Platform.OS === 'web' ? {
                    outline: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  } : {})
                }}
              />

              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-semibold text-gray-900">내용</Text>
                <TouchableOpacity
                  onPress={pickImageForContent}
                  className="px-3 py-1 rounded"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="text-sm font-semibold text-white">📷 첨부</Text>
                </TouchableOpacity>
              </View>
              <View className="border border-gray-300 rounded-lg bg-white mb-4" style={{ minHeight: 300, padding: 10 }}>
                {contentBlocks.map((block, index) => {
                    if (block.type === 'image') {
                      return (
                        <View key={block.id} style={{ width: '100%', marginBottom: 12, position: 'relative' }}>
                          <ImageBlock uri={block.uri} />
                          <TouchableOpacity
                            onPress={() => deleteImageBlock(block.id)}
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              backgroundColor: '#EF4444',
                              borderRadius: 20,
                              width: 32,
                              height: 32,
                              justifyContent: 'center',
                              alignItems: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.25,
                              shadowRadius: 3.84,
                              elevation: 5,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>×</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    } else {
                      return (
                        <TouchableOpacity
                          key={block.id}
                          activeOpacity={1}
                          onPress={() => {
                            if (textInputRefs.current[block.id]) {
                              textInputRefs.current[block.id].focus();
                            }
                          }}
                          style={{ minHeight: 40, width: '100%', flex: 1, pointerEvents: 'box-none' }}
                        >
                          <TextInput
                            ref={(ref) => {
                              if (ref) {
                                textInputRefs.current[block.id] = ref;
                              }
                            }}
                            className="text-base"
                            placeholder="내용을 입력하세요"
                            placeholderTextColor="#9ca3af"
                            value={block.content}
                            onChangeText={(text) => {
                              updateTextBlock(block.id, text);
                            }}
                            onFocus={() => {
                              setFocusedBlockIndex(index);
                              setFocusedBlockId(block.id);
                            }}
                            onKeyPress={(e) => {
                              handleKeyPress(e, block.id, index);
                            }}
                            multiline
                            textAlignVertical="top"
                            style={{
                              fontSize: 16,
                              lineHeight: 24,
                              color: '#000000',
                              minHeight: 40,
                              padding: 0,
                              marginBottom: 4,
                              width: '100%',
                              pointerEvents: 'auto',
                              ...(Platform.OS === 'web' ? {
                                outline: 'none',
                                border: 'none'
                              } : {})
                            }}
                          />
                        </TouchableOpacity>
                      );
                    }
                  })}
              </View>

              <Text className="text-base font-semibold text-gray-900 mb-2">RSVP (optional)</Text>
              <TextInput
                className="border border-gray-300 rounded-lg text-base bg-white mb-4"
                placeholder="바로가기 버튼이 생성됩니다"
                placeholderTextColor="#9ca3af"
                value={url}
                onChangeText={setUrl}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  padding: 10,
                  ...(Platform.OS === 'ios' ? {
                    paddingTop: 8,
                    paddingBottom: 12,
                    paddingLeft: 10,
                    paddingRight: 10,
                    lineHeight: 20,
                  } : {}),
                  ...(Platform.OS === 'web' ? {
                    outline: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  } : {})
                }}
              />
              
              <View className="flex-row gap-3 mb-6 mt-6">
                <TouchableOpacity
                  onPress={() => {
                    if (selectedChannel) {
                      navigation.navigate('Main', { screen: 'Club', params: { selectedChannel } });
                    } else {
                      if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main');
              }
                    }
                  }}
                  className="flex-1 bg-gray-200 p-4 rounded-lg items-center"
                >
                  <Text className="text-base font-semibold text-gray-700">이전</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  className="flex-1 p-4 rounded-lg items-center"
                  style={{ backgroundColor: isSubmitting ? '#9ca3af' : colors.primary }}
                  disabled={isSubmitting}
                >
                  <Text className="text-base font-semibold text-white">
                    {isSubmitting ? '처리 중...' : (isEditMode ? '수정' : '등록')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          );

          if (Platform.OS === 'web') {
            return (
              <ScrollView 
                className="px-6 pt-4" 
                style={{ 
                  flex: 1,
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch'
                }}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ 
                  paddingBottom: 300
                }}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                scrollEnabled={true}
                bounces={false}
              >
                {scrollViewContent}
              </ScrollView>
            );
          } else {
            return (
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={100}
              >
                <ScrollView 
                  ref={scrollViewRef}
                  className="px-6 pt-4" 
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ 
                    paddingBottom: 300,
                    flexGrow: 1
                  }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}
                  scrollEnabled={true}
                  onScroll={(event) => {
                    scrollPositionRef.current = event.nativeEvent.contentOffset.y;
                  }}
                  scrollEventThrottle={16}
                >
                  {scrollViewContent}
                </ScrollView>
              </KeyboardAvoidingView>
            );
          }
        })()}
      </View>
    </View>
  );
}

