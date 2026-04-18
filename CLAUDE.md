# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # 개발 서버 (http://localhost:5173)
npm run build        # 타입 검사 + 프로덕션 빌드 (tsc -b && vite build)
npm run lint         # ESLint 검사
npm run test         # 테스트 1회 실행 (vitest run)
npm run test:watch   # 테스트 watch 모드

# 특정 테스트 파일만 실행
npx vitest run src/test/usePersistence.test.ts
```

## Architecture

### 상태 관리 (Zustand)

스토어가 두 개로 분리된다:

- **`src/store/useMemoStore.ts`** — 메모 CRUD 및 선택 상태. 모든 액션은 스토어 내부에 정의되어 있으며 컴포넌트는 직접 상태를 변경하지 않는다. z-index는 숫자 대신 `memos` 배열 순서로 표현한다(마지막 원소 = 최상위).
- **`src/store/useCanvasStore.ts`** — 캔버스 영역 크기(width×height). localStorage `'canvas-size'` 키에 즉시 저장된다.

### 데이터 흐름

```
localStorage ──(마운트 시 한 번)──► usePersistence ──► useMemoStore
                                         │
useMemoStore 변경 ──(300ms debounce)────► localStorage
```

`usePersistence` 훅은 App 최상위에서 한 번만 호출한다. 저장은 React 렌더 사이클 밖의 `useMemoStore.subscribe()`로 처리하므로 렌더 성능에 영향을 주지 않는다.

### 컴포넌트 구조

```
App
├── Canvas              ← DndContext 제공, 더블클릭 메모 생성
│   └── Memo[]          ← React.memo로 래핑, 드래그/리사이즈/선택
│       ├── MemoToolbar ← 드래그 핸들 겸 색상·삭제 UI
│       └── MemoContent ← contenteditable 편집기 (이미지·지도 혼합)
├── CanvasSizePanel     ← 화면 상단 중앙 고정, 캔버스 크기 설정
└── appLabel            ← 화면 좌측 상단 고정, 앱 식별 레이블
```

### MemoContent 비제어 패턴

`MemoContent`는 비제어(uncontrolled) 컴포넌트다. `innerHTML`은 마운트 시 한 번만 설정하고, 이후에는 `onBlur` 시점에만 `onChange`를 호출한다. React state로 관리하면 커서 위치가 초기화되는 문제를 피하기 위함이다.

지도 저장 전략: Leaflet이 생성한 DOM은 저장하지 않고, `data-map / data-lat / data-lng / data-zoom / data-markers` 속성만 직렬화한다. 로드 시 `[data-map]` 요소를 찾아 Leaflet을 재초기화한다.

### 주요 설계 결정

- **`memo` 이름 충돌**: `React.memo`를 `reactMemo`로 import해 `memo` prop과 충돌을 피한다.
- **이미지·마커 아이콘 오버플로 방지**: 정렬 툴바와 마커 액션 바는 기본적으로 요소 아래에 표시하되, 메모 하단 경계를 벗어나면 위로 플립된다. `wrapper.closest('[data-memo-id]')`로 메모 경계를 계산한다.
- **Zustand v5 subscribe**: v5에서 `subscribe(selector, callback)` 형태가 제거됐다. `subscribe(listener)`에서 이전 참조를 직접 비교해 변경 감지한다.
- **CSS 상수 동기화**: `src/constants.ts`의 `MEMO_UI`·`MEMO_CONSTRAINTS` 값은 CSS와 동기화가 필요하다. 수치를 변경할 때 두 곳을 함께 수정해야 한다.

### 테스트 환경

- jsdom은 `PointerEvent`와 `setPointerCapture`를 지원하지 않으므로 `src/test/setup.ts`에서 폴리필을 제공한다.
- Zustand 스토어는 각 테스트 `beforeEach`에서 `useMemoStore.setState({ memos: [], activeMemoId: null })`로 리셋한다.
- `usePersistence` 테스트는 `vi.useFakeTimers()`로 300ms 디바운스를 제어한다.
