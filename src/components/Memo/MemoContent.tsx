/**
 * @file MemoContent.tsx
 * 메모 본문을 편집하는 contenteditable 컴포넌트.
 *
 * 주요 기능:
 * - 텍스트 + 이미지 + 지도 혼합 편집 (contenteditable div)
 * - insertImage: 커서 위치에 이미지 삽입 (useImperativeHandle 노출)
 * - insertMap: 커서 다음 줄에 Leaflet/OpenStreetMap 지도 삽입
 * - 이미지 정렬 툴바: img 호버 시 좌/중/우 정렬 버튼 표시
 * - 이미지 리사이즈 핸들: img 호버 시 우측 하단에 투명 핸들 표시, 드래그로 크기 조절
 * - 비제어 패턴: innerHTML을 마운트 시 한 번만 설정, onBlur 시 저장
 *
 * 지도 저장 전략:
 * - 지도 컨테이너에 data-map / data-lat / data-lng / data-zoom / data-markers 속성으로 상태 보존
 * - innerHTML 저장 전 Leaflet이 생성한 DOM과 액션 바를 제거하고 속성만 직렬화
 * - 로드 시 [data-map] 요소를 탐색해 Leaflet 재초기화 및 마커 복원
 *
 * 지도 DOM 구조:
 * <div data-map-wrapper>           ← contenteditable=false, position:relative
 *   <div data-map>                 ← Leaflet이 마운트되는 컨테이너
 *   <div data-map-action-bar>      ← 마커 추가/삭제 버튼 바 (position:absolute, 지도 하단 외부)
 */

import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MEMO_UI } from '../../constants';
import styles from './MemoContent.module.css';

export interface MemoContentHandle {
  insertImage: (src: string, maxWidth: number, maxHeight: number) => void;
  insertMap: () => void;
}

interface MemoContentProps {
  content: string;
  autoFocus?: boolean;
  onChange: (content: string) => void;
}

type AlignType = 'left' | 'center' | 'right';

interface ImgToolbarState {
  img: HTMLImageElement;
  top: number;
  left: number;
}

/**
 * 이미지 리사이즈 핸들의 위치 상태.
 * wrapperRef 기준 상대 좌표로 저장하며, 핸들 중심이 이미지 우측 하단 모서리에 오도록 계산된다.
 * (top = imgRect.bottom - wrapperRect.top - MEMO_UI.RESIZE_HANDLE_SIZE/2)
 */
interface ResizeHandleState {
  img: HTMLImageElement;
  top: number;
  left: number;
}

/**
 * 저장된 content 문자열을 innerHTML에 적합한 HTML로 변환한다.
 *
 * HTML 태그가 포함된 문자열(이미지·지도 삽입 후 저장된 값)은 그대로 반환한다.
 * 순수 텍스트(레거시 또는 빈 메모)는 특수문자를 이스케이프하고 줄바꿈을 <br>로 치환한다.
 * 이 함수 이후 반드시 sanitizeHTML을 거쳐야 XSS가 방지된다.
 */
function toHTML(content: string): string {
  if (/<[a-z][\s\S]*>/i.test(content)) return content;
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

/**
 * innerHTML 설정 전 위험한 요소와 이벤트 핸들러 속성을 제거한다.
 * XSS 방지: script/iframe 등 실행 가능 요소와 on* 속성을 화이트리스트 방식으로 차단한다.
 */
function sanitizeHTML(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
    });
    const href = el.getAttribute('href');
    if (href && /^javascript:/i.test(href.trim())) el.removeAttribute('href');
    const src = el.getAttribute('src');
    if (src && /^javascript:/i.test(src.trim())) el.removeAttribute('src');
  });
  return doc.body.innerHTML;
}

/**
 * innerHTML 저장 전, 지도 컨테이너 안의 Leaflet DOM을 제거하고 data 속성만 남긴다.
 * Leaflet 내부 DOM은 재초기화로 복원되므로 저장 불필요.
 */
