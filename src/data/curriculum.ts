import type { Level, TargetLanguage } from "@/types/question";

export interface GrammarItem {
  id: string;
  language: TargetLanguage;
  level: Level;
  name: string;
  pattern: string;
  summary: string;
  exampleJa: string;
  exampleTarget: string;
}

// CEFR レベル別の文法・構文カリキュラム。
// 新しい項目を足すときはこの配列に追加するだけでよい（出題AIが自動で参照する）。
// ここは "たたき台"。ChatGPT 等で作った網羅的カリキュラムに差し替え/追記できる。
export const curriculum: GrammarItem[] = [
  // ───────── 中国語 A1 ─────────
  { id: "zh-a1-svo", language: "zh", level: "A1", name: "基本文型 SVO", pattern: "主語 + 動詞 + 目的語", summary: "主語＋動詞＋目的語の基本語順。助詞は不要。", exampleJa: "私はお茶を飲みます。", exampleTarget: "我喝茶。" },
  { id: "zh-a1-shi", language: "zh", level: "A1", name: "是構文（A は B）", pattern: "A + 是 + B", summary: "「〜です」の名詞述語。是で名詞と名詞を結ぶ。", exampleJa: "私は学生です。", exampleTarget: "我是學生。" },
  { id: "zh-a1-like", language: "zh", level: "A1", name: "喜歡構文", pattern: "主語 + 喜歡 + 名詞", summary: "「〜が好き」。喜歡は動詞なので是は不要。", exampleJa: "私は猫が好きです。", exampleTarget: "我喜歡貓。" },
  { id: "zh-a1-you", language: "zh", level: "A1", name: "有構文（所有・存在）", pattern: "主語 + 有 + 名詞", summary: "「〜を持っている／ある」。否定は没有。", exampleJa: "私は本を持っています。", exampleTarget: "我有一本書。" },
  { id: "zh-a1-ma", language: "zh", level: "A1", name: "諾否疑問文 嗎", pattern: "平叙文 + 嗎", summary: "文末に嗎を付けて「〜ですか」。語順は平叙文のまま。", exampleJa: "あなたはお茶を飲みますか。", exampleTarget: "你喝茶嗎？" },
  { id: "zh-a1-zai", language: "zh", level: "A1", name: "在（場所）", pattern: "主語 + 在 + 場所", summary: "「〜にいる／ある」。在で所在を表す。", exampleJa: "私は家にいます。", exampleTarget: "我在家。" },

  // ───────── 中国語 A2 ─────────
  { id: "zh-a2-xiang", language: "zh", level: "A2", name: "想（〜したい）", pattern: "主語 + 想 + 動詞", summary: "願望「〜したい」。想＋動詞。", exampleJa: "私は中国に行きたいです。", exampleTarget: "我想去中國。" },
  { id: "zh-a2-le", language: "zh", level: "A2", name: "完了の了", pattern: "動詞 + 了", summary: "動作の完了・実現を表す。", exampleJa: "私はご飯を食べました。", exampleTarget: "我吃飯了。" },
  { id: "zh-a2-hui", language: "zh", level: "A2", name: "会/能（できる）", pattern: "主語 + 會/能 + 動詞", summary: "習得した能力は會、条件的な可能は能。", exampleJa: "私は中国語が話せます。", exampleTarget: "我會說中文。" },
  { id: "zh-a2-de", language: "zh", level: "A2", name: "的（所有・修飾）", pattern: "名詞 + 的 + 名詞", summary: "「〜の」。所有や修飾関係を作る。", exampleJa: "これは私の本です。", exampleTarget: "這是我的書。" },
  { id: "zh-a2-zheng", language: "zh", level: "A2", name: "正在（進行）", pattern: "主語 + 正在 + 動詞", summary: "「〜している」進行中の動作。", exampleJa: "私は今勉強しています。", exampleTarget: "我正在學習。" },
  { id: "zh-a2-yinwei", language: "zh", level: "A2", name: "因為…所以（理由）", pattern: "因為 A，所以 B", summary: "「AなのでB」。理由と結果。", exampleJa: "雨なので家にいます。", exampleTarget: "因為下雨，所以我在家。" },

  // ───────── 中国語 B1 ─────────
  { id: "zh-b1-bi", language: "zh", level: "B1", name: "比較の比", pattern: "A + 比 + B + 形容詞", summary: "「AはBより〜」。比で比較。", exampleJa: "彼は私より背が高いです。", exampleTarget: "他比我高。" },
  { id: "zh-b1-ba", language: "zh", level: "B1", name: "把構文", pattern: "主語 + 把 + 目的語 + 処置", summary: "目的語を前に出し、それをどう処置したかを述べる。", exampleJa: "私は本を机に置きました。", exampleTarget: "我把書放在桌上。" },
  { id: "zh-b1-guo", language: "zh", level: "B1", name: "経験の過", pattern: "動詞 + 過", summary: "「〜したことがある」経験。", exampleJa: "私は中国に行ったことがあります。", exampleTarget: "我去過中國。" },
  { id: "zh-b1-ruguo", language: "zh", level: "B1", name: "如果…就（仮定）", pattern: "如果 A，就 B", summary: "「もしAならB」。仮定条件。", exampleJa: "時間があれば行きます。", exampleTarget: "如果有時間，我就去。" },
  { id: "zh-b1-suiran", language: "zh", level: "B1", name: "雖然…但是（逆接）", pattern: "雖然 A，但是 B", summary: "「AだけれどもB」。逆接。", exampleJa: "忙しいですが行きます。", exampleTarget: "雖然很忙，但是我會去。" },

  // ───────── 中国語 B2 ─────────
  { id: "zh-b2-bei", language: "zh", level: "B2", name: "被構文（受身）", pattern: "受事 + 被 + 動作主 + 動詞", summary: "「〜される」受身。", exampleJa: "本は彼に持って行かれました。", exampleTarget: "書被他拿走了。" },
  { id: "zh-b2-budan", language: "zh", level: "B2", name: "不但…而且", pattern: "不但 A，而且 B", summary: "「AだけでなくB」累加。", exampleJa: "彼は頭がいいだけでなく親切です。", exampleTarget: "他不但聰明，而且很親切。" },
  { id: "zh-b2-yuelai", language: "zh", level: "B2", name: "越來越（ますます）", pattern: "越來越 + 形容詞", summary: "「だんだん〜になる」。", exampleJa: "天気がますます暑くなります。", exampleTarget: "天氣越來越熱。" },
  { id: "zh-b2-chule", language: "zh", level: "B2", name: "除了…以外", pattern: "除了 A 以外，還/都 B", summary: "「A以外に／Aを除いて」。", exampleJa: "彼以外はみんな来ました。", exampleTarget: "除了他以外，大家都來了。" },
  { id: "zh-b2-shide", language: "zh", level: "B2", name: "是…的（強調）", pattern: "是 + 焦点 + 的", summary: "既に起きた動作の時・場所・方法を強調。", exampleJa: "私は電車で来ました。", exampleTarget: "我是坐火車來的。" },

  // ───────── ヒンディー語 A1 ─────────
  { id: "hi-a1-hona", language: "hi", level: "A1", name: "होना（〜です）", pattern: "यह/वह + 名詞 + है", summary: "「〜だ／である」。honaの現在形。", exampleJa: "これは本です。", exampleTarget: "यह किताब है।" },
  { id: "hi-a1-pasand", language: "hi", level: "A1", name: "पसंद है（好き）", pattern: "[人]को + [もの] + पसंद है", summary: "「〜が好き」。पसंदは名詞、主語はकोを取る。", exampleJa: "私は猫が好きです。", exampleTarget: "मुझे बिल्ली पसंद है।" },
  { id: "hi-a1-chahiye", language: "hi", level: "A1", name: "चाहिए（必要・欲しい）", pattern: "[人]को + [もの] + चाहिए", summary: "「〜が必要／欲しい」。", exampleJa: "私は水が欲しいです。", exampleTarget: "मुझे पानी चाहिए।" },
  { id: "hi-a1-present", language: "hi", level: "A1", name: "現在習慣", pattern: "主語 + 動詞語幹 + ता/ती + हूँ/है", summary: "「〜する」習慣的現在。性・数で語尾変化。", exampleJa: "私は毎日お茶を飲みます。", exampleTarget: "मैं रोज़ चाय पीता हूँ।" },
  { id: "hi-a1-mein", language: "hi", level: "A1", name: "後置詞 में（場所）", pattern: "場所 + में", summary: "「〜の中に／で」。位置を表す後置詞。", exampleJa: "私は家にいます。", exampleTarget: "मैं घर में हूँ।" },
  { id: "hi-a1-kepas", language: "hi", level: "A1", name: "के पास（所有）", pattern: "[人]के पास + もの + है", summary: "「〜を持っている」所有。", exampleJa: "私は本を持っています。", exampleTarget: "मेरे पास किताब है।" },

  // ───────── ヒンディー語 A2 ─────────
  { id: "hi-a2-future", language: "hi", level: "A2", name: "未来形", pattern: "主語 + 語幹 + ूँगा/ूँगी", summary: "「〜するつもり／だろう」未来。", exampleJa: "私は明日行きます。", exampleTarget: "मैं कल जाऊँगा।" },
  { id: "hi-a2-sakna", language: "hi", level: "A2", name: "सकना（できる）", pattern: "主語 + 語幹 + सकता/सकती है", summary: "「〜できる」可能。", exampleJa: "私はヒンディー語が話せます。", exampleTarget: "मैं हिंदी बोल सकता हूँ।" },
  { id: "hi-a2-kya", language: "hi", level: "A2", name: "क्या（諾否疑問）", pattern: "क्या + 平叙文", summary: "文頭のक्याで「〜ですか」。", exampleJa: "あなたはお茶を飲みますか。", exampleTarget: "क्या आप चाय पीते हैं?" },
  { id: "hi-a2-continuous", language: "hi", level: "A2", name: "現在進行", pattern: "主語 + 語幹 + रहा/रही + है", summary: "「〜している」進行中。", exampleJa: "私は勉強しています。", exampleTarget: "मैं पढ़ रहा हूँ।" },
  { id: "hi-a2-chahna", language: "hi", level: "A2", name: "चाहना（〜したい）", pattern: "主語 + 動詞原形 + चाहता/चाहती है", summary: "「〜したい」願望。", exampleJa: "私は中国に行きたいです。", exampleTarget: "मैं चीन जाना चाहता हूँ।" },
  { id: "hi-a2-se", language: "hi", level: "A2", name: "比較 से ज़्यादा", pattern: "A + B से ज़्यादा + 形容詞", summary: "「AはBより〜」比較。", exampleJa: "彼は私より背が高いです。", exampleTarget: "वह मुझसे ज़्यादा लंबा है।" },

  // ───────── ヒンディー語 B1 ─────────
  { id: "hi-b1-agar", language: "hi", level: "B1", name: "अगर…तो（仮定）", pattern: "अगर A तो B", summary: "「もしAならB」仮定。", exampleJa: "時間があれば行きます。", exampleTarget: "अगर समय होगा तो मैं जाऊँगा।" },
  { id: "hi-b1-kyunki", language: "hi", level: "B1", name: "क्योंकि（理由）", pattern: "B क्योंकि A", summary: "「BなぜならA」理由。", exampleJa: "雨なので家にいます。", exampleTarget: "मैं घर में हूँ क्योंकि बारिश हो रही है।" },
  { id: "hi-b1-jab", language: "hi", level: "B1", name: "जब…तब（〜のとき）", pattern: "जब A तब B", summary: "「AのときB」時の従属節。", exampleJa: "子供のとき、私は北京に住んでいました。", exampleTarget: "जब मैं बच्चा था, तब मैं बीजिंग में रहता था।" },
  { id: "hi-b1-jo", language: "hi", level: "B1", name: "関係詞 जो…वह", pattern: "जो A, वह B", summary: "「〜する人／ものは…」関係詞。", exampleJa: "あそこにいる人は私の友達です。", exampleTarget: "जो वहाँ है, वह मेरा दोस्त है।" },
  { id: "hi-b1-ne", language: "hi", level: "B1", name: "過去の ने（能格）", pattern: "主語 + ने + 目的語 + 過去分詞", summary: "他動詞の完了過去で主語にनेを付ける。動詞は目的語に一致。", exampleJa: "私は本を読みました。", exampleTarget: "मैंने किताब पढ़ी।" },

  // ───────── ヒンディー語 B2 ─────────
  { id: "hi-b2-passive", language: "hi", level: "B2", name: "受身（जाना）", pattern: "過去分詞 + जाता/जाती है", summary: "「〜される」受身。", exampleJa: "ここではヒンディー語が話されます。", exampleTarget: "यहाँ हिंदी बोली जाती है।" },
  { id: "hi-b2-halanki", language: "hi", level: "B2", name: "हालाँकि…फिर भी（逆接）", pattern: "हालाँकि A, फिर भी B", summary: "「AだけれどもやはりB」逆接。", exampleJa: "忙しいですが行きます。", exampleTarget: "हालाँकि मैं व्यस्त हूँ, फिर भी मैं जाऊँगा।" },
  { id: "hi-b2-compound", language: "hi", level: "B2", name: "複合動詞（लेना/देना）", pattern: "語幹 + लेना/देना", summary: "動作の完遂や方向を補助動詞で表す。", exampleJa: "私はその本を読み終えました。", exampleTarget: "मैंने वह किताब पढ़ ली।" },
  { id: "hi-b2-wajah", language: "hi", level: "B2", name: "की वजह से（〜のせいで）", pattern: "名詞 + की वजह से", summary: "「〜が原因で」理由。", exampleJa: "雨のせいで遅れました。", exampleTarget: "बारिश की वजह से मुझे देर हो गई।" },
  { id: "hi-b2-causative", language: "hi", level: "B2", name: "使役（करवाना）", pattern: "語幹 + वाना", summary: "「〜させる／してもらう」使役。", exampleJa: "私は髪を切ってもらいました。", exampleTarget: "मैंने बाल कटवाए।" },
];

const LEVEL_ORDER: Level[] = ["A1", "A2", "B1", "B2"];

export function getCurriculum(language: TargetLanguage, level: Level): GrammarItem[] {
  return curriculum.filter((g) => g.language === language && g.level === level);
}

/** 指定レベル以下（復習対象）の文法項目 */
export function getCurriculumUpTo(language: TargetLanguage, level: Level): GrammarItem[] {
  const maxIdx = LEVEL_ORDER.indexOf(level);
  return curriculum.filter(
    (g) => g.language === language && LEVEL_ORDER.indexOf(g.level) <= maxIdx,
  );
}

export function getGrammarItem(id: string): GrammarItem | undefined {
  return curriculum.find((g) => g.id === id);
}
