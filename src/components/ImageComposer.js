import React, { forwardRef } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';

const ImageComposer = forwardRef(({
  selectedImage,
  rotation,
  canvasDims,
  tableEntries,
  tableConfig,
  formData
}, ref) => {
  const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = canvasDims;
  const {
    // 상위 훅(useSharedUploadLogic)에서 계산되어 전달된 최종 너비/높이 사용
    col1FinalWidth,
    col2FinalWidth,
    tableWidth,
    tableHeight,
    cellPaddingX,
    cellPaddingY,
    fontSize,
    backgroundColor,
    borderColor,
    borderWidth,
    rowHeight, // 행 높이 고정값
    textColor,
  } = tableConfig;

  // 회전 시 width/height 스왑 및 중앙 정렬 로직
  const isRotated = rotation % 180 !== 0;
  const imgWidth = isRotated ? CANVAS_HEIGHT : CANVAS_WIDTH;
  const imgHeight = isRotated ? CANVAS_WIDTH : CANVAS_HEIGHT;
  const left = (CANVAS_WIDTH - imgWidth) / 2;
  const top = (CANVAS_HEIGHT - imgHeight) / 2;

  // 표 오버레이 시작 위치 (캔버스 좌측 하단)
  const tableLeft = 0 // 우측 정렬 시 필요
  const tableBottom = 0; // 하단 정렬

  return (
    <View style={[styles.containerOuter, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }]}>
      <ViewShot 
        ref={ref} 
        options={{ format: 'jpg', quality: 0.9 }} 
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      >
        {/* 1. 배경 이미지 */}
        <Image
          source={{ uri: selectedImage.uri }}
          style={{
            position: 'absolute',
            left,
            top,
            width: imgWidth,
            height: imgHeight,
            resizeMode: 'stretch',
            transform: [{ rotate: `${rotation}deg` }],
          }}
        />
        
        {/* 2. 표 오버레이 */}
        <View style={{
          position: 'absolute',
          left: tableLeft, // 우측 정렬
          bottom: tableBottom,
          width: tableWidth,
          height: tableHeight,
          backgroundColor,
          borderColor,
          borderWidth,
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {tableEntries.map((entry, index) => {
            const cellValue = (formData[entry.field] || '').trim();
            
            return (
              <View 
                key={index} 
                style={{
                  flexDirection: 'row',
                  // 마지막 행만 borderBottom을 제거하여 높이 균일화
                  borderBottomWidth: index < tableEntries.length - 1 ? 1 : 0, 
                  borderBottomColor: borderColor,
                  height: rowHeight, // 모든 행에 동일한 높이 적용
                }}
              >
                {/* 1열: 필드명 */}
                <Text
                  style={{
                    width: col1FinalWidth,
                    paddingHorizontal: cellPaddingX,
                    paddingVertical: cellPaddingY, // 기존 패딩 유지 (선택적)
                    fontSize,
                    color: textColor,
                    fontWeight: 'normal',
                    borderRightWidth: 1,
                    borderRightColor: borderColor,
                    textAlignVertical: 'center', // 수직 중앙 정렬
                    textAlign: 'left',
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >{entry.field}</Text>
                
                {/* 2열: 데이터 값 */}
                <Text
                  style={{
                    width: col2FinalWidth,
                    paddingHorizontal: cellPaddingX,
                    paddingVertical: cellPaddingY, // 기존 패딩 유지 (선택적)
                    fontSize,
                    color: textColor,
                    fontWeight: 'normal', // 값은 bold를 제거하여 시각적 구분
                    textAlignVertical: 'center', // 수직 중앙 정렬
                    textAlign: 'left',
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >{cellValue}</Text>
              </View>
            );
          })}
        </View>
      </ViewShot>
    </View>
  );
});

const styles = StyleSheet.create({
  // 이 컴포넌트는 오버레이를 담당하므로, 컨테이너 스타일을 정돈했습니다.
  // 상위 컴포넌트가 이미 경계와 마진을 처리해야 합니다.
  containerOuter: {
    // ViewShot이 캔버스 크기(CANVAS_WIDTH/HEIGHT)를 정확히 가져가도록 외부 View의 크기를 고정합니다.
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    // 캔버스 자체의 테두리나 배경색은 ViewShot 내부에 정의되어야 캡처됩니다.
  },
});

export default ImageComposer;