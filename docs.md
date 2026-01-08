# ExifViewer 문서


https://inorinatsume.github.io/ExifViewerProtoType/

## 0. 목표
- GitHub Pages에서 브라우저만으로 EXIF + 스텔스 EXIF를 읽고 정규화/RAW/필드 탐색 제공
- NAI/ComfyUI 판정을 공통 UI에서 수행하고, 전용 뷰로 분기
- 모델 업데이트 대응을 위해 스키마를 분리하고 교체만으로 유지 가능하게 구성

## 1. 프로젝트 구조(루트 기준)
```
src/
  core/
    detect/
      model.js            # 공통 판정(NAI/Comfy/기타)
    extract/
      standard-exif.js    # 표준 EXIF
      stealth-exif.js     # NAI 스텔스 추출(전용)
      png-text.js         # PNG tEXt/iTXt/zTXt 파서(공통)
    image/
      read-image-meta.js  # 표준 EXIF + PNG 텍스트 + ImageData
    parse/
      schema/
        novelai-schema.js # NAI 스키마
      normalize.js        # NAI 정규화
    format/
      view-model.js       # NAI 섹션 뷰 모델
      pretty-json.js
      key-explorer.js
  features/
    download/
      save-json.js
    comfy/
      core/
        schema.js         # ComfyUI 스키마 로더
        normalize.js      # 그래프 정규화
        categories.js
        resources.js
        extract.js        # PNG 텍스트에서 prompt/workflow 추출
      ui/
        viewer.js         # ComfyUI 전용 뷰어
  ui/
    viewer.js             # 공통/NAI UI
public/
  image_tool.html         # 공통 UI
  comfy_viewer.html       # ComfyUI 전용 UI
  comfy/
    official_comfyui_worflow.json
```

## 2. 판정 및 분기 흐름
1) 이미지 업로드 → `readImageMeta`
   - 표준 EXIF
   - PNG 텍스트(tEXt/iTXt/zTXt)
   - ImageData(스텔스 추출용)
2) 판정(`detectModelFromMeta`)
   - PNG 텍스트에 ComfyUI prompt/workflow → ComfyUI
   - 표준 EXIF Software/Source에 NovelAI → NAI
   - 그 외 → 기타/없음
3) 공통 UI에서 판정 배지 표시 + 전용 뷰 이동 버튼 활성화
4) ComfyUI 버튼 클릭 시, PNG 메타데이터를 세션에 담아 전용 뷰로 전달

## 3. NAI 전용 처리
- 스텔스 EXIF는 NAI 전용이며 공통에서 처리하지 않음
- 정규화는 `novelai-schema.js`에서 수행

## 4. ComfyUI 전용 처리
- PNG 텍스트에서 `prompt`/`workflow`를 추출(`extract.js`)
- 그래프 정규화는 `normalize.js`
- 공식 스키마는 `public/comfy/official_comfyui_worflow.json`

## 5. 로컬 실행
- 로컬에서는 ES Module을 사용하므로 반드시 HTTP 서버로 열어야 함
```
cd C:\Projects\ExifViewer
python -m http.server 8000
```
- 공통 UI: `http://localhost:8000/public/image_tool.html`
- ComfyUI UI: `http://localhost:8000/public/comfy_viewer.html`

## 6. GitHub Pages
- Pages에서는 HTTP로 제공되므로 별도 서버 없이 정상 동작
- 액션으로 `public/` + `src/`를 그대로 배포

## 7. 스키마 업데이트 위치
- NAI: `src/core/parse/schema/novelai-schema.js`
- ComfyUI: `public/comfy/official_comfyui_worflow.json`
