export const STUDIO_PRESET_IDS = [
  "afternoon_gold",
  "distance_night",
  "marble",
  "velvet",
  "linen",
  "solid_white",
  "solid_cream",
  "custom",
] as const;
export type StudioPresetId = (typeof STUDIO_PRESET_IDS)[number];

export const STUDIO_FRAME_IDS = ["square", "portrait", "story"] as const;
export type StudioFrameId = (typeof STUDIO_FRAME_IDS)[number];

export type StudioPreset = {
  id: StudioPresetId;
  label: string;
  hint: string;
  swatch: string;
  kind: "scene" | "solid" | "custom";
  color?: string;
  prompt?: string;
};

export const STUDIO_PRESETS: StudioPreset[] = [
  {
    id: "afternoon_gold",
    label: "Afternoon Gold",
    hint: "Cahaya sore, marble madu, kampanye Afternoon",
    swatch: "#C9A227",
    kind: "scene",
    prompt:
      "the image features a luxury amber perfume bottle on warm honey marble, golden hour sunlight from the left, soft cinematic shadows, shallow depth of field, premium fragrance campaign photography, no text, no extra bottles, no logos",
  },
  {
    id: "distance_night",
    label: "The Distance Night",
    hint: "Gelap, kayu, rim light untuk The Distance",
    swatch: "#2C241C",
    kind: "scene",
    prompt:
      "the image features a dark woody perfume bottle on smoked black glass, moody night studio lighting, deep charcoal and bronze tones, dramatic rim light, luxury oud campaign photography, no text, no extra bottles, no logos",
  },
  {
    id: "marble",
    label: "Marble Studio",
    hint: "Putih bersih, siap Shopee / katalog",
    swatch: "#EDE8E0",
    kind: "scene",
    prompt:
      "the image features a perfume bottle on clean white Carrara marble, bright softbox studio light, minimal luxury e-commerce catalog photo, no text, no extra objects, no logos",
  },
  {
    id: "velvet",
    label: "Velvet Black",
    hint: "Hitam mewah, spotlight botol",
    swatch: "#111111",
    kind: "scene",
    prompt:
      "the image features a perfume bottle on deep black velvet, elegant spotlight, glossy reflections, high-end still life, no text, no extra bottles, no logos",
  },
  {
    id: "linen",
    label: "Soft Linen",
    hint: "Kain beige, cahaya jendela, lifestyle",
    swatch: "#D9CDB8",
    kind: "scene",
    prompt:
      "the image features a perfume bottle on beige linen fabric near a window, natural daylight, airy lifestyle product photo, no text, no extra bottles, no logos",
  },
  {
    id: "solid_white",
    label: "Putih Polos",
    hint: "Background #FFFFFF marketplace",
    swatch: "#FFFFFF",
    kind: "solid",
    color: "FFFFFF",
  },
  {
    id: "solid_cream",
    label: "Krem Henima",
    hint: "Background hangat #F5EDE0",
    swatch: "#F5EDE0",
    kind: "solid",
    color: "F5EDE0",
  },
  {
    id: "custom",
    label: "Custom",
    hint: "Tulis sendiri: pantai, hotel, kayu, dll",
    swatch: "#2DD4BF",
    kind: "custom",
  },
];

export const STUDIO_FRAMES: { id: StudioFrameId; label: string; size: string; ratio: string }[] = [
  { id: "square", label: "1:1 Shopee", size: "2000x2000", ratio: "1 / 1" },
  { id: "portrait", label: "4:5 Instagram", size: "1600x2000", ratio: "4 / 5" },
  { id: "story", label: "9:16 Story", size: "1080x1920", ratio: "9 / 16" },
];

const PRESET_ALIASES: Record<string, StudioPresetId> = {
  afternoon: "afternoon_gold",
  gold: "afternoon_gold",
  sore: "afternoon_gold",
  amber: "afternoon_gold",
  afternoon_gold: "afternoon_gold",
  the_distance: "distance_night",
  distance: "distance_night",
  night: "distance_night",
  gelap: "distance_night",
  oud: "distance_night",
  distance_night: "distance_night",
  marble: "marble",
  marmer: "marble",
  katalog: "marble",
  shopee: "marble",
  velvet: "velvet",
  hitam: "velvet",
  black: "velvet",
  linen: "linen",
  kain: "linen",
  natural: "linen",
  white: "solid_white",
  putih: "solid_white",
  solid_white: "solid_white",
  cream: "solid_cream",
  krem: "solid_cream",
  solid_cream: "solid_cream",
  custom: "custom",
  bebas: "custom",
};

export function getStudioPreset(id: StudioPresetId): StudioPreset {
  return STUDIO_PRESETS.find((p) => p.id === id) || STUDIO_PRESETS[0];
}

export function resolveStudioPreset(raw?: string | null): StudioPresetId | null {
  const t = (raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!t) return null;
  if ((STUDIO_PRESET_IDS as readonly string[]).includes(t)) return t as StudioPresetId;
  return PRESET_ALIASES[t] || null;
}

export function resolveStudioFrame(raw?: string | null): StudioFrameId {
  const t = (raw || "").trim().toLowerCase();
  if (t === "portrait" || t === "4:5" || t === "ig" || t === "instagram") return "portrait";
  if (t === "story" || t === "9:16" || t === "reels") return "story";
  return "square";
}

export function studioOutputSize(frame: StudioFrameId): string {
  return STUDIO_FRAMES.find((f) => f.id === frame)?.size || "2000x2000";
}

export function buildBackgroundPrompt(presetId: StudioPresetId, custom?: string | null): string | null {
  const preset = getStudioPreset(presetId);
  if (preset.kind === "solid") return null;
  const extra = (custom || "").trim();
  if (preset.kind === "custom") {
    if (!extra) throw new Error("Prompt custom wajib diisi.");
    if (extra.length > 80) return extra;
    return `the image features a luxury perfume bottle, ${extra}, professional fragrance product photography, no text, no extra bottles, no logos`;
  }
  if (extra) return `${preset.prompt}, ${extra}`;
  return preset.prompt || null;
}

export function studioPresetPublic() {
  return STUDIO_PRESETS.map(({ id, label, hint, swatch, kind }) => ({ id, label, hint, swatch, kind }));
}
