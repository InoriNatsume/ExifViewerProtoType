# ExifViewer 리팩터링 설계/동작 문서

## 0. 목표
- GitHub Pages 환경에서 브라우저만으로 표준 EXIF + 스텔스 EXIF를 읽어 정규화 뷰/RAW/필드 탐색을 제공.
- 추출·파싱·정규화 로직을 UI와 분리해 다른 JS 프로젝트에서도 재사용 가능하도록 ES 모듈화.
- NovelAI 메타(JSON) 특성을 반영한 스키마/포맷터로 가독성 있는 뷰 제공.
- 각 EXIF 결과를 JSON으로 다운로드 가능하게 유틸 제공.

## 1. 비기능 요구
- 브라우저 ES Module 로딩 기준(번들러 없이 동작), 외부 의존성은 CDN exifr(표준), CDN pako(stealth gzip) 사용.
- 로직은 `src/core`, `src/features`에 격리, UI는 최소한의 DOM 제어만 담당.
- 테스트는 브라우저 콘솔/샘플 파일로 수동 검증 가능하게 유지.

## 2. 폴더 구조
```
src/
  core/
    extract/          # 추출
      standard-exif.js
      stealth-exif.js
    parse/            # 정규화
      schema/
        novelai-schema.js
      normalize.js
    format/           # 뷰 모델/포맷터
      view-model.js
      pretty-json.js
      key-explorer.js
  features/
    download/
      save-json.js
  ui/
    viewer.js         # DOM 제어, 탭/토글/렌더
public/
  image_tool.html     # 진입점 (ES module 로드)
참조/
  exif_example_novelai.json
```

## 3. 핵심 모듈
- `standard-exif.js` : `parseStandardExif(file: Blob) -> Promise<object|null>`
- `stealth-exif.js`  : `parseStealthExif(imageData: ImageData) -> Promise<string|null>` 등 비트 추출/디코딩 분리
- `novelai-schema.js`: v4 이전/이후를 감지해 base_caption, char_captions, sampler/steps/scale/seed/size 등 정규화
- `normalize.js`     : 공급자 감지 후 `{ vendor, normalized, raw }` 반환
- `view-model.js`    : 정규화된 메타를 섹션 카드 데이터로 변환(프롬프트/네거티브/캐릭터별 프롬·네거, 샘플 설정, 크기/시드)
- `pretty-json.js`   : 객체/문자열 JSON을 들여쓰기 문자열로 변환(문자열이면 파싱 시도)
- `key-explorer.js`  : JSON 키 트리를 평탄화, 문자열에 내장된 JSON도 `(필드명)(json)...` 경로로 재귀 표시
- `save-json.js`     : 브라우저에서 JSON 다운로드 헬퍼
- `viewer.js`        : 파일 선택 → 추출(표준/스텔스) → 정규화 → 섹션/RAW/필드탐색 렌더 + 소스 토글/배지/다운로드

## 4. 데이터 흐름
1) 파일 선택 → 이미지 로드 → `canvas.getImageData`.
2) `parseStandardExif(file)` 실행.
3) `parseStealthExif(imageData)` 실행 후 JSON 파싱.
4) 기본 소스 선택:
   - Software/Source에 `NovelAI`가 있고 스텔스가 있으면 스텔스 우선.
   - 그 외 표준 있으면 표준, 없으면 스텔스.
5) 선택된 소스를 `normalizeMetadata`로 정규화 → `buildSections`로 카드 생성.
6) RAW 탭은 선택된 소스 객체를 `normalizeRawForDisplay`로 문자열 JSON 내부까지 파싱 후 `prettyJson`으로 출력.
7) 필드 탐색 탭은 `extractKeyPaths`로 계층 경로+샘플을 표로 표시.
8) JSON 저장은 현재 탭/소스 기준으로 다운로드.

## 5. UI/UX 요약
- 상단: 업로드/프리뷰, 상태 & 액션(표준/스텔스 배지, NovelAI 배지, 소스 토글, JSON 저장).
- 미니 카드: 샘플 설정(샘플러 → 노이즈 스케줄 → 스텝 → CFG/Rescale → Request Type), 크기/시드(Width/Height/Seed/n_samples).
- 탭: `정규화 뷰 | RAW | 필드 탐색`.
- 정규화 뷰: 프롬프트, 네거티브, 캐릭터별 프롬/네거를 순차 카드로 표시. 샘플/크기 정보는 상단 미니 카드에 배치.
- RAW: 선택한 소스 기준 JSON 구조를 들여쓰기 형태로 표시(문자열 내 JSON도 복원).
- 필드 탐색: 모든 키 경로 + 타입 + 샘플, 문자열 JSON은 `(필드명)(json)...` 경로로 중첩 표시.

## 6. NovelAI 감지/표시
- `Software` 또는 `Source`에 `NovelAI`가 포함되면 NovelAI 배지를 상태 영역에 표시(`NovelAI (Source값)`).
- NovelAI 문자열이 감지되고 스텔스 EXIF가 존재하면 기본 소스는 스텔스로 선택.

## 7. 남은 작업/주의
- CDN 로딩 실패 시(exifr/pako) 콘솔 경고로만 표시하므로, 네트워크 제한 환경에서는 수동 확인 필요.
- 추가로 노출할 필드나 섹션 순서 변경이 필요하면 `view-model.js`를 수정하고, RAW/필드 탐색에서 키를 확인 후 매핑 확장.***
