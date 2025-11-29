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
import { useFocusEffect } from '@react-navigation/native';

// 공통 컴포넌트/훅 import
import ImageComposer from '../components/ImageComposer';
import { useSharedUploadLogic } from '../hooks/useSharedUploadLogic';
import API from '../config/api';
import { canvasConfig } from '../config/compositeConfig'; 
import styles from './styles/UploadCommonStyles.js'; // 실제 경로에 맞게 수정 필요


const { width: screenWidth } = Dimensions.get('window');

const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = {
    width: Math.floor(screenWidth * 0.7),
    height: Math.floor((Math.floor(screenWidth * 0.7) * canvasConfig.height) / canvasConfig.width)
};


/* ---------------------------
  내부 UI 컴포넌트 (FormField, ThumbnailList)
---------------------------*/

// FormField 컴포넌트 (변경 없음)
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


const ThumbnailList = React.memo(({ items, selectedItemId, onSelect, onRemove }) => (
    <ScrollView horizontal style={styles.thumbnailScroll} showsHorizontalScrollIndicator={false}>
        {items.map((item, index) => (
            <View key={item.id} style={{ position: 'relative' }}>
                <TouchableOpacity
                    onPress={() => onSelect(item.id)}
                    style={[styles.thumbnail, item.id === selectedItemId && styles.thumbnailSelected]}>
                    <Image 
                      source={{ uri: item.uri }}
                      style={styles.thumbnailImage} 
                    />
                    <Text style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 10, backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', paddingHorizontal: 4, borderRadius: 2 }}>
                        {item.formDataSnapshot?.['이름'] || '기록됨'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.thumbnailRemove} onPress={() => onRemove(item.id)}>
                    <Text style={styles.thumbnailRemoveText}>✕</Text>
                </TouchableOpacity>
            </View>
        ))}
    </ScrollView>
));

/* ---------------------------
  메인 컴포넌트: UploadMultiScreen
---------------------------*/

