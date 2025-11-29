import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../config/api';
import { StyleSheet } from 'react-native';

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);
const [isLoadingAuth, setIsLoadingAuth] = useState(true); // 💡 초기에는 인증 확인부터 시작
  /** --------------------------------------------
   * 1) checkAuth: 토큰 검증 → true/false 반환
   * -------------------------------------------- */
/* * 1) checkAuth: 토큰 검증 → true/false 반환
 * -------------------------------------------- */
/* * 1) checkAuth: 토큰 검증 → true/false 반환
 * -------------------------------------------- */
const checkAuth = async () => {
  try {
    // 1. AsyncStorage에서 저장된 사용자 정보 로드
    const saved = await AsyncStorage.getItem('user');
    const user = saved ? JSON.parse(saved) : null;

    // 사용자 정보나 토큰이 없으면 인증 실패
    if (!user || !user.token) return false;

    // 2. API 호출
    const res = await fetch(API.userStatus, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        // 💡 서버 코드에 맞춰 Bearer 스키마 사용
        'Authorization': `Bearer ${user.token}` 
      },
      body: JSON.stringify({
        userId: user.userId,
      }),
    });

    // 3. 응답 데이터 파싱
    const data = await res.json();
    
    // 🚨🚨 디버깅을 위한 alert 추가 (API 호출 성공 후 응답을 받았을 때)
    const debugUserId = data.user ? data.user.userId :" user.userId" || 'N/A'; // 토큰의 ID 또는 기존 user ID 사용
    // const debugUserId = data.user ? data.user.userId : user.userId || 'N/A'; // 토큰의 ID 또는 기존 user ID 사용
    const debugMessage = `[API 응답 - checkAuth]\nStatus: ${res.status}\nMessage: ${data.message || '응답 메시지 없음'}\nToken User ID: ${debugUserId}`;
    alert(debugMessage);
    // ----------------------------------------------------------------------


    // 4. 오류 상태 코드 처리 (401: 권한 없음, 403: 접근 금지/비활성화)
    if (res.status === 401 || res.status === 403) {
      // 서버 메시지 Alert (디버깅 Alert와 별개로 사용자에게 경고)
      Alert.alert('알림', data.message || '세션이 만료되었거나 계정이 비활성화되었습니다.');
      await AsyncStorage.removeItem('user'); // 로컬 저장소에서 정보 제거
      return false;
    }
    
    // 500 등 서버 오류 처리 추가
    if (!res.ok) {
        Alert.alert('오류', data.message || `서버 오류 발생 (${res.status})`);
        await AsyncStorage.removeItem('user'); 
        return false;
    }
    
    // 5. 정상 사용자 및 활성 상태 확인
    if (data.success && data.user && data.user.isActive) {
      // 서버에서 받은 최신 정보를 기반으로 새로운 사용자 객체 생성
      const newUserObj = {
        userId: data.user.userId,
        username: data.user.username,
        role: data.user.role,
        companyId: data.user.companyId,
        name: data.user.name,
        token: data.token || user.token,
        companyName: data.user.companyName,
        isActive: data.user.isActive,
      };

      // 최신 정보로 AsyncStorage 업데이트
      await AsyncStorage.setItem('user', JSON.stringify(newUserObj));

      // 자동 화면 이동 로직
      const mode = await AsyncStorage.getItem('uploadMode');
      navigation.replace('MainTabs', {
        screen: mode === 'multi' ? 'UploadMulti' : 'UploadEach',
      });

      return true;
    }
    
    // 기타 실패 케이스
    Alert.alert('알림', data.message || '사용자 정보 확인에 실패했습니다.');
    await AsyncStorage.removeItem('user');
    return false;

  } catch (err) {
    // 네트워크 오류, JSON 파싱 오류 등 예외 처리
    console.error('Auth check error:', err);
    Alert.alert('오류', '네트워크 연결 상태를 확인해주세요.');
    await AsyncStorage.removeItem('user');
    return false;
  }
};

  /** --------------------------------------------
   * 2) 팀 목록 가져오기
   * -------------------------------------------- */
  const fetchCompanies = async () => {
    try {
      setLoadingCompanies(true);

      const response = await fetch(API.companiesList, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success && data.companies?.length > 0) {
        setCompanies(data.companies);
        setSelectedCompany(data.companies[0]._id);
      } else {
        Alert.alert('알림', '등록된 업체가 없습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '팀 목록을 불러올 수 없습니다.\n' + error.message);
    } finally {
      setLoadingCompanies(false);
    }
  };

  /** --------------------------------------------
   * 3) 초기 실행 로직
   *    토큰 검증 → 실패 시에만 팀 조회
   * -------------------------------------------- */
useEffect(() => {
    const init = async () => {
        // 1. AsyncStorage에서 사용자 정보 확인
        const savedStr = await AsyncStorage.getItem('user');
        const saved = !!savedStr; 
        
        let isValid = false;

        // 2. 저장된 정보가 있는 경우에만 checkAuth 실행
        if (saved) {
            // checkAuth가 완전히 끝날 때까지 기다립니다.
            isValid = await checkAuth(); 
        }

        // 3. 인증 확인이 끝났으므로 상태 업데이트
        setIsLoadingAuth(false); // 💡 checkAuth 완료 

        // 4. 토큰이 유효한 경우, 함수 종료
        if (isValid) {
            return; 
        }

        // 5. 토큰이 없거나 무효한 경우, 팀 목록 불러오기 시작
        fetchCompanies();
    };

    init();
}, []);

  /** --------------------------------------------
   * 4) 로그인 버튼 처리
   * -------------------------------------------- */
  const handleLogin = async () => {
    if (!selectedCompany) {
      Alert.alert('오류', '팀를 선택하세요');
      return;
    }

    if (!username || !password) {
      Alert.alert('오류', '아이디와 비밀번호를 입력하세요');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          companyId: selectedCompany,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const selectedCompanyData = companies.find(
          (c) => c._id === selectedCompany
        );

        const userObj = {
          userId: data.user._id,
          username: data.user.username,
          role: data.user.role,
          companyId: data.user.companyId,
          name: data.user.name,
          token: data.token,
          companyName: selectedCompanyData?.name ?? '',
        };

        await AsyncStorage.setItem('user', JSON.stringify(userObj));

        const mode = await AsyncStorage.getItem('uploadMode');
        navigation.replace('MainTabs', {
          screen: mode === 'multi' ? 'UploadMulti' : 'UploadEach',
        });
      } else {
        Alert.alert('로그인 실패', data.message || '로그인에 실패했습니다');
      }
    } catch (error) {
      Alert.alert('오류', '서버 연결 실패\n' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /** --------------------------------------------
   * UI 렌더링
   * -------------------------------------------- */
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3b82f6" />

      <View style={styles.header}>
        <Text style={styles.title}>📸 공정한 현장 기록 앱</Text>
        <Text style={styles.subtitle}>직원 로그인</Text>
      </View>

      <ScrollView style={styles.form}>
{isLoadingAuth ? ( // 💡 1단계: 인증 확인 중
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>사용자 확인 중...</Text>
    </View>
) : loadingCompanies ? ( // 💡 2단계: 인증 실패 후 팀 목록 불러오는 중
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>팀 목록 불러오는 중...</Text>
    </View>
) : ( // 💡 3단계: 모든 로딩 완료 후 Picker 표시
    <>
        <Text style={styles.label}>팀 선택</Text>
        <View style={styles.pickerContainer}>
            {/* ... Picker 내용 ... */}
            <Picker
                selectedValue={selectedCompany}
                onValueChange={(itemValue) => setSelectedCompany(itemValue)}
                style={styles.picker}
                enabled={true}
                mode="dropdown"
            >
                <Picker.Item label="소속 팀을 선택하세요" value="" />
                {companies.map((company) => (
                    <Picker.Item
                        key={company._id}
                        label={company.name}
                        value={company._id}
                    />
                ))}
            </Picker>
        </View>

            {selectedCompany ? (
              <Text style={styles.selectedText}>
                선택된 팀: {companies.find((c) => c._id === selectedCompany)?.name}
              </Text>
            ) : null}

            <Text style={styles.label}>아이디</Text>
            <TextInput
              style={styles.input}
              placeholder="아이디"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>비밀번호</Text>
            <TextInput
              style={[styles.input, { color: '#111', fontWeight: 'bold' }]}
              placeholder="비밀번호"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>로그인</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#3b82f6',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  form: {
    padding: 20,
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 8,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 5,
    height: 60,
  },
  picker: {
    height: '100%',
    flex: 1,
    color: '#000',
  },
  selectedText: {
    fontSize: 14,
    color: '#3b82f6',
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    height: 56,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LoginScreen;
