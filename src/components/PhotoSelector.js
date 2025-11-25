// PhotoSelector.js
// 사진 선택, 썸네일, 회전, 삭제 등 UI/로직 컴포넌트
import React from 'react';
import { View, ScrollView, TouchableOpacity, Image, Text, StyleSheet } from 'react-native';

const THUMB_SIZE = 80;

export default function PhotoSelector({ images, selectedIndex, onSelect, onRemove, onRotate }) {
  return (
    <ScrollView horizontal style={styles.thumbnailScroll} showsHorizontalScrollIndicator={false}>
      {images.map((img, index) => (
        <View key={index} style={{ position: 'relative' }}>
          <TouchableOpacity
            onPress={() => onSelect(index)}
            style={[styles.thumbnail, selectedIndex === index && styles.thumbnailSelected]}
          >
            <Image source={{ uri: img.uri }} style={styles.thumbnailImage} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.thumbnailRemove} onPress={() => onRemove(index)}>
            <Text style={styles.thumbnailRemoveText}>✕</Text>
          </TouchableOpacity>
          {onRotate && (
            <TouchableOpacity style={styles.rotateBtn} onPress={() => onRotate(index)}>
              <Text style={styles.rotateBtnText}>⟳</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  rotateBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  rotateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
