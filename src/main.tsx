/**
 * @file main.tsx
 * 앱의 진입점(entry point).
 *
 * React 18의 createRoot API로 루트 컴포넌트를 마운트한다.
 * StrictMode: 개발 모드에서만 컴포넌트를 의도적으로 이중 렌더링·Effect 이중 실행하여
 * 사이드 이펙트 의존성, 구식 API 사용 등의 잠재적 버그를 조기에 발견한다.
 * 프로덕션 빌드에서는 StrictMode가 동작에 영향을 주지 않는다.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
