export type CompareLensId =
  | "plan"
  | "area"
  | "flow"
  | "daylight"
  | "structure"
  | "furniture"
  | "systems"
  | "diff";

export interface CompareLensDefinition {
  id: CompareLensId;
  label: string;
  description: string;
  requiresPair?: boolean;
}
