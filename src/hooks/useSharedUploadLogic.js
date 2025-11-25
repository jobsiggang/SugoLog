// src/hooks/useSharedUploadLogic.js

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, Dimensions, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 경로는 사용자 프로젝트 구조에 맞게 조정하세요.
import { canvasConfig } from '../config/compositeConfig'; 
import API from '../config/api'; 


const { width: screenWidth } = Dimensions.get('window');

// 캔버스 크기 계산 유틸리티
function getCanvasDims() {
  const baseWidth = Math.floor(screenWidth * 0.7);
  const baseHeight = Math.floor((baseWidth * canvasConfig.height) / canvasConfig.width);
  return { width: baseWidth, height: baseHeight };
}
const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = getCanvasDims();
const cellPaddingX = canvasConfig.table.cellPaddingX;
const cellPaddingY = canvasConfig.table.cellPaddingY;


export const useSharedUploadLogic = (navigation, route, mode = 'single') => {
  const [user, setUser] = useState(null);
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const [datePickerField, setDatePickerField] = useState(null);

  useEffect(() => {
    loadUser();
    fetchForms();
    requestCameraPermission();
    restoreUploadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 유틸리티 및 초기화 ---

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          // 최신 안드로이드 권한 포함
          Platform.Version >= 33 
            ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
            : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, 
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);
      } catch (err) {
        console.warn('Permission error:', err);
      }
    }
  };

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  };

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('user');
      const userObj = userData ? JSON.parse(userData) : null;
      if (!userObj?.token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }
      const res = await fetch(API.forms, {
        headers: { Authorization: `Bearer ${userObj.token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setForms((data.forms || []).filter(f => f.isActive !== false).map(f => ({
          ...f,
          fields: Array.isArray(f.fields) ? f.fields : [],
          fieldOptions: f.fieldOptions || {},
        })));
      } else {
        Alert.alert('오류', data.error || '양식 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Fetch forms error:', err);
      Alert.alert('오류', '양식 목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  const restoreUploadState = async () => {
    const storedMode = await AsyncStorage.getItem('uploadMode');
    if (storedMode && storedMode !== mode) {
      // 모드 불일치 시 네비게이션 처리 (필요하다면 상위 컴포넌트에서 처리)
      return;
    }
    
    if (route?.params?.restoreForm) {
      const prevForm = await AsyncStorage.getItem('prevUploadForm');
      const prevFormData = await AsyncStorage.getItem('prevUploadFormData');
      if (prevForm) setSelectedForm(JSON.parse(prevForm));
      if (prevFormData) setFormData(JSON.parse(prevFormData));
    }
  };

  // --- 폼/데이터 처리 ---

  const handleSelectForm = useCallback(async (form) => {
    setSelectedForm(form);
    const initialData = {};
    const today = new Date().toISOString().split('T')[0];
    (Array.isArray(form.fields) ? form.fields : []).forEach(field => {
      const lower = String(field).toLowerCase();
      if (lower.includes('일자') || lower.includes('날짜') || lower.includes('공사일') || lower.includes('date')) {
        initialData[field] = today;
      } else {
        initialData[field] = '';
      }
    });
    setFormData(initialData);
    setValidationErrors({});
    
    await AsyncStorage.setItem('uploadMode', mode);
    await AsyncStorage.setItem('prevUploadForm', JSON.stringify(form));
    await AsyncStorage.setItem('prevUploadFormData', JSON.stringify(initialData));
  }, [mode]);

  const validateForm = useCallback(async () => {
    if (!selectedForm) return false;
    const errors = {};
    selectedForm.fields.forEach(field => {
      if (!formData[field] || String(formData[field]).trim() === '') errors[field] = true;
    });
    setValidationErrors(errors);
    
    await AsyncStorage.setItem('prevUploadForm', JSON.stringify(selectedForm));
    await AsyncStorage.setItem('prevUploadFormData', JSON.stringify(formData));
    return Object.keys(errors).length === 0;
  }, [selectedForm, formData]);

  const updateField = useCallback((field, value) => {
    let newVal = value;
    if (/^\d{1,3}-\d{1,4}$/.test(value) && (field.includes('위치') || field.includes('호') || field.includes('동'))) {
      const [dong, ho] = value.split('-');
      newVal = `${dong}동-${ho}호`;
    }
    setFormData(prev => ({ ...prev, [field]: newVal }));
    setValidationErrors(prev => ({ ...prev, [field]: false }));
  }, []);

  const onDateChange = useCallback((event, date) => {
    if (!date) {
      setDatePickerField(null);
      return;
    }
    const iso = date.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, [datePickerField]: iso }));
    setValidationErrors(prev => ({ ...prev, [datePickerField]: false }));
    setDatePickerField(null);
  }, [datePickerField]);

  // --- 테이블 계산 (useMemo를 사용하여 성능 최적화) ---
  
  const { entries, tableConfig } = useMemo(() => {
    const entries = (selectedForm?.fields || []).map(field => ({ field }));
    
    // fontPx 추출 및 fontSize 계산 (캔버스 비율에 맞춤)
    const fontPx = parseInt(((canvasConfig.table.font || '').match(/(\d+)px/) || [])[1] || '16', 10);
    const fontSize = Math.max(10, Math.floor(CANVAS_WIDTH * fontPx / canvasConfig.width));
    
    // 최소 너비 및 텍스트 너비 계산
    const minCol1Width = fontSize * 6 * 1.1;
    const minCol2Width = fontSize * 9 * 1.1;
    let col1Width = CANVAS_WIDTH * canvasConfig.table.col1Ratio * (2 / 3);
    let col1TextMax = Math.max(...entries.map(e => (e.field.length * fontSize * 0.6)), 0);
    let col2TextMax = Math.max(...entries.map(e => ((formData[e.field] || '').length * fontSize * 0.6)), 0);
    
    let col1FinalWidth = Math.max(col1Width, minCol1Width, col1TextMax + cellPaddingX * 2 + 12);
    let col2FinalWidth = Math.max(minCol2Width, col2TextMax + cellPaddingX * 2 + 12);
    
    let MIN_TABLE_WIDTH = CANVAS_WIDTH * canvasConfig.table.widthRatio;
    let tableWidth = Math.max(MIN_TABLE_WIDTH, col1FinalWidth + col2FinalWidth);
    let MAX_TABLE_WIDTH = CANVAS_WIDTH * 0.95;
    
    if (tableWidth > MAX_TABLE_WIDTH) {
      tableWidth = MAX_TABLE_WIDTH;
      col1FinalWidth = Math.max(col1Width, minCol1Width);
      col2FinalWidth = tableWidth - col1FinalWidth;
    }

    // 높이 계산 (테두리 포함 문제 해결)
    const rowHeight = fontSize * 2.0;
    const borderWidth = canvasConfig.table.borderWidth || 1;
    // 행 구분선 두께를 포함하여 최종 표 높이 계산
    const innerBorderAdjustment = (entries.length > 0 ? entries.length - 1 : 0) * borderWidth; 
    const tableHeight = (entries.length * rowHeight) ;
    // const tableHeight = (entries.length * rowHeight) + innerBorderAdjustment + (borderWidth * 2);

    const tableConfig = {
      col1FinalWidth, col2FinalWidth, tableWidth, tableHeight, cellPaddingX, cellPaddingY,
      fontSize, rowHeight, // ImageComposer에서 사용할 행 높이
      backgroundColor: canvasConfig.table.backgroundColor,
      borderColor: canvasConfig.table.borderColor,
      borderWidth: canvasConfig.table.borderWidth,
      textColor: canvasConfig.table.textColor,
    };

    return { entries, tableConfig };
  }, [selectedForm, formData]);

  return {
    // 상태
    user, forms, selectedForm, formData, loading, validationErrors, datePickerField, 
    // 이미지 관련 상태 (UploadEachScreen에서 필요)
    images: [], setImages: () => {}, 
    selectedImageIndex: null, setSelectedImageIndex: () => {},
    uploadedThumbnails: [], setUploadedThumbnails: () => {},
    rotation: 0, setRotation: () => {},
    uploading: false, setUploading: () => {},
    uploadProgress: 0, setUploadProgress: () => {},
    saving: false, setSaving: () => {},
    canvasRef: null,
    
    // 유틸리티/계산 값
    CANVAS_WIDTH, CANVAS_HEIGHT, entries, tableConfig,
    
    // 핸들러
    handleSelectForm, validateForm, updateField, onDateChange, setDatePickerField,
  };
};