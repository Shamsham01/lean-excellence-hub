import { manufacturingTrainingStarterPack } from "./manufacturing";
import {
  TRAINING_STARTER_PACK_KEYS,
  type TrainingStarterPack,
  type TrainingStarterPackKey,
} from "./types";

const PACKS: Record<TrainingStarterPackKey, TrainingStarterPack> = {
  "leh-manufacturing-training-starter": manufacturingTrainingStarterPack,
};

export function listTrainingStarterPacks(): TrainingStarterPack[] {
  return TRAINING_STARTER_PACK_KEYS.map((key) => PACKS[key]);
}

export function requireTrainingStarterPack(key: string): TrainingStarterPack {
  if (!isTrainingStarterPackKey(key)) {
    throw new Error("Unknown training starter pack.");
  }
  return PACKS[key];
}

export function isTrainingStarterPackKey(
  key: string,
): key is TrainingStarterPackKey {
  return (TRAINING_STARTER_PACK_KEYS as readonly string[]).includes(key);
}

export function starterPackRoleTitles(pack: TrainingStarterPack): string[] {
  return pack.suggestedRoles.map((role) => role.title);
}
