// UploadLogic.js
// 재사용 가능한 업로드/저장 로직 hook/component
import { useState, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import API from '../config/api';

export function useUploadLogic({ onUploadComplete, onProgress, navigation }) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const canvasRef = useRef(null);

  // 로컬 저장
  const saveToPhone = async ({ images, selectedForm, formData }) => {
    if (!selectedForm) return Alert.alert('오류', '양식을 선택해주세요');
    if (images.length === 0) return Alert.alert('오류', '사진을 추가해주세요');
    setSaving(true);
    try {
      for (let i = 0; i < images.length; i++) {
        if (canvasRef.current && canvasRef.current.capture) {
          const uri = await canvasRef.current.capture();
          const fileName = `합성이미지_${i + 1}_${Date.now()}.jpg`;
          const destDir = Platform.OS === 'android'
            ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera`
            : RNFS.PicturesDirectoryPath;
          const destPath = `${destDir}/${fileName}`;
          const dirExists = await RNFS.exists(destDir);
          if (!dirExists) await RNFS.mkdir(destDir);
          await RNFS.copyFile(uri, destPath);
          if (Platform.OS === 'android' && RNFS.scanFile) {
            try { await RNFS.scanFile(destPath); } catch (e) {}
          }
        }
      }
      Alert.alert('성공', '모든 합성 이미지가 저장되었습니다 (사진앨범)');
    } catch (err) {
      Alert.alert('오류', '이미지 저장에 실패했습니다\n' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // 업로드 (단일/배치)
  const uploadImages = async ({ images, selectedForm, formData, validateForm }) => {
    if (!selectedForm) return Alert.alert('오류', '양식을 선택해주세요');
    if (images.length === 0) return Alert.alert('오류', '사진을 추가해주세요');
    if (validateForm && !validateForm()) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
    setUploading(true);
    setUploadProgress(0);
    try {
      const userData = await AsyncStorage.getItem('user');
      const userObj = userData ? JSON.parse(userData) : null;
      if (!userObj?.token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        navigation && navigation.replace && navigation.replace('Login');
        return;
      }
      const uploadedItems = [];
      const imageUrls = [];
      const thumbnails = [];
      for (let i = 0; i < images.length; i++) {
        if (canvasRef.current && canvasRef.current.capture) {
          const compositeUri = await canvasRef.current.capture();
          const base64Image = await RNFS.readFile(compositeUri, 'base64');
          const fileNameParts = selectedForm.folderStructure || [];
          let fileName = fileNameParts.map(f => formData[f] || f).filter(Boolean).join('_');
          if (!fileName) fileName = `${selectedForm.formName}_${i + 1}`;
          fileName += `_${Date.now()}.jpg`;
          const thumb = await ImageResizer.createResizedImage(compositeUri, 200, 150, 'JPEG', 80);
          const thumbBase64 = await RNFS.readFile(thumb.uri, 'base64');
          thumbnails.push(`data:image/jpeg;base64,${thumbBase64}`);
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
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(uploadData),
          });
          const data = await resp.json();
          if (!data?.success) {
            Alert.alert('업로드 실패', data?.error || '서버 응답 오류');
          } else {
            uploadedItems.push({ filename: fileName, serverResponse: data });
            imageUrls.push(data.imageUrl || fileName);
          }
          setUploadProgress(Math.round(((i + 1) / images.length) * 100));
          onProgress && onProgress(Math.round(((i + 1) / images.length) * 100));
        }
      }
      // DB 기록
      if (uploadedItems.length > 0) {
        const dbPayload = {
          formName: selectedForm.formName,
          formId: selectedForm._id,
          data: formData,
          imageUrls,
          imageCount: images.length,
          thumbnails,
          uploadedItems,
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
          Alert.alert('성공', `${uploadedItems.length}개의 사진이 업로드되어 DB에 기록됨`);
          onUploadComplete && onUploadComplete();
        } else {
          Alert.alert('업로드 완료(일부)', `이미지는 업로드되었으나 DB 기록에 실패했습니다.`);
        }
      } else {
        Alert.alert('실패', '이미지 업로드에 실패했습니다.');
      }
    } catch (err) {
      Alert.alert('오류', '업로드 중 오류가 발생했습니다\n' + (err.message || err));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return {
    uploading,
    saving,
    uploadProgress,
    canvasRef,
    saveToPhone,
    uploadImages,
    setUploadProgress,
  };
}
