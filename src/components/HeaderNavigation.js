// src/components/MainHeader.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MainHeader = ({ navigation, route }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (e) {
        console.error("Failed to load user data:", e);
      }
    };
    loadUser();
  }, []);

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      navigation.replace('Login');
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.companyName}>
            {user?.companyName || '회사명'}
          </Text>
          <Text style={styles.userName}>
            {user?.name || '사용자'}
            {user?.username ? ` (${user.username})` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  // 헤더 컨테이너: 전체 너비, 배경 흰색
  container: {
    width: '100%',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb'
  },
  // 헤더 영역: 사용자 정보와 로그아웃 버튼을 포함
  header: {
    padding: 16,
    backgroundColor: '#f3f3f3',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // 회사명 텍스트
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  // 사용자명 텍스트
  userName: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 2
  },
  // 로그아웃 버튼 (터치 영역)
  logoutButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  // 로그아웃 텍스트
  logoutText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 14
  },
});

export default MainHeader;