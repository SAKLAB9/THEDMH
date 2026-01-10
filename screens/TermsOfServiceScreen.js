import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getLoginColors } from '../utils/uniColors';
import { useAppConfig } from '../contexts/AppConfigContext';

export default function TermsOfServiceScreen() {
  const navigation = useNavigation();
  const { getConfig } = useAppConfig();
  const LOGIN_COLORS = getLoginColors(getConfig);
  const appName = getConfig('app_name', 'THE동문회');

  return (
    <View className="flex-1" style={{ backgroundColor: LOGIN_COLORS.iconBackground }}>
      <View className="flex-1 bg-white" style={{ marginTop: 72 }}>
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <Text className="text-xl font-bold" style={{ color: LOGIN_COLORS.iconBackground }}>이용약관</Text>
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

        <ScrollView className="px-6 pt-4" showsVerticalScrollIndicator={false}>
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제1조 (목적)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              본 약관은 {appName}가 제공하는 서비스의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제2조 (정의)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              1. "서비스"란 {appName}가 제공하는 모든 서비스를 의미합니다.{'\n'}
              2. "이용자"란 본 약관에 동의하고 서비스를 이용하는 회원을 의미합니다.{'\n'}
              3. "회원"이란 서비스에 회원등록을 하고 서비스를 이용하는 자를 의미합니다.
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제3조 (약관의 효력 및 변경)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              1. 본 약관은 서비스를 이용하고자 하는 모든 이용자에 대하여 그 효력을 발생합니다.{'\n'}
              2. 본 약관의 내용은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.{'\n'}
              3. 회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있습니다.
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제4조 (서비스의 제공)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              회사는 다음과 같은 서비스를 제공합니다:{'\n\n'}
              1. 공지사항 게시 및 조회{'\n'}
              2. 경조사 게시 및 조회{'\n'}
              3. 소모임 게시 및 조회{'\n'}
              4. 게시판 서비스{'\n'}
              5. Raffle 이벤트{'\n'}
              6. 기타 회사가 추가 개발하거나 제휴계약 등을 통해 제공하는 일체의 서비스
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제5조 (회원가입)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              1. 이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관에 동의한다는 의사표시를 함으로서 회원가입을 신청합니다.{'\n'}
              2. 회사는 제1항과 같이 회원가입을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다:{'\n'}
              - 가입신청자가 본 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우{'\n'}
              - 등록 내용에 허위, 기재누락, 오기가 있는 경우{'\n'}
              3. 회원가입은 회사의 승낙이 이용자에게 도달한 시점으로 완료됩니다.
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제6조 (회원의 의무)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              1. 이용자는 다음 행위를 하여서는 안 됩니다:{'\n'}
              - 신청 또는 변경 시 허위내용의 등록{'\n'}
              - 타인의 정보 도용{'\n'}
              - 회사가 게시한 정보의 변경{'\n'}
              - 회사가 정한 정보 이외의 정보 등의 송신 또는 게시{'\n'}
              - 회사와 기타 제3자의 저작권 등 지적재산권에 대한 침해{'\n'}
              - 회사 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위{'\n'}
              - 외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 공개 또는 게시하는 행위
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제7조 (서비스의 중단)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              1. 회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.{'\n'}
              2. 회사는 제1항의 사유로 서비스의 제공이 일시적으로 중단됨으로 인하여 이용자 또는 제3자가 입은 손해에 대하여 배상합니다. 단, 회사가 고의 또는 과실이 없음을 입증하는 경우에는 그러하지 아니합니다.
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제8조 (회원 탈퇴 및 자격 상실)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              1. 회원은 언제든지 회사에 회원 탈퇴를 요청할 수 있으며, 회사는 즉시 회원 탈퇴를 처리합니다.{'\n'}
              2. 회원이 다음 각 호의 사유에 해당하는 경우, 회사는 회원자격을 제한 및 정지시킬 수 있습니다:{'\n'}
              - 가입 신청 시에 허위 내용을 등록한 경우{'\n'}
              - 다른 사람의 서비스 이용을 방해하거나 그 정보를 도용하는 등 전자상거래 질서를 위협하는 경우{'\n'}
              - 서비스를 이용하여 법령 또는 본 약관이 금지하거나 공서양속에 반하는 행위를 하는 경우
            </Text>

            <Text className="text-sm text-gray-500 mt-6">
              최종 수정일: {new Date().toLocaleDateString('ko-KR')}
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

