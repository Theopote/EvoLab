export const COPILOT_SUPPORTED_OPERATION_TYPES = [
  "move_core",
  "shift_rooms",
  "widen_corridor",
  "align_wet_rooms",
  "update_room",
  "split_room",
  "merge_room",
  "add_opening",
  "resize_opening",
  "update_room_polygon",
  "add_room",
  "add_protrusion",
  "optimize_egress"
] as const;

export const COPILOT_FALLBACK_WARNING =
  "Copilot could not map this request to structured operations. A deterministic fallback proposal was generated instead.";

export function formatCopilotFallbackWarning(extra?: string) {
  const supported = COPILOT_SUPPORTED_OPERATION_TYPES.join(", ");

  return [COPILOT_FALLBACK_WARNING, `Supported operation types: ${supported}.`, extra]
    .filter(Boolean)
    .join(" ");
}
