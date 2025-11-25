// UploadScreen.js
import { MainHeader} from '../components/HeaderNavigation';
import React, { useState, useEffect, useRef } from 'react';
import { canvasConfig } from '../config/compositeConfig';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  PermissionsAndroid,
  Platform,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import API from '../config/api';
import Share from 'react-native-share';
import ImageComposer from '../components/ImageComposer';
import ImageResizer from 'react-native-image-resizer';


const { width: screenWidth } = Dimensions.get('window');
const THUMB_SIZE = 80;

// 캔버스 크기 계산 함수 (rotation은 현재 사용하지 않음 — 필요하면 활용 가능)
function getCanvasDims() {
  const baseWidth = Math.floor(screenWidth * 0.7);
  const baseHeight = Math.floor((baseWidth * canvasConfig.height) / canvasConfig.width);
  return { width: baseWidth, height: baseHeight };
}
const cellPaddingX = canvasConfig.table.cellPaddingX;
const cellPaddingY = canvasConfig.table.cellPaddingY;


// 개별 폼 필드 렌더러
const FormField = ({
  field,
  value,
  onChange,
  isDate,
  options,
  validationError,
  onOpenDatePicker,
}) => {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' }}>
      <Text style={{ width: '16.66%', textAlign: 'left', padding: 8, fontWeight: 'bold', color: '#222', fontSize: 14 }}>{field}</Text>
      <View style={{ flex: 1, marginLeft: '0%' }}>
        {isDate ? (
          <>
            <TouchableOpacity
              style={{
                padding: 8,
                backgroundColor: '#f9fafb',
                borderRadius: 6,
                borderWidth: validationError ? 2 : 1,
                borderColor: validationError ? '#ef4444' : '#d1d5db',
                margin: 4,
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
              }}
              onPress={() => onOpenDatePicker(field)}
            >
              <Text style={{ fontSize: 14, color: '#222', textAlign: 'left' }}>{value || '날짜 선택'}</Text>
            </TouchableOpacity>
          </>
        ) : options && options.length > 0 ? (
          <ScrollView horizontal style={{ padding: 4 }} showsHorizontalScrollIndicator={false}>
            {options.map(option => (
              <TouchableOpacity
                key={option}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 6,
                  backgroundColor: value === option ? '#3b82f6' : '#f3f4f6',
                  marginRight: 6,
                  alignItems: 'flex-start',
                }}
                onPress={() => onChange(option)}
              >
                <Text style={{ color: value === option ? '#fff' : '#222', fontWeight: 'bold', textAlign: 'left' }}>{option === '' ? '값 없음' : option}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TextInput
            style={{
              padding: 8,
              fontSize: 14,
              color: '#222',
              backgroundColor: '#f9fafb',
              borderRadius: 6,
              borderWidth: validationError ? 2 : 1,
              borderColor: validationError ? '#ef4444' : '#d1d5db',
              margin: 4,
              textAlign: 'left',
            }}
            value={value}
            onChangeText={text => onChange(text)}
            placeholder={field}
            placeholderTextColor="#9ca3af"
          />
        )}
        {validationError && <Text style={{ color: '#ef4444', fontSize: 12, paddingRight: 8 }}>(필수)</Text>}
      </View>
    </View>
  );
};

// 썸네일 목록
const ThumbnailList = ({ images, selectedIndex, onSelect, onRemove }) => (
  <ScrollView horizontal style={styles.thumbnailScroll} showsHorizontalScrollIndicator={false}>
    {images.map((img, index) => (
      <View key={index} style={{ position: 'relative' }}>
        <TouchableOpacity
          onPress={() => onSelect(index)}
          style={[styles.thumbnail, selectedIndex === index && styles.thumbnailSelected]}>
          <Image source={{ uri: img.uri }} style={styles.thumbnailImage} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.thumbnailRemove} onPress={() => onRemove(index)}>
          <Text style={styles.thumbnailRemoveText}>✕</Text>
        </TouchableOpacity>
      </View>
    ))}
  </ScrollView>
);

