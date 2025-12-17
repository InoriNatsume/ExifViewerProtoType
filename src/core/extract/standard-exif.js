// 표준 EXIF 추출 로직 (exifr 사용). 브라우저 환경에서 import 후 사용.
// 입력: Blob/File
// 출력: Promise<object|null>
export async function parseStandardExif(file) {
  if (!file) return null;
  if (typeof exifr === 'undefined' || !exifr.parse) {
    console.warn('exifr가 로드되지 않았습니다. CDN 스크립트 확인 필요.');
    return null;
  }
  try {
    const result = await exifr.parse(file);
    if (result && typeof result === 'object' && Object.keys(result).length > 0) {
      return result;
    }
    return null;
  } catch (err) {
    console.error('표준 EXIF 파싱 오류', err);
    return null;
  }
}
