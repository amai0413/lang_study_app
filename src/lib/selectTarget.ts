import type { Level, TargetLanguage } from "@/types/question";
import { getCurriculum, getCurriculumUpTo, type GrammarItem } from "@/data/curriculum";
import { getWeakItems } from "./masteryStore";
import { getForgottenWords, type WordRecord } from "./wordStore";

export interface QuizTarget {
  item: GrammarItem;
  isReview: boolean; // 弱点文法の復習出題か
  reviewWord?: WordRecord; // 忘れた単語を混ぜる場合
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 出題する文法項目を選ぶ。
 * - 一定確率で「弱点文法（レベル以下）」を復習出題
 * - それ以外は現在レベルの文法からランダム
 * - 一定確率で「忘れた単語」を1つ混ぜるヒントを付与
 */
export function selectTarget(language: TargetLanguage, level: Level): QuizTarget {
  const levelItems = getCurriculum(language, level);
  const reviewPool = getCurriculumUpTo(language, level);
  const weak = getWeakItems(reviewPool);

  let item: GrammarItem;
  let isReview = false;

  if (weak.length > 0 && Math.random() < 0.35) {
    item = pick(weak);
    isReview = true;
  } else if (levelItems.length > 0) {
    item = pick(levelItems);
  } else {
    // そのレベルに項目がなければ全レベルから
    item = pick(reviewPool.length > 0 ? reviewPool : getCurriculumUpTo(language, "B2"));
  }

  let reviewWord: WordRecord | undefined;
  const forgotten = getForgottenWords(language);
  if (forgotten.length > 0 && Math.random() < 0.25) {
    reviewWord = forgotten[0]; // 最も古く間違えた単語
  }

  return { item, isReview, reviewWord };
}
