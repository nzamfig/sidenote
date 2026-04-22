# SideNote

A quick notes space for capturing ideas while browsing the web.
https://nzamfig.github.io/sidenote/

## Features

- **Create/Delete memos** — double-click (or double-tap on mobile) on the canvas to create a memo, delete with the ✕ button in the toolbar
- **Drag to move** — drag the top toolbar to reposition a memo
- **Resize** — drag the bottom-right handle to resize; memo auto-expands when an image or map is inserted
- **Color picker** — choose from 6 background colors via the toolbar swatches
- **Insert images** — insert local images at the cursor position, resize by dragging, align left/center/right
- **Insert maps** — insert a Leaflet/OpenStreetMap map, add/remove markers
- **Canvas size** — set the memo workspace size via the button at the top center
- **Export/Import** — back up all memos to a JSON file or restore from one
- **Auto-save** — all changes are automatically saved to localStorage and flushed immediately on page hide (safe on mobile)
- **Install as app** — installable as a PWA via the Install button (shown when supported by the browser)

## Tech Stack

| Role | Library |
|------|---------|
| UI | React 18 + TypeScript |
| State | Zustand v5 |
| Drag & Drop | @dnd-kit/core |
| Maps | Leaflet / OpenStreetMap |
| PWA | vite-plugin-pwa |
| Build | Vite |
| Tests | Vitest + @testing-library/react |

## Getting Started

```bash
npm install
npm run dev      # dev server (http://localhost:5173)
npm run build    # production build
npm run test     # run tests
npm run lint     # ESLint check
```

## Usage

| Action | How |
|--------|-----|
| Add memo | Double-click (or double-tap) on the canvas |
| Move memo | Drag the top toolbar |
| Delete memo | Toolbar ✕ button |
| Resize | Drag the bottom-right handle |
| Add image | Memo bottom image button → select file |
| Add map | Memo bottom map button |
| Change canvas size | Click the size indicator at the top center |
| Export memos | Top-right Export button → downloads JSON |
| Import memos | Top-right Import button → select JSON file |
| Install as app | Top-right Install button (browser must support PWA) |
