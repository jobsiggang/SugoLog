// HistoryScreen.js
import React, { useState, useEffect, useCallback } from 'react'; // 🚨 useCallback import 추가
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API from '../config/api';
// 🚨 useFocusEffect import 추가 (HistoryScreen은 navigation을 props로 받으므로 사용 가능)
import { useFocusEffect } from '@react-navigation/native'; 

const HistoryScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [groupedHistory, setGroupedHistory] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [user, setUser] = useState(null);

  // 🚨 [수정 1] fetchHistory 함수를 useCallback으로 감싸 안정화
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('user');
      const userObj = userData ? JSON.parse(userData) : null;
      setUser(userObj);

      if (!userObj || !userObj.token) {
        Alert.alert('Authentication Error', 'Please log in again.');
        setLoading(false);
        // 로그인 정보가 없으면 바로 리턴하여 로딩을 중지합니다.
        return; 
      }

      const response = await axios.get(API.uploads, {
        headers: {
          Authorization: `Bearer ${userObj.token}`,
        },
      });

      if (response.data.success) {
        const uploads = response.data.uploads || [];
        const grouped = uploads.reduce((acc, upload) => {
          // 날짜 형식을 'YYYY. MM. DD' 등으로 변경하여 그룹핑의 안정성을 높이는 것을 권장합니다.
          const date = new Date(upload.createdAt).toLocaleDateString();
          if (!acc[date]) acc[date] = [];
          acc[date].push(upload);
          return acc;
        }, {});
        setGroupedHistory(grouped);
      } else {
        Alert.alert('Server Error', response.data.error || 'Failed to fetch upload history.');
      }
    } catch (error) {
      if (error.response) {
        Alert.alert(
          'Server Error',
          `Status: ${error.response.status}\nMessage: ${error.response.data?.error || 'Error occurred'}`
        );
      } else {
        Alert.alert('Network Error', 'Unable to connect to the server.');
      }
    }
    setLoading(false);
  }, [setUser, setLoading, setGroupedHistory]); // 의존성 배열에 상태 함수 추가

  // 🚨 [수정 2] 기존 useEffect를 useFocusEffect로 대체
  useFocusEffect(
    // useFocusEffect 내의 함수도 useCallback으로 감싸야 합니다.
    useCallback(() => {
      // 로그인 정보 로딩 (비동기)
      const loadUserAndFetch = async () => {
        const userData = await AsyncStorage.getItem('user');
        const userObj = userData ? JSON.parse(userData) : null;
        setUser(userObj);
        
        // 사용자 데이터 로딩 후, 데이터 새로고침
        if (userObj && userObj.token) {
          fetchHistory();
        } else {
          setLoading(false);
        }
      };
      
      loadUserAndFetch();
      
      // cleanup function (화면 포커스 해제 시 실행)
      return () => {
        // 필요하다면, 화면을 떠날 때 로딩 상태를 다시 false로 설정하는 등 정리 로직을 추가할 수 있습니다.
      };
    }, [fetchHistory]) // fetchHistory 함수가 변경될 때만 이펙트가 재설정되도록 합니다.
  );
  
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      setUser(null);
      navigation.navigate('Login');
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  // ... (나머지 렌더링 코드는 동일)
  
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const renderCard = (item) => (
    <View key={item._id} style={styles.card}>
      <Text style={styles.title}>{item.formName || 'No Form Name'}</Text>

      {/* 썸네일 여러 개 가로 배치 */}
      {item.thumbnails && item.thumbnails.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailContainer}>
          {item.thumbnails.map((thumb, idx) => (
            <Image key={idx} source={{ uri: thumb }} style={styles.thumbnail} />
          ))}
        </ScrollView>
      )}

      {/* 데이터 필드 */}
      {Object.entries(item.data || {}).map(([key, value]) => (
        <Text key={key} style={styles.subtitle}>{`${key}: ${value}`}</Text>
      ))}

      <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        {Object.keys(groupedHistory).map((date) => (
          <View key={date} style={styles.card}>
            <Text
              style={styles.title}
              onPress={() => setSelectedDate(selectedDate === date ? null : date)}
            >
              {date}
            </Text>
            {selectedDate === date && (
              <>
                <Text style={styles.sectionTitle}>Uploads for {date}</Text>
                {groupedHistory[date].map(item => (
                  <View key={item._id}>
                    {renderCard(item)}
                  </View>
                ))}
              </>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9', padding: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#555' },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 20,
    marginBottom: 4, // 제목 아래 여백 최소화
  },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  date: { fontSize: 12, color: '#999', marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  backButton: { fontSize: 16, color: '#3b82f6', marginTop: 16, textAlign: 'center' },
  thumbnailContainer: { flexDirection: 'row', marginTop: 4 },
  thumbnail: { width: 80, height: 80, borderRadius: 8, marginRight: 8 },
});

export default HistoryScreen;