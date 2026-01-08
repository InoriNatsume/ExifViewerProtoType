// 정규화된 메타 데이터를 UI 섹션으로 변환
export function buildSections(meta) {
  if (!meta) return [];
  const sections = [];
  sections.push({
    title: '프롬프트',
    mode: 'block',
    items: [{ label: 'Prompt', value: meta.prompt || '' }],
  });
  sections.push({
    title: '네거티브',
    mode: 'block',
    items: [{ label: 'Negative', value: meta.negative_prompt || '' }],
  });

  const pairs = Math.max(
    meta.char_prompts ? meta.char_prompts.length : 0,
    meta.char_negative_prompts ? meta.char_negative_prompts.length : 0
  );
  for (let i = 0; i < pairs; i++) {
    const cp = meta.char_prompts?.[i];
    const cn = meta.char_negative_prompts?.[i];
    if (cp) {
      sections.push({
        title: `캐릭터 프롬프트 ${i + 1}`,
        mode: 'block',
        items: [{ label: `Char ${i + 1}`, value: cp.caption }],
      });
    }
    if (cn) {
      sections.push({
        title: `캐릭터 네거티브 ${i + 1}`,
        mode: 'block',
        items: [{ label: `Char ${i + 1}`, value: cn.caption }],
      });
    }
  }
  return sections;
}

function formatValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
