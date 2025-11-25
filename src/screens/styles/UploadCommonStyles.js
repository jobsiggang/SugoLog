import { StyleSheet, Dimensions } from 'react-native';

const THUMB_SIZE = 90;

export default StyleSheet.create({
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
  buttonDisabled: {
    opacity: 0.5, // 투명도 낮춤
    backgroundColor: '#ccc', // 배경색 변경 (선택 사항)
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
    paddingVertical: 4,
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
