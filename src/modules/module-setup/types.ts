export const MODULE_SETUP_MODES = ["manual", "quick_start", "leanai"] as const;

export type ModuleSetupMode = (typeof MODULE_SETUP_MODES)[number];

export type ModuleSetupModuleKey = "five_s" | "gemba";

/** Presentation contract. Domain modules keep their own rules and routes. */
export type ModuleSetupDescriptor = {
  moduleKey: ModuleSetupModuleKey;
  title: string;
  description: string;
  managePermission: string;
  manualHref: string;
  quickStartHref: string;
  leanAiHref: string;
  quickStartAvailable: boolean;
  leanAiAvailable: boolean;
  existingConfigurationCount: number;
  configurationNoun: "standard" | "definition";
};
