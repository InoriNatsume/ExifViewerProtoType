import { parseStandardExif } from '../extract/standard-exif.js';
import { extractPngTextChunks } from '../extract/png-text.js';

export async function readImageMeta(file) {
  if (!file) return null;

  const [standardExif, pngText, imageData] = await Promise.all([
    parseStandardExif(file),
    extractPngTextChunks(file),
    loadImageData(file),
  ]);

  return {
    file,
    standardExif,
    pngText,
    imageData,
  };
}

function loadImageData(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        URL.revokeObjectURL(url);
        resolve(imageData);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
