import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 모든 네트워크 인터페이스에서 접속 가능
    port: 5173,
    strictPort: false, // 포트가 사용 중이면 다른 포트 시도
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 코어
          'react-vendor': ['react', 'react-dom'],
          // Firebase 관련
          'firebase-vendor': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
          ],
          // UI 라이브러리
          'ui-vendor': [
            'lucide-react',
            'date-fns',
            're-resizable',
            'react-rnd',
          ],
          // 상태 관리
          'state-vendor': ['zustand'],
        },
      },
    },
  },
})