// 액션 버튼들 (촬영 / 갤러리 / 저장 / 업로드 / 공유)
const ActionButtons = ({
  onTakePicture,
  onPickImage,
  onSaveToPhone,
  onUpload,
  onShare,
  saving,
  uploading,
  imagesLength,
  selectedImage,
}) => (
  <View>
    <View style={styles.compactButtonRow}>
      <TouchableOpacity style={styles.compactButton} onPress={onTakePicture}>
        <Text style={styles.compactButtonText}>📷</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.compactButton} onPress={onPickImage}>
        <Text style={styles.compactButtonText}>🖼️</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.compactButton, (!selectedImage || saving) && styles.buttonDisabled]}
        onPress={onSaveToPhone}
        disabled={!selectedImage || saving}
      >
        <Text style={styles.compactButtonText}>💾 저장</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.compactButton, styles.uploadBtn, (imagesLength === 0 || uploading) && styles.buttonDisabled]}
        onPress={onUpload}
        disabled={imagesLength === 0 || uploading}
      >
        <Text style={styles.compactButtonText}>☁️ 전송 {imagesLength}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.compactButton, styles.kakaoBtn, !selectedImage && styles.buttonDisabled]}
        onPress={onShare}
        disabled={!selectedImage}
      >
        <Text style={styles.compactButtonText}>카카오톡 공유</Text>
      </TouchableOpacity>
    </View>
  </View>
);

/* ---------------------------
   메인 컴포넌트
   ---------------------------*/
