import type { TargetLanguage } from "@/types/question";

export interface VocabularyItem {
  lang: TargetLanguage;
  surface: string;
  reading: string;
  meaning: string;
  pos: string;
}

export const starterVocabulary: VocabularyItem[] = [
  { lang: "zh", surface: "明天", reading: "ming2 tian1", meaning: "明日", pos: "名詞" },
  { lang: "zh", surface: "學習", reading: "xue2 xi2", meaning: "勉強する", pos: "動詞" },
  { lang: "zh", surface: "喜歡", reading: "xi3 huan1", meaning: "好き", pos: "動詞" },
  { lang: "zh", surface: "朋友", reading: "peng2 you3", meaning: "友達", pos: "名詞" },
  { lang: "zh", surface: "咖啡", reading: "ka1 fei1", meaning: "コーヒー", pos: "名詞" },
  { lang: "zh", surface: "相機", reading: "xiang4 ji1", meaning: "カメラ", pos: "名詞" },
  { lang: "zh", surface: "現在", reading: "xian4 zai4", meaning: "今", pos: "副詞" },
  { lang: "zh", surface: "可以", reading: "ke3 yi3", meaning: "できる / してもよい", pos: "助動詞" },
  { lang: "hi", surface: "कल", reading: "kal", meaning: "明日 / 昨日", pos: "副詞" },
  { lang: "hi", surface: "जल्दी", reading: "jaldi", meaning: "早く", pos: "副詞" },
  { lang: "hi", surface: "उठना", reading: "uthna", meaning: "起きる", pos: "動詞" },
  { lang: "hi", surface: "चाहिए", reading: "chahiye", meaning: "必要だ", pos: "助動詞" },
  { lang: "hi", surface: "कॉफी", reading: "coffee", meaning: "コーヒー", pos: "名詞" },
  { lang: "hi", surface: "घर", reading: "ghar", meaning: "家", pos: "名詞" },
  { lang: "hi", surface: "पानी", reading: "pani", meaning: "水", pos: "名詞" },
  { lang: "hi", surface: "पसंद", reading: "pasand", meaning: "好き", pos: "名詞" },
  { lang: "es", surface: "mañana", reading: "tomorrow", meaning: "明日", pos: "副詞" },
  { lang: "es", surface: "levantarse", reading: "to get up", meaning: "起きる", pos: "動詞" },
  { lang: "es", surface: "temprano", reading: "early", meaning: "早く", pos: "副詞" },
  { lang: "es", surface: "casa", reading: "house", meaning: "家", pos: "名詞" },
  { lang: "es", surface: "ahora", reading: "now", meaning: "今", pos: "副詞" },
  { lang: "es", surface: "quiero", reading: "I want", meaning: "欲しい", pos: "動詞" },
  { lang: "es", surface: "café", reading: "coffee", meaning: "コーヒー", pos: "名詞" },
  { lang: "es", surface: "amigo", reading: "friend", meaning: "友達", pos: "名詞" },
];
