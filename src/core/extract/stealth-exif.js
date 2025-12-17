// 스텔스 EXIF 추출 로직을 순수 함수로 분리.
// 입력: ImageData (canvas.getImageData)
// 출력: Promise<string|null> - 스텔스에 담긴 문자열(JSON 기대)

const SIG_ALPHA = 'stealth_pnginfo';
const SIG_ALPHA_COMP = 'stealth_pngcomp';
const SIG_RGB = 'stealth_rgbinfo';
const SIG_RGB_COMP = 'stealth_rgbcomp';

export function extractStealthBits(imageData) {
  const { data, width, height } = imageData;
  let mode = null;
  let compressed = false;
  let binaryData = '';
  let bufferA = '';
  let bufferRGB = '';
  let indexA = 0;
  let indexRGB = 0;
  let sigConfirmed = false;
  let confirmingSignature = true;
  let readingParamLen = false;
  let readingParam = false;
  let readEnd = false;
  let paramLen = 0;

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      bufferA += (a & 1).toString();
      indexA += 1;

      bufferRGB += (r & 1).toString();
      bufferRGB += (g & 1).toString();
      bufferRGB += (b & 1).toString();
      indexRGB += 3;

      if (confirmingSignature) {
        if (indexA === SIG_ALPHA.length * 8) {
          const decoded = binToUtf8(bufferA);
          if (decoded === SIG_ALPHA || decoded === SIG_ALPHA_COMP) {
            confirmingSignature = false;
            sigConfirmed = true;
            readingParamLen = true;
            mode = 'alpha';
            compressed = decoded === SIG_ALPHA_COMP;
            bufferA = '';
            indexA = 0;
          } else {
            readEnd = true;
          }
        }
        if (confirmingSignature && indexRGB === SIG_RGB.length * 8) {
          const decoded = binToUtf8(bufferRGB);
          if (decoded === SIG_RGB || decoded === SIG_RGB_COMP) {
            confirmingSignature = false;
            sigConfirmed = true;
            readingParamLen = true;
            mode = 'rgb';
            compressed = decoded === SIG_RGB_COMP;
            bufferRGB = '';
            indexRGB = 0;
          }
        }
        if (confirmingSignature) {
          if (indexA > SIG_ALPHA.length * 8 && indexRGB > SIG_RGB.length * 8) {
            readEnd = true;
          }
        }
      } else if (readingParamLen) {
        if (mode === 'alpha') {
          if (indexA === 32) {
            paramLen = parseInt(bufferA, 2);
            readingParamLen = false;
            readingParam = true;
            bufferA = '';
            indexA = 0;
          }
        } else {
          if (indexRGB >= 33) {
            const pop = bufferRGB.slice(-1);
            bufferRGB = bufferRGB.slice(0, -1);
            paramLen = parseInt(bufferRGB, 2);
            readingParamLen = false;
            readingParam = true;
            bufferRGB = pop;
            indexRGB = 1;
          }
        }
      } else if (readingParam) {
        if (mode === 'alpha') {
          if (indexA === paramLen) {
            binaryData = bufferA;
            readEnd = true;
          }
        } else {
          if (indexRGB >= paramLen) {
            const diff = paramLen - indexRGB;
            if (diff < 0) bufferRGB = bufferRGB.slice(0, diff);
            binaryData = bufferRGB;
            readEnd = true;
          }
        }
      }

      if (readEnd) break;
    }
    if (readEnd) break;
  }

  if (sigConfirmed && binaryData) {
    return { mode, compressed, binaryData };
  }
  return null;
}

export function decodeStealthPayload(bitsResult) {
  if (!bitsResult) return null;
  const { compressed, binaryData } = bitsResult;
  try {
    const byteArray = new Uint8Array(binaryData.length / 8);
    for (let i = 0; i < binaryData.length; i += 8) {
      byteArray[i / 8] = parseInt(binaryData.substring(i, i + 8), 2);
    }
    if (compressed) {
      if (typeof pako === 'undefined') {
        console.warn('pako가 로드되지 않아 gzip 해제가 불가합니다.');
        return null;
      }
      return pako.inflate(byteArray, { to: 'string' });
    }
    return new TextDecoder('utf-8').decode(byteArray);
  } catch (e) {
    console.error('스텔스 payload 디코딩 실패', e);
    return null;
  }
}

export async function parseStealthExif(imageData) {
  const bits = extractStealthBits(imageData);
  if (!bits) return null;
  return decodeStealthPayload(bits);
}

function binToUtf8(binStr) {
  const bytes = [];
  for (let i = 0; i < binStr.length; i += 8) {
    bytes.push(parseInt(binStr.substring(i, i + 8), 2));
  }
  return new TextDecoder('utf-8', { fatal: false })
    .decode(new Uint8Array(bytes))
    .replace(/\0/g, '');
}
