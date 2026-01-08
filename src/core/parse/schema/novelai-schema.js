// NovelAI ?꾩슜 ?ㅽ궎留??뺢퇋??// ?낅젰: raw JSON 媛앹껜
// 異쒕젰: NormalizedMeta | null

export function parseNovelAI(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const isV4 = !!raw.v4_prompt || (typeof raw.version === 'number' && raw.version >= 4);
  const hasPrompt = typeof raw.prompt === 'string' || isV4;
  const hasNAIKeys =
    hasPrompt &&
    (raw.steps !== undefined ||
      raw.sampler !== undefined ||
      raw.noise_schedule !== undefined ||
      raw.width !== undefined ||
      raw.height !== undefined);

  if (!hasNAIKeys) return null;

  const basePrompt = isV4
    ? raw.v4_prompt?.caption?.base_caption ?? ''
    : raw.prompt ?? '';
  const baseNegative = isV4
    ? raw.v4_negative_prompt?.caption?.base_caption ?? ''
    : raw.uc ?? '';

  const charPrompts = isV4 ? collectCharCaptions(raw.v4_prompt?.caption?.char_captions) : [];
  const charNegPrompts = isV4 ? collectCharCaptions(raw.v4_negative_prompt?.caption?.char_captions) : [];

  return {
    vendor: 'novelai',
    version: raw.version ?? null,
    prompt: basePrompt,
    negative_prompt: baseNegative,
    char_prompts: charPrompts,
    char_negative_prompts: charNegPrompts,
    sampler: raw.sampler ?? raw.noise_schedule ?? '',
    noise_schedule: raw.noise_schedule ?? '',
    steps: raw.steps ?? null,
    cfg_scale: raw.scale ?? null,
    cfg_rescale: raw.cfg_rescale ?? null,
    seed: raw.seed ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
    n_samples: raw.n_samples ?? null,
    request_type: raw.request_type ?? null,
    director_reference_strengths: raw.director_reference_strengths ?? null,
    extras: pickExtras(raw),
    raw,
  };
}

function collectCharCaptions(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((c, idx) => ({
      idx,
      caption: c?.char_caption ?? '',
      centers: c?.centers ?? [],
    }))
    .filter((c) => c.caption);
}

function pickExtras(raw) {
  const known = new Set([
    'prompt',
    'uc',
    'v4_negative_prompt',
    'steps',
    'sampler',
    'noise_schedule',
    'scale',
    'version',
    'v4_prompt',
    'v4_negative_prompt',
    'char_prompts',
    'char_negative_prompts',
    'cfg_rescale',
    'seed',
    'width',
    'height',
    'n_samples',
    'request_type',
    'director_reference_strengths',
    'noise_schedule',
  ]);
  const extras = {};
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) extras[key] = raw[key];
  }
  return extras;
}