const UploadMultiScreen = ({ navigation, route }) => {
    // 1. 공통 훅 사용
    const sharedLogic = useSharedUploadLogic(navigation, route, 'batch'); 

    // 2. 이미지/업로드 관련 상태 (로컬 상태 유지)
    const [items, setItems] = useState([]); // { id, uri, rotation, formDataSnapshot } 배열
    const [selectedItemId, setSelectedItemId] = useState(null); 
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const canvasRef = useRef(null);
    
    // 계산된 상태
    const selectedItem = items.find(item => item.id === selectedItemId);
    const currentRotation = selectedItem?.rotation || 0; 
    

    const { 
        user, forms, selectedForm, formData, validateForm, 
        updateField, onDateChange, setDatePickerField, validationErrors, 
        setFormData, // 💡 setFormData 추가
        handleSelectForm 
    } = sharedLogic;
    const { 
        CANVAS_WIDTH: C_W = 0, 
        CANVAS_HEIGHT: C_H = 0, 
        entries = [], 
        tableConfig = {} 
    } = sharedLogic;
    
    // 🚀 모드 설정
    useFocusEffect(
        React.useCallback(() => {
            const saveMode = async () => {
                await AsyncStorage.setItem('uploadMode', 'batch');
            };
            saveMode();
        }, [])
    );
    
    // 💡 [핵심 - 자동 저장(Auto-Save) 로직]
    useEffect(() => {
        if (!selectedItemId) return;
        setItems(prevItems => prevItems.map(item => {
            if (item.id === selectedItemId) {
                return {
                    ...item,
                    formDataSnapshot: { ...formData }, // 현재 전역 formData 스냅샷 저장
                    rotation: currentRotation, 
                };
            }
            return item;
        }));
    }, [selectedItemId, formData, currentRotation]); 


    // 💡 썸네일 선택 처리 함수: 상태 기록 후, 선택된 아이템의 스냅샷을 전역 formData에 로드
    const onSelectItem = useCallback((itemId) => {
        if (selectedItemId === itemId) return; // 이미 선택됨

        // Auto-save가 이전에 선택된 항목의 상태를 기록합니다.

        // 새로 선택된 아이템의 상태를 로드
        const newItem = items.find(item => item.id === itemId);
        if (newItem) {
            setFormData(newItem.formDataSnapshot || {}); 
            setSelectedItemId(itemId);
        }
    }, [selectedItemId, items, setFormData]); 


    // --- 이미지 선택/촬영 로직 ---

    const handleImagePickerResponse = useCallback((response) => {
        if (!response.didCancel && !response.errorCode && response.assets) {
            const assetsWithSnapshot = (Array.isArray(response.assets) ? response.assets : [response.assets])
                .map(asset => ({ 
                    id: Date.now() + Math.random(), // 고유 ID 부여
                    uri: asset.uri,
                    rotation: 0,
                    width: asset.width,
                    height: asset.height,
                    formDataSnapshot: { ...formData }, // 현재 전역 formData 스냅샷을 초기값으로 사용
                }));
                
            setItems(prevItems => [...prevItems, ...assetsWithSnapshot]);
            
            // 이전에 선택된 항목은 Auto-Save(useEffect)가 처리합니다.
            setSelectedItemId(assetsWithSnapshot[0].id);
        }
    }, [formData, selectedItemId]);


    const takePicture = useCallback(async () => {
        const valid = await validateForm();
        if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요');
        launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: false, selectionLimit: 1 }, handleImagePickerResponse);
    }, [validateForm, handleImagePickerResponse]);

    const pickImage = useCallback(async () => {
        const valid = await validateForm();
        if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요');
        launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 10 }, handleImagePickerResponse);
    }, [validateForm, handleImagePickerResponse]);


    // 회전 로직 (선택된 아이템의 rotation 속성만 업데이트)
    const rotateImage = useCallback(() => {
        if (!selectedItemId) return;

        setItems(prevItems => prevItems.map(item => {
            if (item.id === selectedItemId) {
                const newRotation = (item.rotation || 0) + 90;
                return {
                    ...item,
                    rotation: newRotation % 360
                };
            }
            return item;
        }));
    }, [selectedItemId]);

    const removeImage = useCallback(id => {
        const newItems = items.filter(item => item.id !== id);
        setItems(newItems);
        
        if (selectedItemId === id) {
            setSelectedItemId(newItems.length > 0 ? newItems[0].id : null);
            if (newItems.length > 0) {
                setFormData(newItems[0].formDataSnapshot || {});
            }
        } else if (newItems.length > 0 && !newItems.find(item => item.id === selectedItemId)) {
            setSelectedItemId(newItems[0].id);
            setFormData(newItems[0].formDataSnapshot || {});
        }
    }, [items, selectedItemId, setFormData]);

    const handleFormSelectionAndReset = useCallback((form) => {
        setItems([]); 
        setSelectedItemId(null);
        setFormData({}); // 폼 데이터 초기화
        handleSelectForm(form); 
    }, [setItems, setSelectedItemId, setFormData, handleSelectForm]);


    // --- 저장 및 업로드 로직 (멀티스크린 고유) ---

    // 캡처본을 휴대폰에 저장 (재사용을 위해 분리)
    const saveCompositeToPhone = async (compositeUri, index) => {
        const fileName = `합성이미지_${index}_${Date.now()}.jpg`;
        const destDir = Platform.OS === 'android' ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera` : RNFS.PicturesDirectoryPath;
        const destPath = `${destDir}/${fileName}`;

        const dirExists = await RNFS.exists(destDir);
        if (!dirExists) { await RNFS.mkdir(destDir); }
        await RNFS.copyFile(compositeUri, destPath);
        if (Platform.OS === 'android' && RNFS.scanFile) { try { await RNFS.scanFile(destPath); } catch (e) { /* ignore */ } }
    };

    const handleUpload = async () => {
        if (!selectedForm) return Alert.alert('오류', '양식을 선택해주세요');
        if (items.length === 0) return Alert.alert('오류', '사진을 추가해주세요');
        if (!validateForm()) return Alert.alert('입력 오류', '현재 선택된 항목의 필수 항목을 입력해주세요');
        
        setUploading(true);
        setUploadProgress(0);

        const initialSelectedItemId = selectedItemId;
        const initialFormData = { ...formData };
        try {
            const userData = await AsyncStorage.getItem('user');
            const userObj = userData ? JSON.parse(userData) : null;
            if (!userObj?.token) {
                Alert.alert('오류', '로그인이 필요합니다.');
                navigation.replace('Login');
                return;
            }

            const uploadedPayloads = [];

            // 1. 이미지별 데이터 적용, 캡처, 리사이징 및 페이로드 구성 루프
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                setSelectedItemId(item.id);
                setFormData(item.formDataSnapshot);
                await new Promise(r => setTimeout(r, 150));
                if (!canvasRef.current) continue;
                const compositeUri = await canvasRef.current.capture();
                await saveCompositeToPhone(compositeUri, i + 1);
                const resizedComposite = await ImageResizer.createResizedImage(
                    compositeUri, 1024, 1024 * (C_H / C_W), 'JPEG', 70
                );
                const finalCompositeUri = resizedComposite.uri;
                const finalBase64Image = await RNFS.readFile(finalCompositeUri, 'base64');
                const thumb = await ImageResizer.createResizedImage(finalCompositeUri, 200, 150, 'JPEG', 80);
                const thumbBase64 = await RNFS.readFile(thumb.uri, 'base64');
                const thumbnailBase64 = `data:image/jpeg;base64,${thumbBase64}`;
                const uploadData = {
                    filename: `${selectedForm.formName}_${i + 1}_${Date.now()}.jpg`,
                    base64Image: `data:image/jpeg;base64,${finalBase64Image}`,
                    thumbnail: thumbnailBase64,
                    imageCount: 1,
                    fieldData: item.formDataSnapshot,
                };
                uploadedPayloads.push(uploadData);
                setUploadProgress(Math.round(((i + 1) / items.length) * 100));
            }
            const finalUploadPayload = {
                formId: selectedForm._id,
                formName: selectedForm.formName,
                totalImageCount: items.length,
                representativeData: items[0].formDataSnapshot,
                images: uploadedPayloads,
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
            if (data?.success) {
                Alert.alert('성공', `${items.length}개 이미지가 성공적으로 전송 및 기록되었습니다.`);
            } else {
                console.error('Batch upload failed:', data);
                Alert.alert('업로드 실패', data?.error || '서버 응답 오류 (DB 기록 포함 실패)');
            }
        } catch (err) {
            console.error('Upload error:', err);
            Alert.alert('오류', '업로드 중 오류가 발생했습니다\n' + (err.message || err));
        } finally {
            setUploading(false);
            setUploadProgress(0);
            if (initialSelectedItemId) {
                setSelectedItemId(initialSelectedItemId);
                setFormData(initialFormData);
            }
        }
    };

    const handleKakaoShare = async () => {
        if (!selectedItem) return;
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
                        
                        {/* 3. 액션 버튼들 */}
                        <View>
                            <View style={styles.compactButtonRow}>
                                <TouchableOpacity style={styles.compactButton} onPress={takePicture} disabled={uploading || saving}>
                                    <Text style={styles.compactButtonText}>📷</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.compactButton} onPress={pickImage} disabled={uploading || saving}>
                                    <Text style={styles.compactButtonText}>🖼️</Text>
                                </TouchableOpacity>
                                
                                {/* 🚨 [제거] 수동 기록 버튼: Auto-save 로직으로 대체되었으나, 명시적 기록 필요 시 복원 가능 */}
                                
                                {/* 업로드 버튼 */}
                                <TouchableOpacity
                                    style={[
                                        styles.compactButton, 
                                        styles.uploadBtn, 
                                        (items.length === 0 || uploading || saving) && styles.buttonDisabled 
                                    ]}
                                    onPress={handleUpload}
                                    disabled={items.length === 0 || uploading || saving}
                                >
                                    <Text style={styles.compactButtonText}>☁️ 전송 {items.length}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.compactButton, styles.kakaoBtn, !selectedItem && styles.buttonDisabled]}
                                    onPress={handleKakaoShare}
                                    disabled={!selectedItem || uploading || saving}
                                >
                                    <Text style={styles.compactButtonText}>공유</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        
                        {/* 4. 미리보기(캔버스 + 표 오버레이) + 회전 버튼 */}
                        {selectedItem && (
                            <View style={{ position: 'relative', width: C_W + 4, height: C_H + 4, alignItems: 'center', justifyContent: 'center' }}>
                                <ImageComposer
                                    ref={canvasRef}
                                    selectedImage={selectedItem}
                                    rotation={currentRotation}
                                    canvasDims={{ width: C_W, height: C_H }}
                                    tableEntries={entries}
                                    tableConfig={tableConfig}
                                    formData={formData} 
                                />
                                <TouchableOpacity
                                    style={{ position: 'absolute', top: 12, right: 12, backgroundColor: '#2563eb', borderRadius: 20, padding: 10, elevation: 3 }}
                                    onPress={rotateImage}
                                    disabled={uploading || saving}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>⟳</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* 5. 썸네일 리스트 */}
                        <View>
                            {items.length > 0 && (
                                <ThumbnailList
                                    items={items}
                                    selectedItemId={selectedItemId}
                                    onSelect={onSelectItem} 
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

export default UploadMultiScreen;