import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator, Modal, Platform, Share, AppState } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import API_BASE_URL from '../config/api';
import { useUniversity } from '../contexts/UniversityContext';
import { getCategoryPassword } from './categoryPasswords';
import { useAppConfig } from '../contexts/AppConfigContext';
import { getUniColors } from '../utils/uniColors';
import GlobalPopup from '../components/GlobalPopup';
import { supabase } from '../config/supabase';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { university } = useUniversity();
  const { getConfig, getConfigNumber, getColorConfig } = useAppConfig();
  const config = { getColorConfig };
  
  // CirclesScreen과 동일하게 getUniColors 사용 (useMemo로 감싸서 university 변경 시 재계산)
  const uniColors = useMemo(() => getUniColors(university, config), [university, getColorConfig]);
  const colors = useMemo(() => ({
    primary: uniColors.primary,
    buttonTextColor: uniColors.buttonTextColor,
  }), [uniColors]);
  const [logoImageUrl, setLogoImageUrl] = useState(null); // 로고 이미지 URL
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [raffleNumber, setRaffleNumber] = useState(null);
  const [showRaffleModal, setShowRaffleModal] = useState(false);
  const [raffleDate, setRaffleDate] = useState(null);
  const [raffleStartTime, setRaffleStartTime] = useState(null);
  const [raffleEndTime, setRaffleEndTime] = useState(null);
  const [raffleMaxNumber, setRaffleMaxNumber] = useState('');
  const [rafflePassword, setRafflePassword] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [tempStartTime, setTempStartTime] = useState(new Date());
  const [tempEndTime, setTempEndTime] = useState(new Date());
  const [raffles, setRaffles] = useState([]);
  const [currentRaffle, setCurrentRaffle] = useState(null);
  const [showDeleteRaffleModal, setShowDeleteRaffleModal] = useState(false);
  const [deleteRafflePassword, setDeleteRafflePassword] = useState('');

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
        setRaffleDate(date);
      }
    } else {
      if (date) {
        setRaffleDate(date);
        setShowDatePicker(false);
      }
    }
  };

  // 시작 시간 선택 핸들러
  const handleStartTimeChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
      if (event.type === 'set' && date) {
        setRaffleStartTime(date);
      }
    } else {
      if (date) {
        setTempStartTime(date);
      }
    }
  };

  // 종료 시간 선택 핸들러
  const handleEndTimeChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowEndTimePicker(false);
      if (event.type === 'set' && date) {
        setRaffleEndTime(date);
      }
    } else {
      if (date) {
        setTempEndTime(date);
      }
    }
  };

  // iOS 날짜 확인
  const confirmDate = () => {
    setRaffleDate(tempDate);
    setShowDatePicker(false);
  };

  // iOS 시작 시간 확인
  const confirmStartTime = () => {
    setRaffleStartTime(tempStartTime);
    setShowStartTimePicker(false);
  };

  // iOS 종료 시간 확인
  const confirmEndTime = () => {
    setRaffleEndTime(tempEndTime);
    setShowEndTimePicker(false);
  };

  // 비밀번호 정책 검증
  const checkPasswordRequirements = (pwd) => {
    return {
      minLength: pwd.length >= 8,
      hasUpperCase: /(?=.*[A-Z])/.test(pwd),
      hasLowerCase: /(?=.*[a-z])/.test(pwd),
      hasNumber: /(?=.*[0-9])/.test(pwd),
      hasSpecialChar: /(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(pwd),
    };
  };

  // 사용자 정보 불러오기
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const currentUserId = await AsyncStorage.getItem('currentUserId');
        if (currentUserId && currentUserId !== 'guest') {
          setUserId(currentUserId);
        }
      } catch (error) {
        console.error('사용자 정보 불러오기 실패:', error);
      }
    };
    loadUserInfo();
  }, []);

  // 로고 이미지 URL 로드 (학교 이름 기반)
  useEffect(() => {
    const loadLogoImage = async () => {
      if (!university) {
        setLogoImageUrl(null);
        return;
      }

      // 학교 이름을 소문자로 변환하여 display_name 확인
      const uniLower = university.toLowerCase();
      const displayName = getConfig(`${uniLower}_display_name`, '');
      
      // display_name이 있으면 그것을 사용, 없으면 university 그대로 사용
      const universityDisplayName = displayName || university;
      
      // 이미지 파일명 생성 (예: Cornell.png)
      const imageFileName = `${universityDisplayName}.png`;
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/supabase-image-url?filename=${encodeURIComponent(imageFileName)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.url) {
            setLogoImageUrl({ uri: data.url });
          } else {
            setLogoImageUrl(null);
          }
        } else {
          setLogoImageUrl(null);
        }
      } catch (error) {
        setLogoImageUrl(null);
      }
    };
    
    loadLogoImage();
  }, [university, getConfig]);

  // Raffle 목록 로드 함수
  const loadRaffles = React.useCallback(async (silent = false) => {
    try {
      const currentUniversity = university || await AsyncStorage.getItem('currentUserUniversity');
      if (!currentUniversity) return false; // raffle 존재 여부 반환

      const currentUserId = await AsyncStorage.getItem('currentUserId');
      
      const response = await fetch(
        `${API_BASE_URL}/api/raffles?university=${encodeURIComponent(currentUniversity.toLowerCase())}`
      );
      
      if (!response.ok) {
        if (!silent) {
          console.error('Raffle 목록 불러오기 실패:', response.statusText);
        }
        return false;
      }
      
      const result = await response.json();
      
      // raffle이 있을 때만 로그 출력 (과부하 방지)
      if (result.success && result.raffles && result.raffles.length > 0) {
        if (!silent) {
          console.log('[Profile] Raffle 발견:', {
            count: result.raffles.length,
            latestId: result.raffles[0]?.id
          });
        }
        
        setRaffles(result.raffles);
        // 가장 최근 raffle을 현재 raffle로 설정
        const latestRaffle = result.raffles[0];
        setCurrentRaffle(latestRaffle);
        
        // 현재 사용자가 이미 참여한 경우 번호 표시
        if (currentUserId && latestRaffle.participants && Array.isArray(latestRaffle.participants)) {
          const userParticipant = latestRaffle.participants.find(p => p.userId === currentUserId);
          if (userParticipant && userParticipant.number) {
            setRaffleNumber(userParticipant.number);
          } else {
            setRaffleNumber(null);
          }
        } else {
          setRaffleNumber(null);
        }
        return true; // raffle 존재
      } else {
        // raffle이 없으면 초기화
        setRaffles([]);
        setCurrentRaffle(null);
        setRaffleNumber(null);
        return false; // raffle 없음
      }
    } catch (error) {
      if (!silent) {
        console.error('Raffle 목록 불러오기 실패:', error);
      }
      setRaffles([]);
      setCurrentRaffle(null);
      setRaffleNumber(null);
      return false;
    }
  }, [university]);

  // Raffle 목록 로드 - 화면 포커스 시마다 새로고침 + 주기적으로 체크 (raffle이 있을 때만)
  const intervalRef = useRef(null);
  const hasRaffleRef = useRef(false); // raffle 존재 여부 추적
  
  useFocusEffect(
    React.useCallback(() => {
      // 즉시 로드 (첫 로드)
      loadRaffles(false).then(hasRaffle => {
        hasRaffleRef.current = hasRaffle;
        
        // raffle이 있을 때만 주기적 새로고침 시작
        if (hasRaffle) {
          intervalRef.current = setInterval(async () => {
            const stillHasRaffle = await loadRaffles(true); // silent 모드로 호출
            hasRaffleRef.current = stillHasRaffle;
            
            // raffle이 사라지면 interval 중단
            if (!stillHasRaffle && intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }, 10000); // 10초마다 (raffle이 있을 때만)
        }
      });
      
      // 화면 포커스 해제 시 interval 정리
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [loadRaffles])
  );
  
  // 앱이 포그라운드로 돌아올 때도 새로고침 (raffle이 있을 때만 주기적 호출 재시작)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        const hasRaffle = await loadRaffles(false);
        hasRaffleRef.current = hasRaffle;
        
        // raffle이 있고 interval이 없으면 재시작
        if (hasRaffle && !intervalRef.current) {
          intervalRef.current = setInterval(async () => {
            const stillHasRaffle = await loadRaffles(true);
            hasRaffleRef.current = stillHasRaffle;
            
            if (!stillHasRaffle && intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }, 10000);
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [loadRaffles]);

  const loadUserInfo_DISABLED = async () => {
    try {
      setLoading(true);
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      
      if (!currentUserId || currentUserId === 'guest') {
        console.error('로그인한 사용자 정보가 없습니다.');
        setLoading(false);
        return;
      }
      
      setUserId(currentUserId);
      
      // 이메일은 userId에 이미 저장되어 있음 (currentUserId가 이메일)
    } catch (error) {
      console.error('사용자 정보 불러오기 실패:', error);
      Alert.alert('오류', '사용자 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('입력 오류', '새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
      return;
    }

    // 비밀번호 정책 검증
    const requirements = checkPasswordRequirements(newPassword);
    if (!requirements.minLength) {
      Alert.alert('입력 오류', '비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    if (!requirements.hasUpperCase || !requirements.hasLowerCase) {
      Alert.alert('입력 오류', '비밀번호는 대문자와 소문자를 포함해야 합니다.');
      return;
    }
    if (!requirements.hasNumber) {
      Alert.alert('입력 오류', '비밀번호는 숫자를 포함해야 합니다.');
      return;
    }
    if (!requirements.hasSpecialChar) {
      Alert.alert('입력 오류', '비밀번호는 특수문자를 포함해야 합니다.');
      return;
    }

    try {
      setIsChangingPassword(true);
      
      // Supabase Auth를 사용하여 비밀번호 변경
      if (!supabase) {
        throw new Error('Supabase가 설정되지 않았습니다.');
      }

      // 현재 비밀번호로 재인증 (Supabase Auth 요구사항)
      const { data: reauthData, error: reauthError } = await supabase.auth.signInWithPassword({
        email: userId, // userId는 이메일
        password: currentPassword,
      });

      if (reauthError) {
        // 현재 비밀번호가 틀린 경우
        if (reauthError.message?.includes('Invalid login credentials') || reauthError.message?.includes('invalid') || reauthError.message?.includes('incorrect')) {
          throw new Error('현재 비밀번호가 올바르지 않습니다.');
        }
        throw new Error(reauthError.message || '인증에 실패했습니다.');
      }

      // 비밀번호 업데이트
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message || '비밀번호 변경에 실패했습니다.');
      }

      Alert.alert('완료', '비밀번호가 변경되었습니다.');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('비밀번호 변경 실패:', error);
      Alert.alert('오류', error.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // 이메일 변경 기능 제거됨

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Log Out 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('currentUserId');
              await AsyncStorage.removeItem('currentUserUniversity');
              await AsyncStorage.removeItem('rememberMe');
              navigation.replace('Login');
            } catch (error) {
              console.error('로그아웃 오류:', error);
              navigation.replace('Login');
            }
          },
        },
      ]
    );
  };

  const buttonWidth = 130; // 버튼 너비

  return (
    <View className="flex-1" style={{ backgroundColor: colors.primary }}>
      {/* 로고가 들어있는 흰색 박스 */}
      <View className="bg-white px-5 items-center justify-end" style={{ height: 130, paddingBottom: 10 }}>
        {logoImageUrl ? (
          <Image
            source={logoImageUrl}
            style={{ width: 256, height: 60 }}
            resizeMode="contain"
          />
        ) : null}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-gray-600">사용자 정보를 불러오는 중...</Text>
        </View>
      ) : (
        <ScrollView 
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Raffle 박스 */}
          <View className="p-4">
            <View 
              className="bg-white rounded-lg"
              style={{ 
                marginBottom: 0,
                width: '100%',
                aspectRatio: 1,
                padding: 16,
                position: 'relative',
              }}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                  🎟️ Raffle
                </Text>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  {!currentRaffle && (
                    <TouchableOpacity
                      onPress={() => setRaffleNumber(null)}
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
                      >↺</Text>
                    </TouchableOpacity>
                  )}
                  {currentRaffle && (
                    <TouchableOpacity
                      onPress={() => {
                        setShowDeleteRaffleModal(true);
                      }}
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
                      >-</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      // id가 1인 Raffle이 있는지 확인
                      const hasIdOne = raffles.some(r => r.id === 1);
                      if (hasIdOne) {
                        Alert.alert('알림', '이미 등록된 Raffle이 있습니다. 기존 Raffle을 삭제한 후 다시 시도해주세요.');
                        return;
                      }
                      setShowRaffleModal(true);
                    }}
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

              {/* Raffle 정보 표시 */}
              {currentRaffle && (
                <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 10 }}>
                  <Text className="text-sm font-semibold" style={{ color: '#000000', marginBottom: 4 }}>
                    {formatDate(currentRaffle.date)} {currentRaffle.startTime} - {currentRaffle.endTime}
                  </Text>
                  <Text className="text-xs" style={{ color: '#000000' }}>
                    최대 번호: {currentRaffle.maxNumber}
                  </Text>
                </View>
              )}
              
              {/* 티켓 이미지 - 흰 박스 절대 중앙 고정 */}
              <View 
                style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TouchableOpacity
                  onPress={async () => {
                    if (!currentRaffle) {
                      // Raffle이 없으면 1부터 100까지 랜덤 숫자 생성 (저장 안됨)
                      const maxNumber = getConfigNumber('raffle_max_number', 100);
                      const randomNumber = Math.floor(Math.random() * maxNumber) + 1;
                      setRaffleNumber(randomNumber);
                      return;
                    }

                    try {
                      const currentUserId = await AsyncStorage.getItem('currentUserId');
                      if (!currentUserId || currentUserId === 'guest') {
                        Alert.alert('오류', '로그인이 필요합니다.');
                        return;
                      }

                      const currentUniversity = university || await AsyncStorage.getItem('currentUserUniversity');
                      if (!currentUniversity) {
                        Alert.alert('오류', '학교 정보를 찾을 수 없습니다.');
                        return;
                      }

                      const response = await fetch(`${API_BASE_URL}/api/raffles/${currentRaffle.id}/participate`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          userId: currentUserId,
                          university: currentUniversity.toLowerCase(),
                        }),
                      });

                      const result = await response.json();

                      if (!response.ok) {
                        if (result.error === '이미 참여하셨습니다.') {
                          setRaffleNumber(result.number);
                          Alert.alert('알림', '이미 참여하셨습니다.');
                        } else {
                          Alert.alert('오류', result.error || 'Raffle 참여에 실패했습니다.');
                        }
                        return;
                      }

                      if (result.success) {
                        setRaffleNumber(result.number);
                        // Raffle 목록 다시 불러오기
                      }
                    } catch (error) {
                      console.error('Raffle 참여 실패:', error);
                      Alert.alert('오류', 'Raffle 참여에 실패했습니다.');
                    }
                  }}
                  style={{ alignItems: 'center', justifyContent: 'center' }}
                >
                  <Image
                    source={require('../assets/raffle.png')}
                    style={{ width: 200, height: 200 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>

              {/* 번호 - 티켓 하단부터 흰 박스 하단선 사이 정중앙 */}
              {raffleNumber !== null && (
                <View 
                  style={{ 
                    position: 'absolute',
                    top: '65%',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text 
                    className="text-6xl font-bold" 
                    style={{ 
                      color: colors.primary,
                    }}
                  >
                    {raffleNumber}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Profile 박스 */}
          <View className="p-4" style={{ paddingTop: 0 }}>
            <View 
              className="bg-white rounded-lg"
              style={{ 
                marginBottom: 16,
                width: '100%',
                aspectRatio: 1.2, // 세로를 더 길게 (가로/세로 = 1.2:1)
                padding: 16,
                justifyContent: 'space-between'
              }}
            >
              <Text className="text-2xl font-bold mb-4" style={{ color: colors.primary }}>
                👤 Profile
              </Text>

              <View style={{ flex: 1, justifyContent: 'space-around' }}>
                <View style={{ marginBottom: 12 }}>
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    학교
                  </Text>
                  <Text className="text-base text-gray-900" numberOfLines={1} ellipsizeMode="tail">{university || '-'}</Text>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </Text>
                  <Text className="text-base text-gray-900" numberOfLines={1} ellipsizeMode="tail">{userId || '-'}</Text>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1" style={{ marginRight: 8 }}>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">
                        PW
                      </Text>
                      <Text className="text-base text-gray-900">••••••••</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowPasswordModal(true)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: '#F3F4F6',
                        borderRadius: 6,
                        width: buttonWidth,
                      }}
                    >
                      <Text className="text-sm text-gray-700" style={{ textAlign: 'center' }}>
                        비밀번호 변경하기
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* 앱 정보 섹션 */}
          <View className="p-4" style={{ paddingTop: 0 }}>
            <View 
              className="bg-white rounded-lg"
              style={{ 
                marginBottom: 16,
                width: '100%',
                aspectRatio: 1.5,
                padding: 16,
                position: 'relative',
              }}
            >
              <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ContactSupport')}
                  className="flex-row items-center justify-between py-2"
                >
                  <Text className="text-sm text-gray-700">
                    {getConfig('profile_customer_support', '고객지원 (버그신고 / 파트너십 / 앱 아이디어 제안)')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('AppInfo')}
                  className="flex-row items-center justify-between py-2"
                >
                  <Text className="text-sm text-gray-700">
                    앱 정보
                  </Text>
                  <View className="flex-row items-center">
                    <Text className="text-sm text-gray-500 mr-2">1.0.0</Text>
                    <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('PrivacyPolicy')}
                  className="flex-row items-center justify-between py-2"
                >
                  <Text className="text-sm text-gray-700">
                    개인정보 처리방침
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('TermsOfService')}
                  className="flex-row items-center justify-between py-2"
                >
                  <Text className="text-sm text-gray-700">
                    이용약관
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    Alert.alert(
                      '데이터 내보내기',
                      '모든 개인 데이터를 JSON 파일로 내보내시겠습니까?',
                      [
                        { text: '취소', style: 'cancel' },
                        {
                          text: '내보내기',
                          onPress: async () => {
                            try {
                              const currentUserId = await AsyncStorage.getItem('currentUserId');
                              if (!currentUserId || currentUserId === 'guest') {
                                Alert.alert('오류', '로그인된 사용자 정보가 없습니다.');
                                return;
                              }

                              // 사용자 정보 가져오기 (이메일로 조회)
                              const encodedEmail = encodeURIComponent(currentUserId);
                              const response = await fetch(`${API_BASE_URL}/api/auth/user/${encodedEmail}`);
                              
                              let exportData;
                              if (response.ok) {
                                const userData = await response.json();
                                exportData = {
                                  exportDate: new Date().toISOString(),
                                  user: {
                                    email: userData.user?.email || currentUserId,
                                    university: userData.user?.university || '',
                                    createdAt: userData.user?.createdAt || '',
                                  },
                                  dataType: 'personal_data_export',
                                  version: '1.0.0',
                                };
                              } else {
                                // API 실패 시 최소한의 데이터라도 내보내기
                                exportData = {
                                  exportDate: new Date().toISOString(),
                                  user: {
                                    email: currentUserId,
                                    university: university || '',
                                    createdAt: '',
                                  },
                                  dataType: 'personal_data_export',
                                  version: '1.0.0',
                                  note: '일부 정보를 가져오지 못했습니다.',
                                };
                              }

                              const jsonString = JSON.stringify(exportData, null, 2);
                              const fileName = `the-dongmunhoi-data-export-${new Date().toISOString().split('T')[0]}.json`;

                              if (Platform.OS === 'web' && typeof document !== 'undefined') {
                                // 웹: Blob을 사용하여 다운로드
                                const blob = new Blob([jsonString], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                                Alert.alert('완료', '데이터가 다운로드되었습니다.');
                              } else {
                                // 앱: Share API를 사용하여 공유
                                try {
                                  await Share.share({
                                    message: jsonString,
                                    title: fileName,
                                  });
                                } catch (shareError) {
                                  // Share 실패 시 Alert로 표시
                                  Alert.alert(
                                    '데이터 내보내기',
                                    `다음 데이터를 복사하여 저장하세요:\n\n${jsonString}`,
                                    [{ text: '확인' }]
                                  );
                                }
                              }
                            } catch (error) {
                              console.error('데이터 내보내기 실패:', error);
                              Alert.alert('오류', '데이터 내보내기에 실패했습니다.');
                            }
                          }
                        }
                      ]
                    );
                  }}
                  className="flex-row items-center justify-between py-2"
                >
                  <Text className="text-sm text-gray-700">
                    데이터 내보내기
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 로그아웃 및 회원탈퇴 버튼 */}
          <View className="items-center justify-center" style={{ paddingTop: 16, paddingBottom: 20 }}>
            <TouchableOpacity
              onPress={handleLogout}
              className="px-6 py-3 rounded-lg mb-3"
              style={{ backgroundColor: colors.primary, minWidth: 120 }}
            >
              <Text className="text-base font-semibold text-white text-center">
                Log Out
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={async () => {
                Alert.alert(
                  '회원탈퇴',
                  '정말로 회원탈퇴를 하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
                  [
                    { text: '취소', style: 'cancel' },
                    {
                      text: '탈퇴',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          const currentUserId = await AsyncStorage.getItem('currentUserId');
                          if (!currentUserId || currentUserId === 'guest') {
                            Alert.alert('오류', '로그인된 사용자 정보가 없습니다.');
                            return;
                          }

                          const currentUniversity = university || await AsyncStorage.getItem('currentUserUniversity');
                          if (!currentUniversity) {
                            Alert.alert('오류', '학교 정보를 찾을 수 없습니다.');
                            return;
                          }

                          const response = await fetch(`${API_BASE_URL}/api/auth/user/${currentUserId}`, {
                            method: 'DELETE',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              university: currentUniversity.toLowerCase(),
                            }),
                          });

                          const result = await response.json();

                          if (!response.ok) {
                            Alert.alert('오류', result.error || '회원탈퇴에 실패했습니다.');
                            return;
                          }

                          if (result.success) {
                            Alert.alert('완료', '회원탈퇴가 완료되었습니다.');
                            await AsyncStorage.removeItem('currentUserId');
                            await AsyncStorage.removeItem('currentUserUniversity');
                            await AsyncStorage.removeItem('rememberMe');
                            navigation.replace('Login');
                          }
                        } catch (error) {
                          console.error('회원탈퇴 실패:', error);
                          Alert.alert('오류', '회원탈퇴에 실패했습니다.');
                        }
                      },
                    },
                  ]
                );
              }}
              className="px-6 py-3 rounded-lg"
              style={{ backgroundColor: colors.primary, minWidth: 120 }}
            >
              <Text className="text-base font-semibold text-white text-center">
                Delete Account
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Raffle 추가 모달 */}
      <Modal
        visible={showRaffleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRaffleModal(false)}
      >
        <View className="flex-1 justify-center bg-black/50">
          <View className="bg-white rounded-3xl mx-4" style={{ maxHeight: '80%', marginBottom: 100 }}>
            <View className="flex-row items-center justify-between p-6 pb-4">
              <Text className="text-xl font-bold" style={{ color: colors.primary }}>Raffle 추가</Text>
              <TouchableOpacity onPress={() => {
                setShowRaffleModal(false);
                setRaffleDate(null);
                setRaffleStartTime(null);
                setRaffleEndTime(null);
                setRaffleMaxNumber('');
                setRafflePassword('');
                setShowDatePicker(false);
                setShowStartTimePicker(false);
                setShowEndTimePicker(false);
              }}>
                <Text className="text-gray-500 text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              className="px-6"
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {/* 날짜 */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">날짜</Text>
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 flex-row items-center justify-between"
                  style={{ flex: 1, marginRight: raffleDate ? 8 : 0 }}
                >
                  <Text className="text-base" style={{ color: raffleDate ? '#374151' : '#9ca3af' }}>
                    {raffleDate ? formatDate(raffleDate) : '날짜 선택'}
                  </Text>
                  <Text className="text-gray-400">📅</Text>
                </TouchableOpacity>
                {raffleDate && (
                  <TouchableOpacity
                    onPress={() => {
                      setRaffleDate(null);
                    }}
                    className="px-3 py-3 bg-gray-200 rounded-lg"
                  >
                    <Text className="text-sm text-gray-600">초기화</Text>
                  </TouchableOpacity>
                )}
              </View>
              {showDatePicker && (
                <>
                  <DateTimePicker
                    value={raffleDate || tempDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(event, date) => {
                      if (Platform.OS === 'ios') {
                        if (date) {
                          setTempDate(date);
                        }
                      } else {
                        handleDateChange(event, date);
                      }
                    }}
                    minimumDate={new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <View className="flex-row justify-end mt-2 mb-4">
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(false)}
                        className="px-4 py-2 bg-gray-200 rounded-lg mr-2"
                      >
                        <Text>취소</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={confirmDate}
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

            {/* 시작 시간 */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">시작 시간</Text>
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => setShowStartTimePicker(true)}
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 flex-row items-center justify-between"
                  style={{ flex: 1, marginRight: raffleStartTime ? 8 : 0 }}
                >
                  <Text className="text-base" style={{ color: raffleStartTime ? '#374151' : '#9ca3af' }}>
                    {raffleStartTime ? formatTime(raffleStartTime) : '시간 선택'}
                  </Text>
                  <Text className="text-gray-400">🕐</Text>
                </TouchableOpacity>
                {raffleStartTime && (
                  <TouchableOpacity
                    onPress={() => {
                      setRaffleStartTime(null);
                    }}
                    className="px-3 py-3 bg-gray-200 rounded-lg"
                  >
                    <Text className="text-sm text-gray-600">초기화</Text>
                  </TouchableOpacity>
                )}
              </View>
              {showStartTimePicker && (
                <>
                  <DateTimePicker
                    value={raffleStartTime || tempStartTime || new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                    onChange={handleStartTimeChange}
                    is24Hour={false}
                  />
                  {Platform.OS === 'ios' && (
                    <View className="flex-row justify-end mt-2 mb-4">
                      <TouchableOpacity
                        onPress={() => setShowStartTimePicker(false)}
                        className="px-4 py-2 bg-gray-200 rounded-lg mr-2"
                      >
                        <Text>취소</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={confirmStartTime}
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

            {/* 종료 시간 */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">종료 시간</Text>
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => setShowEndTimePicker(true)}
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 flex-row items-center justify-between"
                  style={{ flex: 1, marginRight: raffleEndTime ? 8 : 0 }}
                >
                  <Text className="text-base" style={{ color: raffleEndTime ? '#374151' : '#9ca3af' }}>
                    {raffleEndTime ? formatTime(raffleEndTime) : '시간 선택'}
                  </Text>
                  <Text className="text-gray-400">🕐</Text>
                </TouchableOpacity>
                {raffleEndTime && (
                  <TouchableOpacity
                    onPress={() => {
                      setRaffleEndTime(null);
                    }}
                    className="px-3 py-3 bg-gray-200 rounded-lg"
                  >
                    <Text className="text-sm text-gray-600">초기화</Text>
                  </TouchableOpacity>
                )}
              </View>
              {showEndTimePicker && (
                <>
                  <DateTimePicker
                    value={raffleEndTime || tempEndTime || new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                    onChange={handleEndTimeChange}
                    is24Hour={false}
                  />
                  {Platform.OS === 'ios' && (
                    <View className="flex-row justify-end mt-2 mb-4">
                      <TouchableOpacity
                        onPress={() => setShowEndTimePicker(false)}
                        className="px-4 py-2 bg-gray-200 rounded-lg mr-2"
                      >
                        <Text>취소</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={confirmEndTime}
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

            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">최대 번호</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                value={raffleMaxNumber}
                onChangeText={setRaffleMaxNumber}
                placeholder="최대 번호를 입력하세요"
                keyboardType="numeric"
              />
            </View>

            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-700 mb-2">비밀번호</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                value={rafflePassword}
                onChangeText={setRafflePassword}
                placeholder="비밀번호를 입력하세요"
                secureTextEntry
              />
            </View>

              <TouchableOpacity
                onPress={async () => {
                  if (!raffleDate || !raffleStartTime || !raffleEndTime || !raffleMaxNumber || !rafflePassword) {
                    Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
                    return;
                  }
                  
                  // Raffle 비밀번호 확인 (학교별)
                  const currentUniversity = university || await AsyncStorage.getItem('currentUserUniversity');
                  const correctPassword = getCategoryPassword(currentUniversity, 'Raffle');
                  if (rafflePassword !== correctPassword) {
                    Alert.alert('비밀번호 오류', '비밀번호가 올바르지 않습니다.');
                    setRafflePassword('');
                    return;
                  }
                  
                  try {
                    const currentUniversity = university || await AsyncStorage.getItem('currentUserUniversity');
                    if (!currentUniversity) {
                      Alert.alert('오류', '학교 정보를 찾을 수 없습니다.');
                      return;
                    }

                    const currentUserId = await AsyncStorage.getItem('currentUserId') || await AsyncStorage.getItem('currentUserEmail') || '';
                    
                    const response = await fetch(`${API_BASE_URL}/api/raffles`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        date: formatDate(raffleDate),
                        startTime: formatTime(raffleStartTime),
                        endTime: formatTime(raffleEndTime),
                        maxNumber: raffleMaxNumber,
                        university: currentUniversity.toLowerCase(),
                        author: currentUserId,
                      }),
                    });

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({}));
                      throw new Error(errorData.error || errorData.message || 'Raffle 저장에 실패했습니다.');
                    }

                    const result = await response.json();
                    if (result.success) {
                      Alert.alert('완료', 'Raffle이 추가되었습니다.');
                      setShowRaffleModal(false);
                      setRaffleDate(null);
                      setRaffleStartTime(null);
                      setRaffleEndTime(null);
                      setRaffleMaxNumber('');
                      setRafflePassword('');
                      setShowDatePicker(false);
                      setShowStartTimePicker(false);
                      setShowEndTimePicker(false);
                      // Raffle 목록 다시 불러오기 (raffle 생성 후이므로 interval 재시작)
                      const hasRaffle = await loadRaffles(false);
                      hasRaffleRef.current = hasRaffle;
                      
                      // raffle이 생성되었고 interval이 없으면 시작
                      if (hasRaffle && !intervalRef.current) {
                        intervalRef.current = setInterval(async () => {
                          const stillHasRaffle = await loadRaffles(true);
                          hasRaffleRef.current = stillHasRaffle;
                          if (!stillHasRaffle && intervalRef.current) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                          }
                        }, 10000);
                      }
                    } else {
                      throw new Error(result.error || 'Raffle 저장에 실패했습니다.');
                    }
                  } catch (error) {
                    console.error('Raffle 저장 실패:', error);
                    Alert.alert('오류', error.message || 'Raffle 저장에 실패했습니다.');
                  }
                }}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                  marginTop: 8,
                }}
              >
                <Text className="text-white text-base font-semibold">{getConfig('profile_raffle_add_button', '추가하기')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 비밀번호 변경 모달 */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View className="flex-1 justify-center bg-black/50">
          <View className="bg-white rounded-3xl mx-4" style={{ maxHeight: '80%', marginBottom: 100 }}>
            {/* 헤더 - 고정 */}
            <View className="flex-row items-center justify-between p-6 pb-4">
              <Text className="text-xl font-bold" style={{ color: colors.primary }}>비밀번호 변경</Text>
              <TouchableOpacity onPress={() => {
                setShowPasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setShowCurrentPassword(false);
                setShowNewPassword(false);
                setShowConfirmPassword(false);
              }}>
                <Text className="text-gray-500 text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            {/* 스크롤 가능한 내용 */}
            <ScrollView 
              className="px-6"
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">현재 비밀번호</Text>
              <View className="flex-row items-center border border-gray-300 rounded-lg bg-white">
                <TextInput
                  className="flex-1 px-4 py-3 text-base"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  placeholder="현재 비밀번호를 입력하세요"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="px-4"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showCurrentPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Password</Text>
              <View className="flex-row items-center border border-gray-300 rounded-lg bg-white">
                <TextInput
                  className="flex-1 px-4 py-3 text-base"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  className="px-4"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
              {/* 비밀번호 조건 표시 - password 입력 시작 시에만 표시 */}
              {newPassword.length > 0 && (
                <View className="mt-2 ml-1">
                  {(() => {
                    const requirements = checkPasswordRequirements(newPassword);
                    return (
                      <>
                        <View className="flex-row items-center mb-1">
                          <Ionicons
                            name={requirements.minLength ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={requirements.minLength ? '#10b981' : '#9ca3af'}
                            style={{ marginRight: 6 }}
                          />
                          <Text className="text-xs" style={{ color: requirements.minLength ? '#10b981' : '#6b7280' }}>
                            8자 이상
                          </Text>
                        </View>
                        <View className="flex-row items-center mb-1">
                          <Ionicons
                            name={requirements.hasUpperCase ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={requirements.hasUpperCase ? '#10b981' : '#9ca3af'}
                            style={{ marginRight: 6 }}
                          />
                          <Text className="text-xs" style={{ color: requirements.hasUpperCase ? '#10b981' : '#6b7280' }}>
                            대문자 포함
                          </Text>
                        </View>
                        <View className="flex-row items-center mb-1">
                          <Ionicons
                            name={requirements.hasLowerCase ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={requirements.hasLowerCase ? '#10b981' : '#9ca3af'}
                            style={{ marginRight: 6 }}
                          />
                          <Text className="text-xs" style={{ color: requirements.hasLowerCase ? '#10b981' : '#6b7280' }}>
                            소문자 포함
                          </Text>
                        </View>
                        <View className="flex-row items-center mb-1">
                          <Ionicons
                            name={requirements.hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={requirements.hasNumber ? '#10b981' : '#9ca3af'}
                            style={{ marginRight: 6 }}
                          />
                          <Text className="text-xs" style={{ color: requirements.hasNumber ? '#10b981' : '#6b7280' }}>
                            숫자 포함
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <Ionicons
                            name={requirements.hasSpecialChar ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={requirements.hasSpecialChar ? '#10b981' : '#9ca3af'}
                            style={{ marginRight: 6 }}
                          />
                          <Text className="text-xs" style={{ color: requirements.hasSpecialChar ? '#10b981' : '#6b7280' }}>
                            특수문자 포함 (!@#$%^&* 등)
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              )}
            </View>

            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Confirm Password</Text>
              <View 
                className="flex-row items-center rounded-lg bg-white"
                style={{
                  borderWidth: 1,
                  borderColor: confirmPassword && newPassword !== confirmPassword ? '#ef4444' : newPassword && newPassword === confirmPassword ? '#10b981' : '#d1d5db'
                }}
              >
                <TextInput
                  className="flex-1 px-4 py-3 text-base"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  placeholder="Confirm your password"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="px-4"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
              {confirmPassword && newPassword !== confirmPassword && (
                <Text className="text-xs text-red-500 mt-1 ml-1">
                  비밀번호가 일치하지 않습니다.
                </Text>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <Text className="text-xs text-green-500 mt-1 ml-1">
                  비밀번호가 일치합니다.
                </Text>
              )}
            </View>

              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={isChangingPassword}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                  opacity: isChangingPassword ? 0.6 : 1,
                  marginTop: 8,
                }}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-base font-semibold">변경하기</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>


      {/* Raffle 삭제 모달 */}
      <Modal
        visible={showDeleteRaffleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowDeleteRaffleModal(false);
          setDeleteRafflePassword('');
        }}
      >
        <View className="flex-1 justify-center bg-black/50">
          <View className="bg-white rounded-3xl p-6 mx-4" style={{ maxHeight: '80%', marginBottom: 100 }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold" style={{ color: colors.primary }}>Raffle 삭제</Text>
              <TouchableOpacity onPress={() => {
                setShowDeleteRaffleModal(false);
                setDeleteRafflePassword('');
              }}>
                <Text className="text-gray-500 text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-base text-gray-700 mb-4">
              이 Raffle을 삭제하시겠습니까?
            </Text>

            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-700 mb-2">비밀번호</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                value={deleteRafflePassword}
                onChangeText={setDeleteRafflePassword}
                placeholder="비밀번호를 입력하세요"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              onPress={async () => {
                if (!deleteRafflePassword) {
                  Alert.alert('입력 오류', '비밀번호를 입력해주세요.');
                  return;
                }

                // Raffle 비밀번호 확인 (학교별)
                const currentUniversity = university || await AsyncStorage.getItem('currentUserUniversity');
                const correctPassword = getCategoryPassword(currentUniversity, 'Raffle');
                if (deleteRafflePassword !== correctPassword) {
                  Alert.alert('비밀번호 오류', '비밀번호가 올바르지 않습니다.');
                  setDeleteRafflePassword('');
                  return;
                }

                try {
                  const currentUniversity = university || await AsyncStorage.getItem('currentUserUniversity');
                  if (!currentUniversity) {
                    Alert.alert('오류', '학교 정보를 찾을 수 없습니다.');
                    return;
                  }

                  const response = await fetch(`${API_BASE_URL}/api/raffles/${currentRaffle.id}`, {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      university: currentUniversity.toLowerCase(),
                      password: deleteRafflePassword,
                    }),
                  });

                  const result = await response.json();

                  if (!response.ok) {
                    Alert.alert('오류', result.error || 'Raffle 삭제에 실패했습니다.');
                    return;
                  }

                  if (result.success) {
                    Alert.alert('성공', 'Raffle이 삭제되었습니다.');
                    setShowDeleteRaffleModal(false);
                    setDeleteRafflePassword('');
                    setRaffleNumber(null);
                    setCurrentRaffle(null);
                    // Raffle 목록 다시 불러오기 (raffle 삭제 후이므로 interval 중단)
                    const hasRaffle = await loadRaffles(false);
                    hasRaffleRef.current = hasRaffle;
                    
                    // raffle이 없으면 interval 중단
                    if (!hasRaffle && intervalRef.current) {
                      clearInterval(intervalRef.current);
                      intervalRef.current = null;
                    }
                  }
                } catch (error) {
                  console.error('Raffle 삭제 실패:', error);
                  Alert.alert('오류', 'Raffle 삭제에 실패했습니다.');
                }
              }}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text className="text-white text-base font-semibold">삭제하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <GlobalPopup routeName="profile" />
    </View>
  );
}
