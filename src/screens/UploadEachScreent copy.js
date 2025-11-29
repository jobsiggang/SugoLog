// src/screens/UploadEachScreen.js


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
import ImageComposer from '../components/ImageComposer.js';
import { useSharedUploadLogic } from '../hooks/useSharedUploadLogic.js';
import API from '../config/api.js';
import { canvasConfig } from '../config/compositeConfig.js'; 
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


const ActionButtons = React.memo(({
  onTakePicture, onPickImage, onSaveToPhone, onUpload, onShare,
  saving, uploading, imagesLength, selectedImage,
}) => (
<View>
  <View style={styles.compactButtonRow}>

    <TouchableOpacity 
      style={[styles.compactButton, uploading && styles.buttonDisabled]} 
      onPress={onTakePicture}
      disabled={uploading}
    >
      <Text style={styles.compactButtonText}>📷</Text>
    </TouchableOpacity>
    
    <TouchableOpacity 
      style={[styles.compactButton, uploading && styles.buttonDisabled]} 
      onPress={onPickImage}
      disabled={uploading}
    >
      <Text style={styles.compactButtonText}>🖼️</Text>
    </TouchableOpacity>
    
    <TouchableOpacity 
      // 1. styles.buttonDisabled 스타일 적용은 disabled 속성이 처리하도록 스타일에서 제거
      // 2. styles.kakaoBtn은 그대로 유지
      style={[styles.compactButton, styles.kakaoBtn]} 
      onPress={onShare}
      // 🚨 문법 에러 수정 (isabled -> disabled)
      disabled={!selectedImage} 
    >
      <Text style={styles.compactButtonText}>공유</Text>
    </TouchableOpacity>
  </View>
</View>
));

/* ---------------------------
  메인 컴포넌트: UploadEachScreen
---------------------------*/

