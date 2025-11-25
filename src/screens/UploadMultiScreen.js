// src/screens/UploadMultiScreen.js

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, TextInput, StyleSheet, Alert,
  ActivityIndicator, StatusBar, Dimensions, PermissionsAndroid, Platform, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import ImageResizer from 'react-native-image-resizer';
import { useFocusEffect } from '@react-navigation/native'; // 탭 포커스 이벤트 사용

// 공통 컴포넌트/훅 import
import ImageComposer from '../components/ImageComposer';
import { useSharedUploadLogic } from '../hooks/useSharedUploadLogic';
import API from '../config/api';
import { canvasConfig } from '../config/compositeConfig'; 
import styles from './styles/UploadCommonStyles.js';


const { width: screenWidth } = Dimensions.get('window');


// 캔버스 크기 상수는 훅 내부에서 계산된 최종 값을 사용하지만, 로컬 상수는 유틸리티 로직을 위해 유지
const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = {
  width: Math.floor(screenWidth * 0.7),
  height: Math.floor((Math.floor(screenWidth * 0.7) * canvasConfig.height) / canvasConfig.width)
};



/* ---------------------------
  내부 UI 컴포넌트 (FormField, ThumbnailList, ActionButtons)
---------------------------*/

const FormField = React.memo(({ field, value, onChange, isDate, options, validationError, onOpenDatePicker }) => {
  // 폼 필드 UI: 스타일링은 인라인 유지 (UploadEachScreen과의 일관성을 위해)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' }}>
      <Text style={{ width: '16.66%', textAlign: 'left', padding: 8, fontWeight: 'bold', color: '#222', fontSize: 14 }}>{field}</Text>
      <View style={{ flex: 1, marginLeft: '0%' }}>
        {isDate ? (
          <TouchableOpacity 
            style={{ padding: 8, backgroundColor: '#f9fafb', borderRadius: 6, borderWidth: validationError ? 2 : 1, borderColor: validationError ? '#ef4444' : '#d1d5db', margin: 4, justifyContent: 'flex-start', alignItems: 'flex-start' }}
            onPress={() => onOpenDatePicker(field)}
          >
            <Text style={{ fontSize: 14, color: '#222', textAlign: 'left' }}>{value || '날짜 선택'}</Text>
          </TouchableOpacity>
        ) : options && options.length > 0 ? (
          <ScrollView horizontal style={{ padding: 4 }} showsHorizontalScrollIndicator={false}>
            {options.map(option => (
              <TouchableOpacity
                key={option}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: value === option ? '#3b82f6' : '#f3f4f6', marginRight: 6, alignItems: 'flex-start' }}
                onPress={() => onChange(option)}
              >
                <Text style={{ color: value === option ? '#fff' : '#222', fontWeight: 'bold', textAlign: 'left' }}>{option === '' ? '값 없음' : option}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TextInput
            style={{ padding: 8, fontSize: 14, color: '#222', backgroundColor: '#f9fafb', borderRadius: 6, borderWidth: validationError ? 2 : 1, borderColor: validationError ? '#ef4444' : '#d1d5db', margin: 4, textAlign: 'left' }}
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
});

const ThumbnailList = React.memo(({ images, selectedIndex, onSelect, onRemove }) => (
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
));

const ActionButtons = React.memo(({
  onTakePicture, onPickImage, onSaveToPhone, onUpload, onShare,
  saving, uploading, imagesLength, selectedImage,
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
    // 🚨 여기서 || 대신 &&를 사용하여 논리를 수정합니다.
    style={[
        styles.compactButton, 
        styles.uploadBtn, 
        (imagesLength === 0 || uploading) && styles.buttonDisabled // 👈 수정됨
    ]}
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
        <Text style={styles.compactButtonText}>공유</Text>
      </TouchableOpacity>
    </View>
  </View>
));

/* ---------------------------
  메인 컴포넌트: UploadMultiScreen
---------------------------*/

const UploadMultiScreen = ({ navigation, route }) => {
  // 1. 공통 훅 사용
  const sharedLogic = useSharedUploadLogic(navigation, route, 'batch');

  // 2. 이미지/업로드 관련 상태 (로컬 상태 유지)
  const [images, setImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  // const [rotation, setRotation] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);
  
  const selectedImage = selectedImageIndex !== null ? images[selectedImageIndex] : null;
  // 💡 NEW: 선택된 이미지 객체에서 회전 각도를 가져오고, 없으면 0을 사용
  const currentRotation = selectedImage?.rotation || 0;
  // ✅ 수정 (안전하게 기본값 []와 {}를 할당):
const { user, forms, selectedForm, formData, validateForm, updateField, onDateChange, setDatePickerField,validationErrors } = sharedLogic;
// sharedLogic 훅이 C_W, C_H, entries, tableConfig를 반환한다고 가정
const { 
  CANVAS_WIDTH: C_W = 0, 
  CANVAS_HEIGHT: C_H = 0, 
  entries = [], 
  tableConfig = {} 
} = sharedLogic;
  // 🚀 [추가] 탭이 선택될 때 'multi' 모드를 저장하고, 현재 모드와 불일치 시 화면 교정
  useFocusEffect(
    React.useCallback(() => {
      const saveModeAndCheckNavigation = async () => {
        // 1. 모드 저장 (탭 선택 시 모드 자동 변경)
        await AsyncStorage.setItem('uploadMode', 'multi');

        // 2. 초기 로딩 시 모드 불일치 체크 및 교정 (MainHeader에서 대신 할 수도 있음)
        const mode = await AsyncStorage.getItem('uploadMode');
        if (mode === 'single' && navigation.canGoBack()) {
             // 'UploadEach' 탭으로 이동 (하단 탭 선택이 아닌 경우를 대비)
             navigation.replace('UploadEach'); 
             return;
        }
      };
      saveModeAndCheckNavigation();
    }, [])
  );

  // --- 이미지 처리 로직 (로컬 상태 사용) ---

// handleImagePickerResponse 함수 수정 (약 380줄 부근)

const handleImagePickerResponse = useCallback((response) => {
    if (!response.didCancel && !response.errorCode && response.assets) {
        const assetsWithRotation = (Array.isArray(response.assets) ? response.assets : [response.assets])
            // 🚨 새 이미지 객체에 rotation: 0 속성 추가
            .map(asset => ({ ...asset, rotation: 0 })); 
            
        const newImages = [...images, ...assetsWithRotation];
        setImages(newImages);
        setSelectedImageIndex(images.length); 
    }
}, [images]);
// [NEW] 양식 선택 및 이미지 초기화 통합 함수
const handleFormSelectionAndReset = useCallback((form) => {
    // 1. 기존 이미지 관련 상태 초기화
    setImages([]);
    setSelectedImageIndex(null);
    // setRotation(0);
    // 썸네일 목록도 초기화합니다. (필요하다면)

    // 2. 공통 로직 실행 (sharedLogic이 selectedForm, formData 등을 업데이트)
    // 이 함수는 sharedLogic에서 가져온 것이 아니라, 컴포넌트 내부의 sharedLogic 변수를 사용합니다.
    // 만약 sharedLogic 안에 handleSelectForm이 없다면, 여기서 직접 상태를 업데이트해야 합니다.
    sharedLogic.handleSelectForm(form); 
    
}, [setImages, setSelectedImageIndex, sharedLogic]);
  const takePicture = useCallback(async () => {
    const valid = await validateForm();
    if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
    launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: false }, handleImagePickerResponse);
  }, [validateForm, handleImagePickerResponse]);

  const pickImage = useCallback(async () => {
    const valid = await validateForm();
    if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
    launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 10 }, handleImagePickerResponse);
  }, [validateForm, handleImagePickerResponse]);

 // rotateImage 함수 수정 (약 400줄 부근)
const rotateImage = useCallback(() => {
    if (selectedImageIndex === null) return;

    setImages(prevImages => {
        const newImages = [...prevImages];
        const currentImage = newImages[selectedImageIndex];
        
        // 🚨 이미지 객체의 rotation 속성을 90도 증가 (없으면 0에서 시작)
        const newRotation = (currentImage.rotation || 0) + 90;
        currentImage.rotation = newRotation % 360;
        
        return newImages;
    });
}, [selectedImageIndex]); // 🚨 의존성 수정

  const removeImage = useCallback(index => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (selectedImageIndex === index) {
      setSelectedImageIndex(newImages.length > 0 ? 0 : null);
      // setRotation(0);
    } else if (selectedImageIndex > index) {
      setSelectedImageIndex(prev => prev - 1);
    }
  }, [images, selectedImageIndex]);


  // --- 저장 및 업로드 로직 (멀티스크린 고유) ---

  const saveToPhone = async () => {
    if (!selectedForm || images.length === 0) return Alert.alert('오류', '사진을 추가해주세요');
    if (!validateForm()) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
    if (!canvasRef.current) return Alert.alert('오류', '캔버스 참조를 찾을 수 없습니다');

    setSaving(true);
    try {
        // --- 캡처 및 저장 로직 ---
        for (let i = 0; i < images.length; i++) {
            setSelectedImageIndex(i);
            await new Promise(r => setTimeout(r, 120)); 
            if (!canvasRef.current) continue;

            const uri = await canvasRef.current.capture(); 
            const fileName = `합성이미지_${i + 1}_${Date.now()}.jpg`;
            const destDir = Platform.OS === 'android' ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera` : RNFS.PicturesDirectoryPath;
            const destPath = Platform.OS === 'android' ? `${destDir}/${fileName}` : `${destDir}/${fileName}`;

            const dirExists = await RNFS.exists(destDir);
            if (!dirExists) { await RNFS.mkdir(destDir); }
            await RNFS.copyFile(uri, destPath);
            if (Platform.OS === 'android' && RNFS.scanFile) { try { await RNFS.scanFile(destPath); } catch (e) { /* ignore */ } }
        }
        Alert.alert('성공', '모든 합성 이미지가 저장되었습니다 (사진앨범)');
    } catch (err) {
        console.error('Save error:', err);
        Alert.alert('오류', '이미지 저장에 실패했습니다\n' + (err.message || err));
    } finally {
        setSaving(false);
    }
  };

const handleUpload = async () => {
  if (!selectedForm) return Alert.alert('오류', '양식을 선택해주세요');
  if (images.length === 0) return Alert.alert('오류', '사진을 추가해주세요');
  if (!validateForm()) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');

  setUploading(true);
  setUploadProgress(0);
  saveToPhone();
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
        // setImages([]);
        // setSelectedImageIndex(null);
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

  const handleKakaoShare = async () => {
    if (!selectedImage) return;
    if (!canvasRef.current) return;
    try {
        const uri = await canvasRef.current.capture();
        await Share.open({
            url: uri, title: '카카오톡으로 공유', message: '합성 이미지를 카카오톡으로 공유합니다.',
            social: Share.Social.KAKAO,
        });
    } catch (e) {
        Alert.alert('공유 오류', e.message || e);
    }
  };


  if (sharedLogic.loading || !user) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // --- 렌더링 ---

  return (
    <View style={styles.container}>
      {/* MainHeader는 App.tsx에서 Tab Navigator의 header 옵션으로 설정됩니다. */}
      {/* <MainHeader navigation={navigation} /> */} 
      <StatusBar barStyle="light-content" backgroundColor="#3b82f6" />

     <ScrollView style={styles.content}>
        {/* 1. 양식 선택 */}
        <Text style={styles.sectionTitle}>입력 양식 선택</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ minHeight: 56, maxHeight: 72 }}>
          {forms.map(form => (
            <TouchableOpacity
              key={form._id}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 18, marginRight: 10, borderWidth: 1, borderColor: selectedForm?._id === form._id ? '#2563eb' : '#d1d5db', borderRadius: 16, backgroundColor: selectedForm?._id === form._id ? '#e0e7ff' : '#fff', elevation: selectedForm?._id === form._id ? 2 : 0 }}
              onPress={() => handleFormSelectionAndReset(form)}            >
              <Text style={{ fontSize: 15, color: selectedForm?._id === form._id ? '#2563eb' : '#222', fontWeight: selectedForm?._id === form._id ? 'bold' : 'normal' }}>{form.formName}</Text>
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
                  const options = selectedForm.fieldOptions?.[field] && Array.isArray(selectedForm.fieldOptions[field]) ? selectedForm.fieldOptions[field] : null;
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
            {sharedLogic.datePickerField && (
              <DateTimePicker
                value={formData[sharedLogic.datePickerField] ? new Date(formData[sharedLogic.datePickerField]) : new Date()}
                mode="date"
                display="default"
                onChange={sharedLogic.onDateChange}
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
              <View style={{ position: 'relative', width: C_W + 4, height: C_H + 4, alignItems: 'center', justifyContent: 'center' }}>
                <ImageComposer
                  ref={canvasRef}
                  selectedImage={selectedImage}
                  rotation={currentRotation}
                  canvasDims={{ width: C_W, height: C_H }}
                  tableEntries={entries}
                  tableConfig={tableConfig}
                  formData={formData}
                />
                <TouchableOpacity
                  style={{ position: 'absolute', top: 12, right: 12, backgroundColor: '#2563eb', borderRadius: 20, padding: 10, elevation: 3 }}
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
                    // onSelect에서 setRotation(0) 제거
                    onSelect={index => { setSelectedImageIndex(index); /* setRotation(0); 제거됨 */ }} 
                    onRemove={removeImage}
                />
              )}
            </View>
          </View>
        )}
      </ScrollView>


      <View style={{ width: '100%', padding: 12, marginTop: 24, alignItems: 'center' }}>
        {/* 업로드 진행 UI */}
        {uploading && (
          <View style={{ width: '100%', padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#111827', marginBottom: 4 }}>
              {uploadProgress}% 전송 중...
            </Text>
            <View style={{ width: '100%', height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: '#2563eb' }} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
};



export default UploadMultiScreen;