function getCleanedHTML(div: HTMLDivElement): string {
  const clone = div.cloneNode(true) as HTMLDivElement;
  clone.querySelectorAll<HTMLDivElement>('[data-map="true"]').forEach((el) => {
    el.innerHTML = '';
  });
  clone.querySelectorAll<HTMLDivElement>('[data-map-action-bar]').forEach((el) => {
    el.remove();
  });
  return clone.innerHTML;
}

/** 스타일 객체를 요소의 style에 일괄 적용하는 헬퍼 */
function applyStyles(el: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(el.style, styles);
}

/**
 * Leaflet 지도를 container 위에 초기화한다.
 * - 줌 컨트롤: CSS hover로 표시/숨김 (.memo-map 클래스 사용)
 * - 액션 바: 지도 하단 외부에 마커 추가/삭제 버튼 표시 (wrapper hover 시)
 * - 삭제 모드: 삭제 버튼 클릭 시 마커가 ✕ 아이콘으로 전환, 클릭 시 삭제
 * - 마커 저장: data-markers(JSON)에 보존, 로드 시 복원
 */
function initLeafletMap(container: HTMLDivElement, onSave: () => void) {
  if ((container as any)._leaflet_id) return;

  // CSS hover 기반 줌 컨트롤 표시를 위한 클래스
  container.classList.add('memo-map');

  const lat = parseFloat(container.dataset.lat ?? '37.5665');
  const lng = parseFloat(container.dataset.lng ?? '126.9780');
  const zoom = parseInt(container.dataset.zoom ?? '11');

  // 버블링 단계에서만 차단: Leaflet 내부 자식 요소에 이벤트가 정상 전달됨
  container.addEventListener('mousedown', (e) => e.stopPropagation());
  container.addEventListener('pointerdown', (e) => e.stopPropagation());

  const map = L.map(container, { center: [lat, lng], zoom, scrollWheelZoom: true });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  // ─── 마커 목록 및 삭제 모드 ──────────────────────────────────────────
  const markerList: L.Marker[] = [];
  let deleteMode = false;

  const deletableIcon = L.divIcon({
    html: `<div style="position:relative;width:25px;height:41px;cursor:pointer;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#3388ff" stroke="white" stroke-width="1.5"/>
        <circle cx="12.5" cy="12.5" r="4" fill="white"/>
      </svg>
      <div style="position:absolute;top:-4px;right:-6px;width:13px;height:13px;background:rgba(239,68,68,0.95);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:8px;font-weight:bold;border:1.5px solid white;line-height:1;">✕</div>
    </div>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    className: '',
  });
  const defaultIcon = new L.Icon.Default();

  const saveMarkers = () => {
    container.dataset.markers = JSON.stringify(
      markerList.map((m) => ({ lat: m.getLatLng().lat, lng: m.getLatLng().lng }))
    );
    onSave();
  };

  const createMarker = (mLat: number, mLng: number): L.Marker => {
    const marker = L.marker([mLat, mLng]).addTo(map);
    marker.on('click', () => {
      if (!deleteMode) return;
      marker.remove();
      const idx = markerList.indexOf(marker);
      if (idx !== -1) markerList.splice(idx, 1);
      saveMarkers();
    });
    return marker;
  };

  // 저장된 마커 복원
  try {
    const saved = JSON.parse(container.dataset.markers || '[]') as { lat: number; lng: number }[];
    saved.forEach(({ lat: mLat, lng: mLng }) => markerList.push(createMarker(mLat, mLng)));
  } catch { /* 파싱 오류 무시 */ }

  // 지도 이동/줌 변경 시 data 속성 갱신
  map.on('moveend', () => {
    const c = map.getCenter();
    container.dataset.lat = c.lat.toFixed(6);
    container.dataset.lng = c.lng.toFixed(6);
    container.dataset.zoom = map.getZoom().toString();
    onSave();
  });

  (container as any)._leafletMap = map;
  requestAnimationFrame(() => map.invalidateSize());

  // ─── 래퍼 확인/생성 ──────────────────────────────────────────────────
  // 구형 저장 데이터(래퍼 없음)도 호환 처리
  let wrapper: HTMLDivElement;
  const parent = container.parentElement as HTMLDivElement;
  if (parent.hasAttribute('data-map-wrapper')) {
    wrapper = parent;
  } else {
    wrapper = document.createElement('div');
    wrapper.setAttribute('contenteditable', 'false');
    wrapper.setAttribute('data-map-wrapper', 'true');
    wrapper.style.cssText = 'margin: 4px 0; flex-shrink: 0; position: relative;';
    parent.insertBefore(wrapper, container);
    wrapper.appendChild(container);
  }

  // ─── 액션 바 (지도 하단 내부 오버레이) ──────────────────────────────────
  let formVisible = false;

  const actionBar = document.createElement('div');
  actionBar.setAttribute('data-map-action-bar', 'true');
  applyStyles(actionBar, {
    position: 'absolute', top: '100%', left: '0', right: '0',
    display: 'flex', gap: '3px', padding: '2px 0', justifyContent: 'center',
    opacity: '0', transition: 'opacity 0.15s', pointerEvents: 'none',
    zIndex: '10',
  });
  wrapper.appendChild(actionBar);

  const btnStyle: Partial<CSSStyleDeclaration> = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '20px', height: '20px',
    background: 'white', border: 'none', borderRadius: '50%',
    cursor: 'pointer', color: 'rgba(0,0,0,0.5)', padding: '0',
    transition: 'color 0.1s, box-shadow 0.1s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
  };

  // 마커 추가 버튼
  const markerAddBtn = document.createElement('button');
  markerAddBtn.title = '마커 추가';
  markerAddBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
  applyStyles(markerAddBtn, { ...btnStyle });
  actionBar.appendChild(markerAddBtn);

  // 마커 삭제 모드 버튼 (핀 + 우상단 X)
  const markerDeleteBtn = document.createElement('button');
  markerDeleteBtn.title = '마커 삭제';
  markerDeleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 26 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/><line x1="19" y1="1" x2="25" y2="7"/><line x1="25" y1="1" x2="19" y2="7"/></svg>`;
  applyStyles(markerDeleteBtn, { ...btnStyle });
  actionBar.appendChild(markerDeleteBtn);

  const ACTIONBAR_H = 26;
  const showBar = () => {
    const wrapperRect = wrapper.getBoundingClientRect();
    const memoEl = wrapper.closest('[data-memo-id]');
    const memoRect = memoEl?.getBoundingClientRect();
    if (memoRect && wrapperRect.bottom + ACTIONBAR_H > memoRect.bottom) {
      actionBar.style.top = 'auto';
      actionBar.style.bottom = '100%';
    } else {
      actionBar.style.top = '100%';
      actionBar.style.bottom = 'auto';
    }
    actionBar.style.opacity = '1';
    actionBar.style.pointerEvents = 'auto';
  };
  const hideBar = () => { actionBar.style.opacity = '0'; actionBar.style.pointerEvents = 'none'; };

  wrapper.addEventListener('mouseenter', () => { if (!formVisible) showBar(); });
  wrapper.addEventListener('mouseleave', () => { if (!formVisible) hideBar(); });

  // 호버 색상 (삭제 모드 활성 시 삭제 버튼은 빨간색 유지)
  [markerAddBtn, markerDeleteBtn].forEach((btn) => {
    btn.addEventListener('mouseover', () => {
      btn.style.color = 'rgba(0,0,0,0.8)';
      btn.style.boxShadow = '0 1px 6px rgba(0,0,0,0.28)';
    });
    btn.addEventListener('mouseout', () => {
      btn.style.color = (deleteMode && btn === markerDeleteBtn)
        ? 'rgba(239,68,68,0.8)' : 'rgba(0,0,0,0.5)';
      btn.style.boxShadow = '0 1px 4px rgba(0,0,0,0.18)';
    });
  });

  // 삭제 모드 토글
  markerDeleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (deleteMode) {
      deleteMode = false;
      markerList.forEach((m) => m.setIcon(defaultIcon));
      markerDeleteBtn.style.color = 'rgba(0,0,0,0.5)';
    } else {
      deleteMode = true;
      markerList.forEach((m) => m.setIcon(deletableIcon));
      markerDeleteBtn.style.color = 'rgba(239,68,68,0.8)';
    }
  });

  // ─── 마커 입력 폼 (지도 내부 하단 중앙) ──────────────────────────────
  const markerForm = document.createElement('div');
  applyStyles(markerForm, {
    position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
    zIndex: '2000', background: 'white', borderRadius: '8px',
    padding: '10px 12px', boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
    display: 'none', flexDirection: 'column', gap: '6px', minWidth: '176px',
  });
  container.appendChild(markerForm);

  const inputCSS: Partial<CSSStyleDeclaration> = {
    width: '100%', padding: '4px 7px', border: '1px solid #ddd',
    borderRadius: '4px', fontSize: '12px', outline: 'none',
    boxSizing: 'border-box', color: '#1a1a1a',
  };
  const latInput = document.createElement('input');
  latInput.type = 'number'; latInput.placeholder = '위도 (예: 37.5665)'; latInput.step = 'any';
  applyStyles(latInput, inputCSS);

  const lngInput = document.createElement('input');
  lngInput.type = 'number'; lngInput.placeholder = '경도 (예: 126.9780)'; lngInput.step = 'any';
  applyStyles(lngInput, inputCSS);

  const btnRow = document.createElement('div');
  applyStyles(btnRow, { display: 'flex', gap: '4px', justifyContent: 'flex-end' });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  applyStyles(cancelBtn, {
    padding: '3px 9px', border: '1px solid #ddd', borderRadius: '4px',
    background: 'white', fontSize: '11px', cursor: 'pointer', color: '#666',
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '추가';
  applyStyles(confirmBtn, {
    padding: '3px 9px', border: 'none', borderRadius: '4px',
    background: '#3b82f6', fontSize: '11px', cursor: 'pointer', color: 'white',
  });

  btnRow.append(cancelBtn, confirmBtn);
  markerForm.append(latInput, lngInput, btnRow);

  const openForm = () => {
    // 삭제 모드 해제 후 폼 표시
    if (deleteMode) {
      deleteMode = false;
      markerList.forEach((m) => m.setIcon(defaultIcon));
      markerDeleteBtn.style.color = 'rgba(0,0,0,0.5)';
    }
    formVisible = true;
    markerForm.style.display = 'flex';
    latInput.value = ''; lngInput.value = '';
    setTimeout(() => latInput.focus(), 0);
  };

  const closeForm = () => {
    formVisible = false;
    markerForm.style.display = 'none';
  };

  const addMarker = () => {
    const newLat = parseFloat(latInput.value);
    const newLng = parseFloat(lngInput.value);
    if (
      isNaN(newLat) || isNaN(newLng) ||
      newLat < -90 || newLat > 90 ||
      newLng < -180 || newLng > 180
    ) return;
    markerList.push(createMarker(newLat, newLng));
    map.flyTo([newLat, newLng], 15);
    saveMarkers();
    closeForm();
  };

  markerAddBtn.addEventListener('click', (e) => { e.stopPropagation(); openForm(); });
  confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); addMarker(); });
  cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); closeForm(); });

  [latInput, lngInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addMarker();
      if (e.key === 'Escape') closeForm();
      e.stopPropagation();
    });
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
  });

  // 폼 내부 마우스 이벤트가 지도로 전파되지 않도록 차단
  markerForm.addEventListener('mousedown', (e) => e.stopPropagation());
  markerForm.addEventListener('pointerdown', (e) => e.stopPropagation());
}

