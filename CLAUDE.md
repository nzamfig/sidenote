# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server (http://localhost:5173)
npm run build        # type check + production build (tsc -b && vite build)
npm run lint         # ESLint check
npm run test         # run tests once (vitest run)
npm run test:watch   # test watch mode

# run a specific test file
npx vitest run src/test/usePersistence.test.ts
```

## Architecture

### State Management (Zustand)

Two separate stores:

- **`src/store/useMemoStore.ts`** — Memo CRUD and selection state. All actions are defined inside the store; components never mutate state directly. z-index is expressed as the order of the `memos` array rather than a numeric value (last element = topmost).
- **`src/store/useCanvasStore.ts`** — Canvas area size (width×height). Persisted immediately to localStorage under the key `'canvas-size'`.

### Data Flow

```
localStorage ──(once on mount)──► usePersistence ──► useMemoStore
                                         │
useMemoStore changes ──(300ms debounce)────► localStorage
```

The `usePersistence` hook is called once at the App root. Saving is handled via `useMemoStore.subscribe()` outside the React render cycle, so it does not affect render performance.

### Component Structure

```
App
├── Canvas              ← provides DndContext, creates memo on double-click
│   └── Memo[]          ← wrapped with React.memo, drag/resize/select
│       ├── MemoToolbar ← drag handle + color/delete UI
│       └── MemoContent ← contenteditable editor (mixed images & maps)
├── CanvasSizePanel     ← fixed at top center, sets canvas size
└── appLabel            ← fixed at top left, app identity label
```

### MemoContent Uncontrolled Pattern

`MemoContent` is an uncontrolled component. `innerHTML` is set only once on mount; `onChange` is called only on `onBlur`. This avoids the cursor position reset that would occur if managed with React state.

Map persistence strategy: the Leaflet-generated DOM is not saved — only the `data-map / data-lat / data-lng / data-zoom / data-markers` attributes are serialized. On load, `[data-map]` elements are found and Leaflet is re-initialized.

### Key Design Decisions

- **`memo` name conflict**: `React.memo` is imported as `reactMemo` to avoid collision with the `memo` prop.
- **Image/marker icon overflow prevention**: The alignment toolbar and marker action bar are shown below the element by default, but flip upward if they would overflow the memo's bottom edge. Memo boundaries are calculated via `wrapper.closest('[data-memo-id]')`.
- **Zustand v5 subscribe**: The `subscribe(selector, callback)` form was removed in v5. Instead, `subscribe(listener)` is used with direct reference comparison to detect changes.
- **CSS constant sync**: Values in `src/constants.ts` (`MEMO_UI`, `MEMO_CONSTRAINTS`) must stay in sync with CSS. Both places must be updated when changing numeric values.

### Test Environment

- jsdom does not support `PointerEvent` or `setPointerCapture`, so polyfills are provided in `src/test/setup.ts`.
- The Zustand store is reset in each test's `beforeEach` via `useMemoStore.setState({ memos: [], activeMemoId: null })`.
- `usePersistence` tests use `vi.useFakeTimers()` to control the 300ms debounce.
