import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getLoginColors } from '../utils/uniColors';
import { useAppConfig } from '../contexts/AppConfigContext';

export default function ContactSupportScreen() {
  const navigation = useNavigation();
  const { getConfig } = useAppConfig();
  const LOGIN_COLORS = getLoginColors(getConfig);

  return (
    <View className="flex-1" style={{ backgroundColor: LOGIN_COLORS.iconBackground }}>
      <View className="flex-1 bg-white" style={{ marginTop: 72 }}>
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <Text className="text-xl font-bold" style={{ color: LOGIN_COLORS.iconBackground }}>고객 지원</Text>
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
              Email
            </Text>
            
            <TouchableOpacity
              onPress={async () => {
                const supportEmail = getConfig('support_email', 'support@thedongmunhoi.com');
                const mailtoUrl = `mailto:${supportEmail}`;
                try {
                  const supported = await Linking.canOpenURL(mailtoUrl);
                  if (supported) {
                    await Linking.openURL(mailtoUrl);
                  } else {
                    Alert.alert('알림', `이메일 앱을 열 수 없습니다.\n\n${supportEmail}`);
                  }
                } catch (error) {
                  Alert.alert('오류', '이메일을 열 수 없습니다.');
                }
              }}
              className="flex-row items-center mb-4"
            >
              <Text className="text-base text-blue-600 mr-2">{getConfig('support_email', 'support@thedongmunhoi.com')}</Text>
              <Ionicons name="mail-outline" size={20} color="#2563eb" />
            </TouchableOpacity>
            
            <View style={{ marginTop: 8 }}>
              {(() => {
                const descriptions = [];
                const maxCount = 10; // 최대 10개까지 확인
                
                // 먼저 유효한 description들을 수집
                const validDescriptions = [];
                for (let i = 1; i <= maxCount; i++) {
                  const description = getConfig(`support_description_${i}`, '');
                  if (description && description.trim() !== '') {
                    validDescriptions.push({ index: i, text: description });
                  }
                }
                
                // 유효한 description들을 렌더링 (마지막 항목이 아닌 경우에만 mb-4 적용)
                validDescriptions.forEach((item, idx) => {
                  descriptions.push(
                    <View key={item.index} className={`flex-row ${idx < validDescriptions.length - 1 ? 'mb-4' : ''}`}>
                      <Text className="text-base mr-2" style={{ color: '#6b7280' }}>•</Text>
                      <Text className="text-base flex-1" style={{ color: '#6b7280' }}>
                        {item.text}
                      </Text>
                    </View>
                  );
                });
                
                return descriptions;
              })()}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
