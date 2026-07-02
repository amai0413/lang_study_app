import { getCurriculum } from "@/data/curriculum";
import type { Level, TargetLanguage } from "@/types/question";
import { loadMastery } from "./masteryStore";

export const LEVEL_ORDER: Level[] = ["A1", "A2", "B1", "B2"];

const REQUIRED_ATTEMPTS: Record<Level, number> = {
  A1: 6,
  A2: 8,
  B1: 10,
  B2: 12,
};

const REQUIRED_DISTINCT_ITEMS: Record<Level, number> = {
  A1: 4,
  A2: 5,
  B1: 6,
  B2: 7,
};

const PASS_ACCURACY = 0.72;

export interface LevelProgress {
  level: Level;
  attempts: number;
  correct: number;
  accuracy: number;
  attemptedItems: number;
  requiredAttempts: number;
  requiredItems: number;
  readiness: number;
  passed: boolean;
}

export interface LearningProgress {
  level: Level;
  score: number;
  accuracy: number;
  attempts: number;
  correct: number;
  readiness: number;
  passedLevels: number;
  levels: LevelProgress[];
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max);
}

function levelProgress(language: TargetLanguage, level: Level): LevelProgress {
  const mastery = loadMastery();
  const items = getCurriculum(language, level);
  const itemIds = new Set(items.map((item) => item.id));
  const records = Object.values(mastery).filter((record) => itemIds.has(record.grammarItemId));
  const attempts = records.reduce((sum, record) => sum + record.attempts, 0);
  const correct = records.reduce((sum, record) => sum + record.correct, 0);
  const accuracy = attempts > 0 ? correct / attempts : 0;
  const attemptedItems = records.filter((record) => record.attempts > 0).length;
  const requiredAttempts = REQUIRED_ATTEMPTS[level];
  const requiredItems = Math.min(REQUIRED_DISTINCT_ITEMS[level], Math.max(items.length, 1));

  const coverageProgress = clamp(attemptedItems / requiredItems);
  const attemptProgress = clamp(attempts / requiredAttempts);
  const accuracyProgress = attempts > 0 ? clamp(accuracy / PASS_ACCURACY) : 0;
  const readiness = Math.round(
    (accuracyProgress * 0.55 + coverageProgress * 0.3 + attemptProgress * 0.15) * 100,
  );
  const passed =
    attempts >= requiredAttempts && attemptedItems >= requiredItems && accuracy >= PASS_ACCURACY;

  return {
    level,
    attempts,
    correct,
    accuracy,
    attemptedItems,
    requiredAttempts,
    requiredItems,
    readiness: passed ? 100 : Math.min(readiness, 99),
    passed,
  };
}

export function getLearningProgress(language: TargetLanguage): LearningProgress {
  const levels = LEVEL_ORDER.map((level) => levelProgress(language, level));
  const activeIndex = levels.findIndex((level) => !level.passed);
  const index = activeIndex === -1 ? LEVEL_ORDER.length - 1 : activeIndex;
  const active = levels[index];
  const allPassed = activeIndex === -1;
  const passedLevels = levels.filter((level) => level.passed).length;
  const score = allPassed
    ? 1000
    : Math.min(999, index * 250 + Math.round((active.readiness / 100) * 250));

  return {
    level: active.level,
    score,
    accuracy: active.accuracy,
    attempts: active.attempts,
    correct: active.correct,
    readiness: active.readiness,
    passedLevels,
    levels,
  };
}