const UploadEachScreen = ({ navigation, route }) => {
   // 1. 공통 훅 사용
    const sharedLogic = useSharedUploadLogic(navigation, route, 'batch');
  
    // 2. 이미지/업로드 관련 상태 (로컬 상태 유지)
    const [images, setImages] = useState([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState(null);
    const [rotation, setRotation] = useState(0);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const canvasRef = useRef(null);
    const [uploadedThumbnails, setUploadedThumbnails] = useState([]);
    const [rotationPending, setRotationPending] = useState(false);
    const selectedImage = selectedImageIndex !== null ? images[selectedImageIndex] : null;
    // rotation 상태를 직접 사용 (selectedImage에 rotation 없음)
    // const currentRotation = selectedImage?.rotation || 0;
    // ✅ 수정 (안전하게 기본값 []와 {}를 할당):
  const { user, forms, selectedForm, formData, validateForm, updateField, onDateChange, setDatePickerField,validationErrors } = sharedLogic;
  // sharedLogic 훅이 C_W, C_H, entries, tableConfig를 반환한다고 가정
  const { 
    CANVAS_WIDTH: C_W = 0, 
    CANVAS_HEIGHT: C_H = 0, 
    entries = [], 
    tableConfig = {} 
  } = sharedLogic;

  // 🚀 [추가] 탭이 선택될 때 'each' 모드를 저장하고, 현재 모드와 불일치 시 화면 교정
  useFocusEffect(
    React.useCallback(() => {
      const saveModeAndCheckNavigation = async () => {
        // 1. 모드 저장 (탭 선택 시 모드 자동 변경)
        await AsyncStorage.setItem('uploadMode', 'each');

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

   // useEffect 수정: 모든 의존성 추가 (기존에 주석 처리했던 부분)
// 단, 이 경우 formData나 selectedForm이 변경될 때도 handleApply가 실행될 수 있습니다.
// images.length === 1 조건을 만족한 후 폼 데이터를 수정하면 자동 업로드가 다시 시도됩니다.
   useEffect(() => {
    // 모든 정보가 입력되고, 이미지가 1장 선택된 경우만
    if (
      selectedForm &&
      images.length === 1 &&
      selectedImageIndex === 0 &&
      !uploading &&
      !saving
    ) {
      handleApply();
    }
    // 🚨 images 외에 formData와 selectedForm을 다시 추가해야 합니다.
  }, [images, formData, selectedForm, selectedImageIndex]);
const handleApply = async () => {
    setRotationPending(false);
    const valid = await validateForm();
    if (!valid) {
      Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
      return;
    }
    await handleUpload();
  };
// [NEW] 양식 선택 및 이미지 초기화 통합 함수
const handleFormSelectionAndReset = useCallback((form) => {
    // 1. 기존 이미지 관련 상태 초기화
    setImages([]);
    setSelectedImageIndex(null);
    setRotation(0);
    // 썸네일 목록도 초기화합니다. (필요하다면)
    setUploadedThumbnails([]); 
  // 2. 공통 로직 실행 (sharedLogic이 selectedForm, formData 등을 업데이트)
  // 이 함수는 sharedLogic에서 가져온 것이 아니라, 컴포넌트 내부의 sharedLogic 변수를 사용합니다.
  // 만약 sharedLogic 안에 handleSelectForm이 없다면, 여기서 직접 상태를 업데이트해야 합니다.
  sharedLogic.handleSelectForm(form); 
}, [setImages, setSelectedImageIndex, setRotation, setUploadedThumbnails, sharedLogic]);
  
// 사진 찍기 / 골라오기 (한 장씩만 입력)
  // [✨ 수정] 이미지 선택 완료 후 handleApply 호출


  // 사진을 찍으면 즉시 갤러리에 저장하고, 저장된 경로를 images에 저장
  const takePicture = useCallback(async () => {
    const valid = await validateForm();
    if (!valid) {
      return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
    }
    const options = { mediaType: 'photo', quality: 0.8, saveToPhotos: true };
    launchCamera(options, async response => {
      if (!response.didCancel && !response.errorCode && response.assets?.[0]) {
        const asset = response.assets[0];
        let destDir = Platform.OS === 'android'
          ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera`
          : RNFS.PicturesDirectoryPath;
        const fileName = `SugoLog_${Date.now()}.jpg`;
        const destPath = `${destDir}/${fileName}`;
        try {
          const dirExists = await RNFS.exists(destDir);
          if (!dirExists) await RNFS.mkdir(destDir);
          await RNFS.copyFile(asset.uri.replace('file://', ''), destPath);
          setImages([{ uri: 'file://' + destPath }]);
          setSelectedImageIndex(0);
          setRotation(0);
          Alert.alert('저장 완료', '사진이 앨범에 저장되었습니다.');
        } catch (err) {
          Alert.alert('저장 실패', '사진 저장에 실패했습니다.');
        }
      }
    });
  }, [validateForm]);


  // 사진을 선택하면 즉시 갤러리에 저장하고, 저장된 경로를 images에 저장
  const pickImage = useCallback(async () => {
    const valid = await validateForm();
    const options = { mediaType: 'photo', quality: 0.8, selectionLimit: 1 };
    if (!valid) {
      return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
    }
    launchImageLibrary(options, async response => {
      if (!response.didCancel && !response.errorCode && response.assets?.[0]) {
        const asset = response.assets[0];
        let destDir = Platform.OS === 'android'
          ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera`
          : RNFS.PicturesDirectoryPath;
        const fileName = `SugoLog_${Date.now()}.jpg`;
        const destPath = `${destDir}/${fileName}`;
        try {
          const dirExists = await RNFS.exists(destDir);
          if (!dirExists) await RNFS.mkdir(destDir);
          await RNFS.copyFile(asset.uri.replace('file://', ''), destPath);
          setImages([{ uri: 'file://' + destPath }]);
          setSelectedImageIndex(0);
          setRotation(0);
          Alert.alert('저장 완료', '사진이 앨범에 저장되었습니다.');
        } catch (err) {
          Alert.alert('저장 실패', '사진 저장에 실패했습니다.');
        }
      }
    });
  }, [validateForm]);

  const rotateImage = useCallback(() => setRotation(prev => (prev + 90) % 360), []);





// 업로드: 갤러리에 저장된 원본 파일을 바로 서버로 전송
const handleUpload = async () => {
  const thumbnails = [];
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

    // 갤러리에 저장된 파일 경로에서 바로 base64 변환 및 썸네일 생성
    const fileUri = images[0].uri.replace('file://', '');
    const fileName = fileUri.split('/').pop();
    const base64Image = await RNFS.readFile(fileUri, 'base64');
    // 썸네일 생성
    const thumbObj = await ImageResizer.createResizedImage(
      images[0].uri,
      200,
      150,
      'JPEG',
      80
    );
    const thumbBase64 = await RNFS.readFile(thumbObj.uri.replace('file://', ''), 'base64');
    thumbnails.push(`data:image/jpeg;base64,${thumbBase64}`);
    // 업로드 데이터 구성
    const uploadData = {
      filename: fileName,
      base64Image: `data:image/jpeg;base64,${base64Image}`,
      thumbnail: `data:image/jpeg;base64,${thumbBase64}`,
      formId: selectedForm._id,
      formName: selectedForm.formName,
      imageCount: images.length,
      fieldData: formData,
    };



    const resp = await fetch(API.uploadPhoto, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userObj.token}`,
      },
      body: JSON.stringify(uploadData),
    });
    const data = await resp.json();
    if (!data?.success) {
      console.error('Image upload failed:', data);
      Alert.alert('업로드 실패', data?.error || '서버 응답 오류');
    } else {
      // DB 기록
      const dbPayload = {
        formName: selectedForm.formName,
        formId: selectedForm._id,
        data: formData,
        imageUrls: [data.imageUrl || fileName],
        imageCount: 1,
        thumbnails: [data.thumbnailUrl || ''],
        uploadedItems: [{ filename: fileName, serverResponse: data }],
      };
      const resDb = await fetch(API.uploads, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userObj.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dbPayload),
      });
      const dbData = await resDb.json();
      if (dbData?.success) {
        setUploadedThumbnails(prev => {
          const newThumbnails = [(data.thumbnailUrl || ''), ...prev];
          const MAX_THUMBNAILS = 20;
          if (newThumbnails.length > MAX_THUMBNAILS) {
            return newThumbnails.slice(0, MAX_THUMBNAILS);
          }
          return newThumbnails;
        });
      } else {
        Alert.alert('업로드 완료(일부)', `이미지는 업로드되었으나 DB 기록에 실패했습니다.`);
      }
    }
  } catch (err) {
    console.error('Upload error:', err);
    Alert.alert('오류', '업로드 중 오류가 발생했습니다\n' + (err.message || err));
  } finally {
    setUploading(false);
    setUploadProgress(0);
  }
};
 


// UploadEachScreen 또는 UploadMultiScreen 컴포넌트 내부

const handleKakaoShare = async () => {
    if (uploadedThumbnails.length === 0) {
        Alert.alert('공유 오류', '공유할 썸네일 이미지가 없습니다. 먼저 업로드를 완료해주세요.');
        return;
    }

    setUploading(true); // 공유 중 로딩 표시 (선택 사항)
    const filesToShare = [];

    try {
        // 1. 모든 Base64 썸네일을 로컬 파일로 저장
        for (let i = 0; i < uploadedThumbnails.length; i++) {
            const base64Data = uploadedThumbnails[i].replace('data:image/jpeg;base64,', '');
            
            // 임시 파일 경로 설정
            const tempPath = `${RNFS.TemporaryDirectoryPath}/thumb_share_${i}_${Date.now()}.jpg`;
            
            // Base64 데이터를 파일로 쓰기
            await RNFS.writeFile(tempPath, base64Data, 'base64');
            filesToShare.push(`file://${tempPath}`); // 파일 URI 목록에 추가
        }

        // 2. 파일 URI 배열을 사용하여 공유
        await Share.open({
            // Note: 카카오톡 공유는 files 배열 대신 urls 속성을 사용할 수 있습니다.
            urls: filesToShare,
            title: '합성 이미지 공유',
            message: `[총 ${uploadedThumbnails.length}장의 합성 이미지]를 공유합니다.`,
            // social: Share.Social.KAKAO, // 특정 소셜만 지정하면 오류 가능성이 있어 제거하거나 옵션으로 남김
        });

        Alert.alert('성공', `${uploadedThumbnails.length}장의 썸네일 이미지를 공유했습니다.`);

    } catch (e) {
        if (e.message !== 'User did not share') { // 사용자가 취소한 경우는 무시
            console.error('Share error:', e);
            Alert.alert('공유 오류', e.message || '공유 중 알 수 없는 오류가 발생했습니다.');
        }
    } finally {
        setUploading(false);

        // 3. 임시 파일 정리 (선택 사항이지만 권장)
        filesToShare.forEach(async (uri) => {
            try {
                const path = uri.replace('file://', '');
                if (await RNFS.exists(path)) {
                    await RNFS.unlink(path);
                }
            } catch (err) {
                console.warn('Failed to unlink shared file:', err);
            }
        });
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
  
      <StatusBar barStyle="light-content" backgroundColor="#3b82f6" />
     <ScrollView style={styles.content}>
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

            {sharedLogic.datePickerField && (
              <DateTimePicker
                value={formData[sharedLogic.datePickerField] ? new Date(formData[sharedLogic.datePickerField]) : new Date()}
                mode="date"
                display="default"
                onChange={sharedLogic.onDateChange}
              />
            )}
            
    
            <ActionButtons
              onTakePicture={takePicture}
              onPickImage={pickImage}
              onUpload={handleUpload}
              onShare={handleKakaoShare}
              saving={saving}
              uploading={uploading}
              imagesLength={images.length}
              selectedImage={selectedImage}
            />
            


            {selectedImage && (
              <View style={{ position: 'relative', width: C_W + 4, height: C_H + 4, alignItems: 'center', justifyContent: 'center' }}>
                <ImageComposer
                  ref={canvasRef}
                  selectedImage={selectedImage}
                  rotation={rotation}
                  canvasDims={{ width: C_W, height: C_H }}
                  tableEntries={entries}
                  tableConfig={tableConfig}
                  formData={formData}
                />
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 70,
                    backgroundColor: '#2563eb',
                    borderRadius: 20,
                    padding: 10,
                    elevation: 3,
                  }}
                  onPress={rotateImage}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20}}>⟳</Text>
                </TouchableOpacity>
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
                  onPress={handleApply}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20 }}>✔</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* <View>
              {images.length > 0 && (
                <ThumbnailList
                    images={images}
                    selectedIndex={selectedImageIndex}
                    onSelect={index => { setSelectedImageIndex(index); }}
                    onRemove={removeImage}
                />
              )}
            </View> */}
          </View>
        )}
      </ScrollView>

     <View style={{ width: '100%', padding: 12, marginTop: 24, alignItems: 'center' }}>

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



export default UploadEachScreen;