export const MemoContent = forwardRef<MemoContentHandle, MemoContentProps>(
  function MemoContent({ content, autoFocus, onChange }, ref) {
    const divRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [imgToolbar, setImgToolbar] = useState<ImgToolbarState | null>(null);
    const [resizeHandle, setResizeHandle] = useState<ResizeHandleState | null>(null);
    const resizeHandleRef = useRef<HTMLDivElement>(null);

    // 비제어 패턴: 마운트 시 innerHTML 설정 + 기존 지도 재초기화
    useEffect(() => {
      const div = divRef.current;
      if (!div) return;
      div.innerHTML = sanitizeHTML(toHTML(content));

      const onSave = () => { if (div) onChange(getCleanedHTML(div)); };
      div.querySelectorAll<HTMLDivElement>('[data-map="true"]').forEach((el) => {
        initLeafletMap(el, onSave);
      });

      return () => {
        div.querySelectorAll<HTMLDivElement>('[data-map="true"]').forEach((el) => {
          const mapInstance = (el as any)._leafletMap as L.Map | undefined;
          if (mapInstance) mapInstance.remove();
        });
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * autoFocus가 true(새로 생성된 메모)일 때 커서를 콘텐츠 끝으로 이동한다.
     * div.focus()만으로는 커서가 시작 위치에 놓이므로,
     * range.collapse(false)로 끝 위치로 이동시켜 타이핑이 즉시 가능하게 한다.
     */
    useEffect(() => {
      if (autoFocus && divRef.current) {
        const div = divRef.current;
        div.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(div);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, [autoFocus]);

    useImperativeHandle(ref, () => ({
      insertImage(src: string, maxWidth: number, maxHeight: number) {
        const div = divRef.current;
        if (!div) return;
        div.focus();

        const sel = window.getSelection();
        if (sel && savedRangeRef.current) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        }

        const img = document.createElement('img');
        img.src = src;
        img.style.maxWidth = `${maxWidth}px`;
        img.style.maxHeight = `${maxHeight}px`;
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.marginRight = 'auto';

        const currentSel = window.getSelection();
        if (currentSel && currentSel.rangeCount > 0) {
          const range = currentSel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          range.setStartAfter(img);
          range.collapse(true);
          currentSel.removeAllRanges();
          currentSel.addRange(range);
        } else {
          div.appendChild(img);
        }
        onChange(div.innerHTML);
      },

      insertMap() {
        const div = divRef.current;
        if (!div) return;
        div.focus();

        const sel = window.getSelection();
        if (sel && savedRangeRef.current) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        }

        // 래퍼 + 지도 컨테이너 생성 (래퍼는 지도 + 액션 바를 묶음)
        const wrapper = document.createElement('div');
        wrapper.setAttribute('contenteditable', 'false');
        wrapper.setAttribute('data-map-wrapper', 'true');
        wrapper.style.cssText = 'margin: 4px 0; flex-shrink: 0; position: relative;';

        const container = document.createElement('div');
        container.setAttribute('data-map', 'true');
        container.setAttribute('contenteditable', 'false');
        container.dataset.lat = '37.5665';
        container.dataset.lng = '126.9780';
        container.dataset.zoom = '11';
        // 인라인 스타일로 저장/로드 시 스타일 보존
        container.style.cssText = [
          `height: ${MEMO_UI.MAP_HEIGHT}px`,
          'width: 100%',
          'border-radius: 6px',
          'overflow: hidden',
        ].join('; ');

        wrapper.appendChild(container);

        const currentSel = window.getSelection();
        if (currentSel && currentSel.rangeCount > 0) {
          const range = currentSel.getRangeAt(0);
          range.deleteContents();
          // 커서 다음 줄에 삽입
          const br = document.createElement('br');
          range.insertNode(br);
          range.setStartAfter(br);
          range.insertNode(wrapper);
          range.setStartAfter(wrapper);
          range.collapse(true);
          currentSel.removeAllRanges();
          currentSel.addRange(range);
        } else {
          div.appendChild(wrapper);
        }

        const onSave = () => { if (div) onChange(getCleanedHTML(div)); };
        requestAnimationFrame(() => initLeafletMap(container, onSave));

        onChange(getCleanedHTML(div));
      },
    }));

    /**
     * 현재 커서/선택 영역을 savedRangeRef에 저장한다.
     * insertImage/insertMap 호출 시 이미지 업로드 버튼 클릭으로 포커스가 이동하기 전
     * 마지막 커서 위치를 복원하기 위해 onSelect·onKeyUp에 연결된다.
     * divRef 내부 노드인지 확인하는 이유: 다른 요소에 포커스가 있을 때의
     * 선택 범위가 덮어쓰이지 않도록 방지한다.
     */
    const saveSelection = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && divRef.current?.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    };

    /**
     * 이미지 호버 시 정렬 툴바와 리사이즈 핸들을 표시한다.
     * - 정렬 툴바: 기본은 이미지 아래, 하단을 벗어날 경우 이미지 위로 플립
     * - 리사이즈 핸들: 이미지 우측 하단 모서리에 오버레이 (wrapperRef 기준 절대 좌표)
     * 두 상태를 동시에 갱신해 이미지-핸들 동기화를 보장한다.
     */
    const showImgToolbar = (img: HTMLImageElement) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const wrapperRect = wrapper.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      const TOOLBAR_H = 28;
      const ideal = imgRect.left - wrapperRect.left + imgRect.width / 2 - MEMO_UI.IMAGE_TOOLBAR_WIDTH / 2;
      const left = Math.max(0, Math.min(wrapper.offsetWidth - MEMO_UI.IMAGE_TOOLBAR_WIDTH, ideal));
      const belowTop = imgRect.bottom - wrapperRect.top + 4;
      const top = belowTop + TOOLBAR_H > wrapper.offsetHeight
        ? Math.max(0, imgRect.top - wrapperRect.top - TOOLBAR_H - 4)  // 이미지 위로 플립
        : belowTop;
      setImgToolbar({ img, top, left });
      setResizeHandle({
        img,
        top: imgRect.bottom - wrapperRect.top - MEMO_UI.RESIZE_HANDLE_SIZE / 2,
        left: imgRect.right - wrapperRect.left - MEMO_UI.RESIZE_HANDLE_SIZE / 2,
      });
    };

    /**
     * 이미지 마우스아웃 후 120ms 딜레이를 두고 정렬 툴바와 리사이즈 핸들을 숨긴다.
     * 딜레이 동안 툴바/핸들로 마우스를 옮기면 cancelHideToolbar가 타이머를 취소해 유지된다.
     */
    const scheduleHideToolbar = () => {
      hideTimerRef.current = setTimeout(() => {
        setImgToolbar(null);
        setResizeHandle(null);
      }, 120);
    };

    const cancelHideToolbar = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };

    /**
     * 리사이즈 핸들 드래그 시작 핸들러.
     *
     * 성능 최적화: mousemove 중 React 상태를 갱신하면 매 픽셀마다 리렌더가 발생한다.
     * 대신 document 레벨 이벤트 리스너로 img/handle 스타일을 직접(imperative) 갱신해
     * 리렌더 없이 부드러운 드래그를 구현한다.
     * 드래그가 끝나는 mouseup 시점에 한 번만 React 상태를 동기화하고 onChange를 호출한다.
     *
     * document 레벨 등록 이유: 빠르게 드래그하면 마우스가 핸들 요소를 벗어날 수 있다.
     * document에 등록하면 포인터가 어디 있어도 이벤트를 놓치지 않는다.
     */
    const handleResizeMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const img = resizeHandle?.img;
      if (!img) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = img.offsetWidth;
      const startH = img.offsetHeight;

      // 드래그 중에는 정렬 툴바를 숨겨 시각적 간섭을 줄인다
      setImgToolbar(null);

      const onMouseMove = (ev: MouseEvent) => {
        const newW = Math.max(20, startW + (ev.clientX - startX));
        const newH = Math.max(20, startH + (ev.clientY - startY));
        img.style.width = `${newW}px`;
        img.style.height = `${newH}px`;
        // 초기 삽입 시 설정된 maxWidth/maxHeight 제약을 해제해 자유롭게 리사이즈 가능하게 한다
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';

        // 핸들 위치를 직접 DOM 조작으로 갱신 (React setState 없이)
        const wrapper = wrapperRef.current;
        const handle = resizeHandleRef.current;
        if (wrapper && handle) {
          const wr = wrapper.getBoundingClientRect();
          const ir = img.getBoundingClientRect();
          handle.style.top = `${ir.bottom - wr.top - MEMO_UI.RESIZE_HANDLE_SIZE / 2}px`;
          handle.style.left = `${ir.right - wr.left - MEMO_UI.RESIZE_HANDLE_SIZE / 2}px`;
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        // 드래그 중 body에 설정했던 전역 커서를 원복
        document.body.style.cursor = '';
        // 드래그 완료 후 저장
        const div = divRef.current;
        if (div) onChange(div.innerHTML);
        // 최종 핸들 위치를 React 상태와 동기화 (다음 호버 시 올바른 위치 참조)
        const wrapper = wrapperRef.current;
        if (wrapper) {
          const wr = wrapper.getBoundingClientRect();
          const ir = img.getBoundingClientRect();
          setResizeHandle({
            img,
            top: ir.bottom - wr.top - MEMO_UI.RESIZE_HANDLE_SIZE / 2,
            left: ir.right - wr.left - MEMO_UI.RESIZE_HANDLE_SIZE / 2,
          });
        }
      };

      // 드래그 중 커서를 body 전체에 강제 적용 (요소 경계를 넘어도 커서 유지)
      document.body.style.cursor = 'nwse-resize';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    /**
     * 이미지 정렬을 변경한다.
     * img는 display: block이므로 margin auto로 수평 정렬을 제어한다.
     * left:  marginRight=auto → 이미지가 왼쪽에 붙고 우측에 여백
     * center: 양쪽 auto    → 가운데 정렬
     * right:  marginLeft=auto → 이미지가 오른쪽에 붙고 좌측에 여백
     */
    const applyAlignment = (align: AlignType) => {
      const img = imgToolbar?.img;
      if (!img || !divRef.current) return;
      if (align === 'left')        { img.style.marginLeft = '0';    img.style.marginRight = 'auto'; }
      else if (align === 'center') { img.style.marginLeft = 'auto'; img.style.marginRight = 'auto'; }
      else                         { img.style.marginLeft = 'auto'; img.style.marginRight = '0';    }
      onChange(divRef.current.innerHTML);
    };

    return (
      <div ref={wrapperRef} className={styles.editorWrapper}>
        <div
          ref={divRef}
          className={styles.editor}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="메모를 입력하세요..."
          onBlur={() => {
            const div = divRef.current;
            if (div && div.innerHTML !== content) onChange(getCleanedHTML(div));
          }}
          onSelect={saveSelection}
          onKeyUp={saveSelection}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseOver={(e) => {
            if (e.target instanceof HTMLImageElement) showImgToolbar(e.target);
          }}
          onMouseOut={(e) => {
            if (e.target instanceof HTMLImageElement) scheduleHideToolbar();
          }}
        />

        {imgToolbar && (
          <div
            className={styles.imgAlignToolbar}
            style={{ top: imgToolbar.top, left: imgToolbar.left }}
            onMouseEnter={cancelHideToolbar}
            onMouseLeave={scheduleHideToolbar}
          >
            <button className={styles.alignBtn} title="왼쪽 정렬"
              onMouseDown={(e) => e.preventDefault()} onClick={() => applyAlignment('left')}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                <rect x="1" y="2"   width="12" height="1.5" rx="0.75"/>
                <rect x="1" y="5.5" width="8"  height="1.5" rx="0.75"/>
                <rect x="1" y="9"   width="10" height="1.5" rx="0.75"/>
              </svg>
            </button>
            <button className={styles.alignBtn} title="가운데 정렬"
              onMouseDown={(e) => e.preventDefault()} onClick={() => applyAlignment('center')}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                <rect x="1" y="2"   width="12" height="1.5" rx="0.75"/>
                <rect x="3" y="5.5" width="8"  height="1.5" rx="0.75"/>
                <rect x="2" y="9"   width="10" height="1.5" rx="0.75"/>
              </svg>
            </button>
            <button className={styles.alignBtn} title="오른쪽 정렬"
              onMouseDown={(e) => e.preventDefault()} onClick={() => applyAlignment('right')}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                <rect x="1" y="2"   width="12" height="1.5" rx="0.75"/>
                <rect x="5" y="5.5" width="8"  height="1.5" rx="0.75"/>
                <rect x="3" y="9"   width="10" height="1.5" rx="0.75"/>
              </svg>
            </button>
          </div>
        )}

        {resizeHandle && (
          <div
            ref={resizeHandleRef}
            className={styles.imgResizeHandle}
            style={{ top: resizeHandle.top, left: resizeHandle.left }}
            onMouseEnter={cancelHideToolbar}
            onMouseLeave={scheduleHideToolbar}
            onMouseDown={handleResizeMouseDown}
          />
        )}
      </div>
    );
  }
);
