/**
 * LeanAI journey context is product assistance, not worker surveillance.
 *
 * Persist only bounded semantic events needed to:
 * - improve setup assistance
 * - avoid repetitive prompts
 * - provide relevant contextual help
 *
 * Do not record raw DOM clicks, mouse coordinates, hover durations,
 * keystrokes, deleted text, page-dwell surveillance, or employee
 * productivity measurements. Do not expose admin reports such as
 * "this person dismissed N prompts".
 */

export const LEANAI_JOURNEY_PURPOSE = [
  "setup_assistance",
  "prompt_cooldown",
  "contextual_help",
] as const;

export const LEANAI_FORBIDDEN_SURVEILLANCE_USES = [
  "employee_productivity_score",
  "employee_ranking",
  "disciplinary_profile",
  "time_at_screen",
  "behavioural_performance_monitoring",
] as const;

export const LEANAI_FORBIDDEN_METADATA_KEYS = [
  "mouse",
  "hover",
  "keystroke",
  "keystrokes",
  "click",
  "clicks",
  "coordinates",
  "x",
  "y",
  "dwell_ms",
  "dwell",
  "password",
  "secret",
  "token",
  "api_key",
  "content",
  "body",
  "transcript",
  "deleted_text",
] as const;
