// ?쒖? EXIF 異붿텧 濡쒖쭅 (exifr ?ъ슜). 釉뚮씪?곗? ?섍꼍?먯꽌 import ???ъ슜.
// ?낅젰: Blob/File
// 異쒕젰: Promise<object|null>
export async function parseStandardExif(file) {
  if (!file) return null;
  if (typeof exifr === 'undefined' || !exifr.parse) {
    console.warn('exifr媛 濡쒕뱶?섏? ?딆븯?듬땲?? CDN ?ㅽ겕由쏀듃 ?뺤씤 ?꾩슂.');
    return null;
  }
  try {
    const result = await exifr.parse(file);
    if (result && typeof result === 'object' && Object.keys(result).length > 0) {
      return result;
    }
    return null;
  } catch (err) {
    console.error('?쒖? EXIF ?뚯떛 ?ㅻ쪟', err);
    return null;
  }
}