const UploadScreen = ({ navigation }) => {
  // 상태
  const [user, setUser] = useState(null);
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [images, setImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [datePickerField, setDatePickerField] = useState(null);

  const canvasRef = useRef(null);

  // 캔버스 치수
  const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = getCanvasDims();

  // derived
  const selectedImage = selectedImageIndex !== null ? images[selectedImageIndex] : null;

  useEffect(() => {
    loadUser();
    fetchForms();
    requestCameraPermission();
  }, []);

  // 권한 요청
  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);
        // granted 객체 확인은 필요하면 로그로 남겨 디버깅
      } catch (err) {
        console.warn(err);
      }
    } else {
      // iOS: 안내만
    }
  };

  // 사용자 불러오기
  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) setUser(JSON.parse(userData));
    } catch (err) {
      console.error('Load user error:', err);
    }
  };

  // 양식 목록 가져오기
  const fetchForms = async () => {
    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('user');
      const userObj = userData ? JSON.parse(userData) : null;
      if (!userObj || !userObj.token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        navigation.replace('Login');
        return;
      }
      const res = await fetch(API.forms, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userObj.token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        const activeForms = (data.forms || [])
          .filter(f => f.isActive !== false)
          .map(f => ({
            ...f,
            fields: Array.isArray(f.fields) ? f.fields : [],
            fieldOptions: f.fieldOptions || {},
          }));
        setForms(activeForms);
      } else {
        Alert.alert('오류', data.error || '양식 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Fetch forms error:', err);
      Alert.alert('오류', '양식 목록을 불러오지 못했습니다\n' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // 양식 선택
  const handleSelectForm = form => {
    setSelectedForm(form);
    const initialData = {};
    const today = new Date().toISOString().split('T')[0];
    const fields = Array.isArray(form.fields) ? form.fields : [];
    fields.forEach(field => {
      const lower = String(field).toLowerCase();
      if (lower.includes('일자') || lower.includes('날짜') || lower.includes('공사일') || lower.includes('date')) {
        initialData[field] = today;
      } else {
        initialData[field] = '';
      }
    });
    setFormData(initialData);
    setImages([]);
    setSelectedImageIndex(null);
    setRotation(0);
    setValidationErrors({});
  };

  // 폼 유효성 검사
  const validateForm = () => {
    if (!selectedForm) return false;
    const errors = {};
    selectedForm.fields.forEach(field => {
      if (!formData[field] || String(formData[field]).trim() === '') errors[field] = true;
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 사진 찍기 / 골라오기
  const takePicture = async () => {
    const options = { mediaType: 'photo', quality: 0.8, saveToPhotos: false };
    launchCamera(options, response => {
      if (!response.didCancel && !response.errorCode && response.assets?.[0]) {
        const newImages = [...images, response.assets[0]];
        setImages(newImages);
        setSelectedImageIndex(newImages.length - 1);
        setRotation(0);
      }
    });
  };
  const pickImage = async () => {
    const options = { mediaType: 'photo', quality: 0.8, selectionLimit: 10 };
    launchImageLibrary(options, response => {
      if (!response.didCancel && !response.errorCode && response.assets) {
        const newImages = [...images, ...response.assets];
        setImages(newImages);
        setSelectedImageIndex(images.length); // 기존 이미지 개수 위치로 설정
        setRotation(0);
      }
    });
  };

  // 이미지 회전 (미리보기용)
  const rotateImage = () => setRotation(prev => (prev + 90) % 360);

  // 이미지 제거
  const removeImage = index => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (selectedImageIndex === index) {
      setSelectedImageIndex(newImages.length > 0 ? 0 : null);
      setRotation(0);
    } else if (selectedImageIndex > index) {
      setSelectedImageIndex(prev => prev - 1);
    }
  };


  // 로컬에 저장 (캔버스 캡처)
  const saveToPhone = async () => {
    if (!selectedForm) return Alert.alert('오류', '양식을 선택해주세요');
    if (images.length === 0) return Alert.alert('오류', '사진을 추가해주세요');
    if (!validateForm()) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');

    setSaving(true);
    try {
      for (let i = 0; i < images.length; i++) {
        setSelectedImageIndex(i);
        // 잠시 기다려서 ImageComposer가 변경 반영하도록 함
        await new Promise(r => setTimeout(r, 120));
        if (!canvasRef.current) throw new Error('캔버스 참조를 찾을 수 없습니다');
        const uri = await canvasRef.current.capture(); // ImageComposer 의 capture()가 파일 경로 반환한다고 가정
        const fileName = `합성이미지_${i + 1}_${Date.now()}.jpg`;
        const destDir = Platform.OS === 'android'
          ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera`
          : RNFS.PicturesDirectoryPath;
        const destPath = Platform.OS === 'android'
          ? `${destDir}/${fileName}`
          : `${destDir}/${fileName}`;

        const dirExists = await RNFS.exists(destDir);
        if (!dirExists) {
          await RNFS.mkdir(destDir);
        }
        // 캡처 결과가 base64 uri인지 file path인지에 따라 복사 방법이 달라짐.
        // 여기서는 capture()가 파일 경로를 반환한다고 가정.
        await RNFS.copyFile(uri, destPath);
        if (Platform.OS === 'android' && RNFS.scanFile) {
          try { await RNFS.scanFile(destPath); } catch (e) { /* scan 실패해도 무시 */ }
        }
      }
      Alert.alert('성공', '모든 합성 이미지가 저장되었습니다 (사진앨범)');
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('오류', '이미지 저장에 실패했습니다\n' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // 업로드 — 각 이미지를 서버에 전송한 뒤 DB 레코드 호출


const handleUpload = async () => {
  if (!selectedForm) return Alert.alert('오류', '양식을 선택해주세요');
  if (images.length === 0) return Alert.alert('오류', '사진을 추가해주세요');
  if (!validateForm()) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');

  setUploading(true);
  setUploadProgress(0);

  try {
    const userData = await AsyncStorage.getItem('user');
    const userObj = userData ? JSON.parse(userData) : null;
    if (!userObj?.token) {
      Alert.alert('오류', '로그인이 필요합니다.');
      navigation.replace('Login');
      return;
    }

    const uploadedItems = [];
    const imageUrls = [];
    const thumbnails = [];

    for (let i = 0; i < images.length; i++) {
      setSelectedImageIndex(i);
      await new Promise(r => setTimeout(r, 120));
      if (!canvasRef.current) continue;

      // 📸 원본 캡처
      const compositeUri = await canvasRef.current.capture();

      // 원본 Base64
      const base64Image = await RNFS.readFile(compositeUri, 'base64');

      // 📌 파일명 생성
      const fileNameParts = selectedForm.folderStructure || [];
      let fileName = fileNameParts.map(f => formData[f] || f).filter(Boolean).join('_');
      if (!fileName) fileName = `${selectedForm.formName}_${i + 1}`;
      fileName += `_${Date.now()}.jpg`;

      // ================================
      // ⭐ 썸네일 생성 (200 × 150)
      // ================================
      const thumb = await ImageResizer.createResizedImage(
        compositeUri,
        200,
        150,
        'JPEG',
        80
      );

      const thumbBase64 = await RNFS.readFile(thumb.uri, 'base64');
      thumbnails.push(`data:image/jpeg;base64,${thumbBase64}`);

      // ================================
      // ⭐ 업로드 데이터 구성
      // ================================
      const uploadData = {
        filename: fileName,
        base64Image: `data:image/jpeg;base64,${base64Image}`,
        thumbnail: `data:image/jpeg;base64,${thumbBase64}`, // ★ 추가됨
        formId: selectedForm._id,
        formName: selectedForm.formName,
        imageCount: images.length,
        fieldData: formData,
      };

      // ================================
      // ⭐ 서버 업로드
      // ================================
      const resp = await fetch(API.uploadPhoto, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userObj.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData),
      });

      const data = await resp.json();

      if (!data?.success) {
        console.error('Image upload failed:', data);
        Alert.alert('업로드 실패', data?.error || '서버 응답 오류');
      } else {
        uploadedItems.push({ filename: fileName, serverResponse: data });
        imageUrls.push(data.imageUrl || fileName);
      }

      setUploadProgress(Math.round(((i + 1) / images.length) * 100));
    }

    // ================================
    // ⭐ DB 기록 API 호출
    // ================================
    if (uploadedItems.length > 0) {
      const dbPayload = {
        formName: selectedForm.formName,
        formId: selectedForm._id,
        data: formData,
        imageUrls,
        imageCount: images.length,
        thumbnails,      // ★ DB에도 썸네일 저장
        uploadedItems,
      };

      const resDb = await fetch(API.uploads, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${JSON.parse(await AsyncStorage.getItem('user')).token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dbPayload),
      });

      const dbData = await resDb.json();

      if (dbData?.success) {
        Alert.alert('성공', `${uploadedItems.length}개의 사진이 업로드되어 DB에 기록됨`);
        setImages([]);
        setSelectedImageIndex(null);
      } else {
        Alert.alert('업로드 완료(일부)', `이미지는 업로드되었으나 DB 기록에 실패했습니다.`);
      }
    } else {
      Alert.alert('실패', '이미지 업로드에 실패했습니다.');
    }
  } catch (err) {
    console.error('Upload error:', err);
    Alert.alert('오류', '업로드 중 오류가 발생했습니다\n' + (err.message || err));
  } finally {
    setUploading(false);
    setUploadProgress(0);
  }
};

  // 카카오톡 공유
  const handleKakaoShare = async () => {
    if (!selectedImage) return;
    if (!canvasRef.current) return;
    try {
      const uri = await canvasRef.current.capture();
      await Share.open({
        url: uri,
        title: '카카오톡으로 공유',
        message: '합성 이미지를 카카오톡으로 공유합니다.',
        social: Share.Social.KAKAO,
      });
    } catch (e) {
      Alert.alert('공유 오류', e.message || e);
    }
  };

  // 날짜 피커 변경 처리
  const onDateChange = (event, date) => {
    // event.type은 플랫폼/버전 따라 다름; 여기서는 단순 처리
    if (!date) {
      setDatePickerField(null);
      return;
    }
    const iso = date.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, [datePickerField]: iso }));
    setValidationErrors(prev => ({ ...prev, [datePickerField]: false }));
    setDatePickerField(null);
  };

  // 폼 필드 업데이트 유틸
  const updateField = (field, value) => {
    // 위치 자동 포맷 예시
    let newVal = value;
    if (/^\d{1,3}-\d{1,4}$/.test(value) && (field.includes('위치') || field.includes('호') || field.includes('동'))) {
      const [dong, ho] = value.split('-');
      newVal = `${dong}동-${ho}호`;
    }
    setFormData(prev => ({ ...prev, [field]: newVal }));
    setValidationErrors(prev => ({ ...prev, [field]: false }));
  };

  // 테이블 렌더 관련 계산 (원본 로직 유지)
  const entries = (selectedForm?.fields || []).map(field => ({ field }));
  const fontPx = parseInt(((canvasConfig.table.font || '').match(/(\d+)px/) || [])[1] || '16', 10);
  const fontSize = Math.max(10, Math.floor(CANVAS_WIDTH * fontPx / canvasConfig.width));
  const minCol1Width = fontSize * 6 * 1.1;
  const minCol2Width = fontSize * 9 * 1.1;
  let maxCol2TextWidth = entries.reduce((max, entry) => {
    const value = formData[entry.field] || '';
    return Math.max(max, value.length * fontSize * 0.6);
  }, 0);
  let col1Width = CANVAS_WIDTH * canvasConfig.table.col1Ratio * (2 / 3);
  let col1TextMax = Math.max(...entries.map(e => (e.field.length * fontSize * 0.6)));
  let col2TextMax = Math.max(...entries.map(e => ((formData[e.field] || '').length * fontSize * 0.6)));
  let col1FinalWidth = Math.max(col1Width, minCol1Width, col1TextMax + cellPaddingX * 2 + 12);
  let col2FinalWidth = Math.max(minCol2Width, col2TextMax + cellPaddingX * 2 + 12);
  let MIN_TABLE_WIDTH = CANVAS_WIDTH * canvasConfig.table.widthRatio;
  let tableWidth = Math.max(MIN_TABLE_WIDTH, col1FinalWidth + col2FinalWidth);
  let MAX_TABLE_WIDTH = CANVAS_WIDTH * 0.95;
  if (tableWidth > MAX_TABLE_WIDTH) {
    tableWidth = MAX_TABLE_WIDTH;
    // 너비 초과 시, 1열은 최소값, 2열은 나머지
    col1FinalWidth = Math.max(col1Width, minCol1Width);
    col2FinalWidth = tableWidth - col1FinalWidth;
  }
  const rowHeight = fontSize * 2.2;
  const tableHeight = entries.length * rowHeight;

  if (loading || !user) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
    <MainHeader navigation={navigation} activeTab="upload" />
      <StatusBar barStyle="lig/t-content" backgroundColor="#3b82f6" />
 
    
      <ScrollView style={styles.content}>
        {/* 1. 양식 선택 */}
        <Text style={styles.sectionTitle}>입력 양식 선택</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ minHeight: 56, maxHeight: 72 }}>
          {forms.map(form => (
            <TouchableOpacity
              key={form._id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: 18,
                marginRight: 10,
                borderWidth: 1,
                borderColor: selectedForm?._id === form._id ? '#2563eb' : '#d1d5db',
                borderRadius: 16,
                backgroundColor: selectedForm?._id === form._id ? '#e0e7ff' : '#fff',
                elevation: selectedForm?._id === form._id ? 2 : 0,
              }}
              onPress={() => handleSelectForm(form)}
            >
              <Text style={{
                fontSize: 15,
                color: selectedForm?._id === form._id ? '#2563eb' : '#222',
                fontWeight: selectedForm?._id === form._id ? 'bold' : 'normal',
              }}>{form.formName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 2. 정보 입력 */}
        {selectedForm && (
          <View>
            <View style={{ marginBottom: 16 }}>

              <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                {(selectedForm.fields || []).map(field => {
                  const isDateField = ['일자', '날짜', '공사일', 'date'].some(k => field.toLowerCase().includes(k));
                  const options = selectedForm.fieldOptions?.[field] && Array.isArray(selectedForm.fieldOptions[field])
                    ? selectedForm.fieldOptions[field]
                    : null;
                  return (
                    <FormField
                      key={field}
                      field={field}
                      value={formData[field]}
                      onChange={val => updateField(field, val)}
                      isDate={isDateField}
                      options={options}
                      validationError={!!validationErrors[field]}
                      onOpenDatePicker={f => setDatePickerField(f)}
                    />
                  );
                })}
              </View>
            </View>

            {/* 날짜 피커 */}
            {datePickerField && (
              <DateTimePicker
                value={formData[datePickerField] ? new Date(formData[datePickerField]) : new Date()}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}
            {/* 액션 버튼들 */}
                <ActionButtons
                onTakePicture={takePicture}
                onPickImage={pickImage}
                onSaveToPhone={saveToPhone}
                onUpload={handleUpload}
                onShare={handleKakaoShare}
                saving={saving}
                uploading={uploading}
                imagesLength={images.length}
                selectedImage={selectedImage}
              />
            {/* 미리보기(캔버스 + 표 오버레이) + 회전 버튼 */}
            {selectedImage && (
              <View style={{
                position: 'relative',
                width: CANVAS_WIDTH + 4,
                height: CANVAS_HEIGHT + 4,
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ImageComposer
                  ref={canvasRef}
                  selectedImage={selectedImage}
                  rotation={rotation}
                  canvasDims={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
                  tableEntries={entries}
                  tableConfig={{
                    col1FinalWidth,
                    col2FinalWidth,
                    tableWidth,
                    tableHeight,
                    cellPaddingX,
                    cellPaddingY,
                    fontSize,
                    backgroundColor: canvasConfig.table.backgroundColor,
                    borderColor: canvasConfig.table.borderColor,
                    borderWidth: canvasConfig.table.borderWidth,
                    textColor: canvasConfig.table.textColor,
                  }}
                  formData={formData}
                />
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    backgroundColor: '#2563eb',
                    borderRadius: 20,
                    padding: 10,
                    elevation: 3,
                  }}
                  onPress={rotateImage}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>⟳</Text>
                </TouchableOpacity>
              </View>

            )}
              


<View>
              {images.length > 0 && (
                <ThumbnailList
                  images={images}
                  selectedIndex={selectedImageIndex}
                  onSelect={index => { setSelectedImageIndex(index); setRotation(0); }}
                  onRemove={removeImage}
                />
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/*
      토큰 표시 (디버그용)
      <View style={{ width: '100%', padding: 12, marginTop: 24, alignItems: 'center' }}>
        업로드 진행 UI
        {uploading && (
          <View style={{
            width: '100%',
            padding: 8,
            backgroundColor: '#ffffff',
            borderRadius: 8,
            marginBottom: 8, // 썸네일과 간격 확보
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 14, color: '#111827', marginBottom: 4 }}>
              {uploadProgress}% 전송 중...
            </Text>
            <View style={{ width: '100%', height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: '#2563eb' }} />
            </View>
          </View>
        )}
      </View>
      */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#3b82f6',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 14,
    color: '#e0e7ff',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  compactButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  compactButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  compactButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
  },
  uploadBtn: {
    backgroundColor: '#2563eb',
  },
  kakaoBtn: {
    backgroundColor: '#f9e84e',
  },
  thumbnailScroll: {
    marginTop: 8,
    marginBottom: 16,
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  thumbnailSelected: {
    borderColor: '#3b82f6',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  thumbnailRemoveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default UploadScreen;
