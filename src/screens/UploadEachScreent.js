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
import { useFocusEffect } from '@react-navigation/native';

// 공통 컴포넌트/훅 import
import ImageComposer from '../components/ImageComposer';
import { useSharedUploadLogic } from '../hooks/useSharedUploadLogic';
import API from '../config/api';
import { canvasConfig } from '../config/compositeConfig'; 
import styles from './styles/UploadCommonStyles.js';


const { width: screenWidth } = Dimensions.get('window');

const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = {
    width: Math.floor(screenWidth * 0.7),
    height: Math.floor((Math.floor(screenWidth * 0.7) * canvasConfig.height) / canvasConfig.width)
};


/* ---------------------------
  내부 UI 컴포넌트 (FormField, ThumbnailList)
---------------------------*/

const FormField = React.memo(({ field, value, onChange, isDate, options, validationError, onOpenDatePicker }) => {
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


const ThumbnailList = React.memo(({ thumbnails, onSelectThumbnail, selectedUri }) => (
    <View style={{ marginTop: 20, marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>최근 합성 이미지 ({thumbnails.length}개)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {thumbnails.map((item, idx) => (
                <TouchableOpacity
                    key={idx}
                    onPress={() => onSelectThumbnail(item)}
                    style={{ marginRight: 12 }}
                >
                    <Image
                        source={{ uri: item.uri }}
                        style={{ 
                            width: 120, 
                            height: 90, 
                            borderRadius: 8, 
                            borderWidth: 3, 
                            borderColor: selectedUri === item.uri ? '#2563eb' : '#d1d5db' 
                        }}
                    />
                    <Text style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 10, backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', paddingHorizontal: 4, borderRadius: 2 }}>
                        {item.snapshot['일자'] ? item.snapshot['일자'].substring(5) : '기록됨'}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    </View>
));


/* ---------------------------
  메인 컴포넌트: UploadEachScreen
---------------------------*/

const UploadEachScreen = ({ navigation, route }) => {
    const sharedLogic = useSharedUploadLogic(navigation, route, 'single'); 

    // 상태 관리
    const [images, setImages] = useState([]); // 현재 작업 이미지 (1장)
    const [selectedImageIndex, setSelectedImageIndex] = useState(null); 
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const canvasRef = useRef(null);
    const [uploadedThumbnails, setUploadedThumbnails] = useState([]); // 업로드 기록 썸네일
    const [canvasImageUri, setCanvasImageUri] = useState(null); // 캔버스에 표시할 이미지 URI (원본 또는 썸네일)

    const selectedImage = selectedImageIndex !== null ? images[selectedImageIndex] : null;
    const currentRotation = selectedImage?.rotation || 0;

    const { user, forms, selectedForm, formData, validateForm, updateField, onDateChange, setDatePickerField, validationErrors, handleSelectForm } = sharedLogic;
    const {
        CANVAS_WIDTH: C_W = 0,
        CANVAS_HEIGHT: C_H = 0,
        entries = [],
        tableConfig = {}
    } = sharedLogic;

    // 🚀 모드 설정
    useFocusEffect(
        React.useCallback(() => {
            const saveModeAndCheckNavigation = async () => {
                await AsyncStorage.setItem('uploadMode', 'single'); 
            };
            saveModeAndCheckNavigation();
        }, [])
    );
    
    // 💡 썸네일 선택 처리 함수: 캔버스 이미지와 폼 데이터 모두 변경
    const onSelectThumbnail = useCallback((item) => {
        setCanvasImageUri(item.uri);
        
        if (item.snapshot) {
            sharedLogic.setFormData(item.snapshot);
        }
        
        // 원본 이미지 정보는 삭제 (썸네일이므로 원본 편집 불가)
        setImages([]);
        setSelectedImageIndex(null);
    }, [sharedLogic.setFormData]); 

    // 🟢 [수정] 적용 버튼 로직: 저장 후 업로드 (자동 및 수동 실행의 목표 함수)
    const handleApplyAndUpload = async (imageAsset) => {
      // 캔버스에 원본 이미지가 없으면 (단일 이미지 처리이므로)
          if (!imageAsset) { 
              Alert.alert('오류', '처리할 이미지 정보가 없습니다.');
              return;
          }
          // ... (이하 로직은 imageAsset을 사용하여 selectedImage 대신 처리)
          // ...
          // 💡 [중요] validateForm() 호출은 현재 전역 formData에 대해 수행해야 함
          const valid = await validateForm();
          if (!valid) {
              Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
              return;
          }
        
        try {
            // 💡 자동 실행의 핵심: 저장 -> 업로드
            await saveToPhone(); 
            await handleUpload();
        } catch (e) {
            console.error('Apply sequence failed', e);
        }
    };
    
    // [NEW] 양식 선택 및 이미지 초기화 통합 함수
    const handleFormSelectionAndReset = useCallback((form) => {
        setImages([]);
        setSelectedImageIndex(null);
        setCanvasImageUri(null);
        handleSelectForm(form); 
        // 🚨 [수정] 양식 변경 시 기존 썸네일 리스트도 비움 (요구사항)
        setUploadedThumbnails([]); 
    }, [setImages, setSelectedImageIndex, handleSelectForm, setUploadedThumbnails]);
    
    // handleImagePickerResponse: 이미지 선택 완료 후 로직 (자동 실행 연결)
const handleImagePickerResponse = useCallback((response) => {
    if (!response.didCancel && !response.errorCode && response.assets?.[0]) {
        const asset = response.assets[0];
        const newImage = { ...asset, rotation: 0 };
        
        // 1. 상태를 설정 (비동기)
        setImages([newImage]);
        setSelectedImageIndex(0);
        setCanvasImageUri(newImage.uri); 
        
        // 2. 💡 [수정] 상태가 아닌, 생성된 이미지 객체를 직접 넘겨서 바로 실행
        setTimeout(() => handleApplyAndUpload(newImage), 100); 
    }
}, [handleApplyAndUpload]); // handleApplyAndUpload 의존성 추가


    const takePicture = useCallback(async () => {
        const valid = await validateForm();
        if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
        launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: false, selectionLimit: 1 }, handleImagePickerResponse);
    }, [validateForm, handleImagePickerResponse]);

    const pickImage = useCallback(async () => {
        const valid = await validateForm();
        if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
        launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 }, handleImagePickerResponse);
    }, [validateForm, handleImagePickerResponse]);

    // 회전 로직
    const rotateImage = useCallback(() => {
        if (selectedImageIndex === null) return;

        setImages(prevImages => {
            const newImages = [...prevImages];
            const currentImage = newImages[selectedImageIndex];
            const newRotation = (currentImage.rotation || 0) + 90;
            currentImage.rotation = newRotation % 360;
            return newImages;
        });
    }, [selectedImageIndex]);


    // 🟢 saveToPhone: 캔버스 캡처본을 휴대폰에 저장
    const saveToPhone = async () => {
        if (!selectedImage) return;
        if (!canvasRef.current) throw new Error('캔버스 참조를 찾을 수 없습니다.');

        setSaving(true);
        try {
            await new Promise(r => setTimeout(r, 120)); 
            const compositeUri = await canvasRef.current.capture(); 
            
            const fileName = `합성이미지_1_${Date.now()}.jpg`;
            const destDir = Platform.OS === 'android' ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera` : RNFS.PicturesDirectoryPath;
            const destPath = `${destDir}/${fileName}`;

            const dirExists = await RNFS.exists(destDir);
            if (!dirExists) { await RNFS.mkdir(destDir); }
            await RNFS.copyFile(compositeUri, destPath);
            if (Platform.OS === 'android' && RNFS.scanFile) { try { await RNFS.scanFile(destPath); } catch (e) { /* ignore */ } }
        } catch (err) {
            console.error('Save error:', err);
            Alert.alert('오류', '이미지 저장에 실패했습니다\n' + (err.message || err));
            throw err; // 저장 실패 시 업로드 중단
        } finally {
            setSaving(false);
        }
    };


    // 🟢 handleUpload: 전송 속도 개선 및 데이터 전송 로직 (단일 이미지, 서버에 DB 기록 요청)
    const handleUpload = async () => {
        if (!selectedForm || !selectedImage) return; 

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

            // 1. 캔버스 캡처
            if (!canvasRef.current) throw new Error('캔버스 참조를 찾을 수 없습니다');
            const compositeUri = await canvasRef.current.capture();

            // 2. ⚡ [속도 개선] 업로드할 이미지 파일 자체를 리사이징 (전송량 최소화)
            const resizedComposite = await ImageResizer.createResizedImage(
                compositeUri, 1024, 1024 * (C_H / C_W), 'JPEG', 70
            );
            const finalCompositeUri = resizedComposite.uri;

            // 3. Base64 이미지 로드 및 썸네일 생성
            const finalBase64Image = await RNFS.readFile(finalCompositeUri, 'base64');
  // 4. 썸네일 생성 (서버 전송 직전)
        const thumb = await ImageResizer.createResizedImage(finalCompositeUri, 200, 150, 'JPEG', 80);
        const thumbBase64 = await RNFS.readFile(thumb.uri, 'base64');
        const thumbnailBase64 = `data:image/jpeg;base64,${thumbBase64}`;

        // 5. 🟢 [핵심 수정] 썸네일 생성 완료 후, 서버 응답을 기다리기 전에 클라이언트 상태 업데이트
        setUploadedThumbnails(prev => {
            const newThumbnails = [{
                uri: thumbnailBase64,
                snapshot: {...formData} 
            }, ...prev];
            return newThumbnails.slice(0, 20);
        });
            // 4. 단일 이미지 업로드 페이로드 구성
            const filename = `${selectedForm.formName}_${Date.now()}.jpg`;
            const uploadData = {
                filename: filename,
                base64Image: `data:image/jpeg;base64,${finalBase64Image}`,
                thumbnail: thumbnailBase64,
                imageCount: 1, 
                fieldData: formData, // 현재 전역 formData
            };

            // 5. 서버에 전송 (DB 기록 포함)
            const finalUploadPayload = {
                formId: selectedForm._id,
                formName: selectedForm.formName,
                totalImageCount: 1, 
                representativeData: formData, // 대표 데이터는 현재 폼 데이터
                images: [uploadData], // 단일 이미지 배열로 전송
            };

            const resp = await fetch(API.uploadPhoto, { 
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${userObj.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(finalUploadPayload),
            });

            const data = await resp.json();
            
            // 6. 응답 처리
           if (data?.success) {
            Alert.alert('성공', `이미지가 성공적으로 전송 및 기록되었습니다.`);
            // (썸네일이 이미 업데이트되었으므로 추가 업데이트 로직은 필요 없습니다.)
        } else {
            console.error('Upload failed:', data);
            Alert.alert('업로드 실패', data?.error || '서버 응답 오류 (DB 기록 포함 실패)');
            // 🚨 서버 실패 시 클라이언트에서 추가한 썸네일 제거 로직 추가 가능
        }
        } catch (err) {
            console.error('Upload error:', err);
            Alert.alert('오류', '업로드 중 오류가 발생했습니다\n' + (err.message || err));
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleKakaoShare = async () => { /* ... */ };


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
                {/* 1. 양식 선택 */}
                <Text style={styles.sectionTitle}>입력 양식 선택</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ minHeight: 56, maxHeight: 72 }}>
                    {forms.map(form => (
                        <TouchableOpacity
                            key={form._id}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 18, marginRight: 10, borderWidth: 1, borderColor: selectedForm?._id === form._id ? '#2563eb' : '#d1d5db', borderRadius: 16, backgroundColor: selectedForm?._id === form._id ? '#e0e7ff' : '#fff', elevation: selectedForm?._id === form._id ? 2 : 0 }}
                            onPress={() => handleFormSelectionAndReset(form)}
                        >
                            <Text style={{ fontSize: 15, color: selectedForm?._id === form._id ? '#2563eb' : '#222', fontWeight: 'bold' }}>{form.formName}</Text>
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
                        
                        {/* 3. 액션 버튼들 */}
                        <View>
                            <View style={styles.compactButtonRow}>
                                <TouchableOpacity style={styles.compactButton} onPress={takePicture} disabled={uploading || saving}>
                                    <Text style={styles.compactButtonText}>📷</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.compactButton} onPress={pickImage} disabled={uploading || saving}>
                                    <Text style={styles.compactButtonText}>🖼️</Text>
                                </TouchableOpacity>
                                                       
                                <TouchableOpacity
                                    style={[styles.compactButton, styles.kakaoBtn, !selectedImage && styles.buttonDisabled]}
                                    onPress={handleKakaoShare}
                                    disabled={!selectedImage || uploading || saving}
                                >
                                    <Text style={styles.compactButtonText}>공유</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        
                        {/* 4. 미리보기(캔버스 + 표 오버레이) + 회전 버튼 */}
                       {selectedImage || canvasImageUri ? (
  <View style={{ position: 'relative', width: C_W + 4, height: C_H + 4, alignItems: 'center', justifyContent: 'center' }}>
    <ImageComposer
      ref={canvasRef}
      // 💡 selectedImage가 있으면 원본(images) 사용, 없으면 썸네일 URI 사용
      selectedImage={selectedImage || { uri: canvasImageUri, rotation: 0, width: C_W, height: C_H }}
      rotation={currentRotation}
      canvasDims={{ width: C_W, height: C_H }}
      tableEntries={entries}
      tableConfig={tableConfig}
      formData={formData}
    />
                                {/* 🔄 회전 버튼 */}
                                <TouchableOpacity
                                    style={{ position: 'absolute', top: 12, right: 60, backgroundColor: '#2563eb', borderRadius: 20, padding: 10, elevation: 3 }}
                                    onPress={rotateImage}
                                    disabled={uploading || saving || !selectedImage}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>⟳</Text>
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
                  onPress={handleApplyAndUpload}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20 }}>✔</Text>
                </TouchableOpacity>
                            </View>
                        ): null}

                        {/* 5. 썸네일 리스트 */}
                        {uploadedThumbnails.length > 0 && (
                            <ThumbnailList 
                                thumbnails={uploadedThumbnails} 
                                onSelectThumbnail={onSelectThumbnail} 
                                selectedUri={canvasImageUri}
                            />
                        )}
                    </View>
                )}
            </ScrollView>

            {/* 업로드 진행 UI */}
            <View style={{ width: '100%', padding: 12, marginTop: 24, alignItems: 'center' }}>
                {uploading && (
                    <View style={{ width: '100%', padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, color: '#111827', marginBottom: 4 }}>
                            {uploadProgress}% 전송 중... (속도 개선 적용됨)
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