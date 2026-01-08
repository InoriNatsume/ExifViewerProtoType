const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export async function extractPngTextChunks(file) {
  if (!file) return {};
  const buffer = await file.arrayBuffer();
  return parsePngTextChunks(buffer);
}

export function parsePngTextChunks(buffer) {
  const bytes = new Uint8Array(buffer);
  if (!isPng(bytes)) return {};

  const decoderLatin1 = new TextDecoder('latin1');
  const decoderUtf8 = new TextDecoder('utf-8');
  const out = {};

  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = readType(bytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > bytes.length) break;

    if (type === 'tEXt') {
      const chunk = bytes.subarray(dataStart, dataEnd);
      const sep = chunk.indexOf(0);
      if (sep > 0) {
        const key = decoderLatin1.decode(chunk.subarray(0, sep));
        const value = decoderLatin1.decode(chunk.subarray(sep + 1));
        pushValue(out, key, value);
      }
    }

    if (type === 'zTXt') {
      const chunk = bytes.subarray(dataStart, dataEnd);
      const sep = chunk.indexOf(0);
      if (sep > 0 && chunk.length >= sep + 2) {
        const key = decoderLatin1.decode(chunk.subarray(0, sep));
        const compMethod = chunk[sep + 1];
        if (compMethod === 0) {
          const compressed = chunk.subarray(sep + 2);
          const value = inflateToString(compressed);
          if (value !== null) pushValue(out, key, value);
        }
      }
    }

    if (type === 'iTXt') {
      const chunk = bytes.subarray(dataStart, dataEnd);
      const keyEnd = chunk.indexOf(0);
      if (keyEnd > 0 && chunk.length >= keyEnd + 3) {
        const key = decoderLatin1.decode(chunk.subarray(0, keyEnd));
        const compressionFlag = chunk[keyEnd + 1];
        const compressionMethod = chunk[keyEnd + 2];
        let idx = keyEnd + 3;
        idx = advanceToNull(chunk, idx);
        idx = advanceToNull(chunk, idx);

        const textBytes = chunk.subarray(idx);
        if (compressionFlag === 1 && compressionMethod === 0) {
          const value = inflateToString(textBytes, true);
          if (value !== null) pushValue(out, key, value);
        } else {
          const value = decoderUtf8.decode(textBytes);
          pushValue(out, key, value);
        }
      }
    }

    offset = dataEnd + 4;
  }

  return out;
}

function isPng(bytes) {
  if (bytes.length < PNG_SIGNATURE.length) return false;
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

function readUint32(bytes, offset) {
  return (
    (bytes[offset] << 24)
    | (bytes[offset + 1] << 16)
    | (bytes[offset + 2] << 8)
    | bytes[offset + 3]
  ) >>> 0;
}

function readType(bytes, offset) {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );
}

function pushValue(out, key, value) {
  if (!key) return;
  if (!out[key]) out[key] = [];
  out[key].push(value);
}

function inflateToString(bytes, utf8 = false) {
  if (typeof pako === 'undefined') return null;
  try {
    const inflated = pako.inflate(bytes);
    const decoder = new TextDecoder(utf8 ? 'utf-8' : 'latin1');
    return decoder.decode(inflated);
  } catch (_) {
    return null;
  }
}

function advanceToNull(bytes, idx) {
  let i = idx;
  while (i < bytes.length && bytes[i] !== 0) i += 1;
  return i + 1;
}
