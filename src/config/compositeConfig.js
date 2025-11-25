export const canvasConfig = {
  width: 1024,
  height: 768,       // 원본 비율 유지
  imageFit: "cover", 
  table: {
    widthRatio: 0.23,  // 캔버스 너비의 20%
    heightRatio: 0.25,
    backgroundColor: "#fff",
    borderColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    font: "20px 'Malgun Gothic'",
    textColor: "#000",
    col1Ratio: 0.15,
    cellPaddingX: 2,   // 좌우 패딩 4px로 축소
    cellPaddingY: 0   // 상하 패딩 0px
  }
};