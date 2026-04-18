/**
 * @file generateId.ts
 * 고유 ID 생성 로직을 한 곳에 격리한다.
 * ID 생성 방식을 교체하거나 테스트에서 모킹할 때 이 파일만 수정하면 된다.
 */

/**
 * 앱 전체에서 사용하는 고유 ID를 반환한다.
 *
 * 우선순위:
 * 1. `crypto.randomUUID()` — 브라우저 내장 API, RFC 4122 UUID v4 형식.
 *    충돌 확률이 사실상 0에 가깝고 별도 라이브러리가 필요 없다.
 * 2. 폴백 — crypto API를 사용할 수 없는 환경(구형 브라우저, 일부 테스트 환경)에서는
 *    Math.random()과 Date.now()를 조합해 고유성을 최대한 확보한다.
 *    (완전한 UUID는 아니지만 메모 앱 수준에서는 충분하다)
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 36진수로 변환 후 앞 두 자리('0.')를 제거해 난수 문자열을 만들고,
  // 타임스탬프를 뒤에 붙여 같은 밀리초에 여러 ID가 생성돼도 충돌하지 않도록 한다.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
