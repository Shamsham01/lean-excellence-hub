export const LEH_OPERATIONAL_GEMBA_WALK_KEY =
  "leh-operational-gemba-walk" as const;

export const LEH_OPERATIONAL_GEMBA_WALK_VERSION = 1 as const;

export const LEH_OPERATIONAL_GEMBA_WALK_DURATION_MINUTES = 45 as const;

export type GembaTemplatePrompt = {
  prompt: string;
  guidance?: string;
};

export type GembaTemplateSection = {
  name: string;
  description: string;
  prompts: readonly GembaTemplatePrompt[];
};

export type GembaQuickStartTemplate = {
  key: typeof LEH_OPERATIONAL_GEMBA_WALK_KEY;
  version: number;
  name: string;
  description: string;
  notes: string;
  expectedDurationMinutes: number;
  sections: readonly GembaTemplateSection[];
};

export type GembaTemplateCounts = {
  sections: number;
  prompts: number;
};

export type GembaDraftDefinition = {
  key: string;
  name: string;
  description: string;
  expectedDurationMinutes: number | null;
  sections: Array<{
    name: string;
    prompts: Array<{
      prompt: string;
      helpText: string | null;
    }>;
  }>;
};
