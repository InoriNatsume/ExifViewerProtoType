// JSON ?곗씠?곕? ?뚯씪濡???ν븯???좏떥 (釉뚮씪?곗?)
export function saveJson(filename, data) {
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'exif.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
