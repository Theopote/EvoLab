export function isOfflineLlmMode() {
  return process.env.EVOLAB_OFFLINE_MODE === "true" || process.env.NEXT_PUBLIC_MOCK_MODE === "true";
}

export function isLlmAvailable() {
  if (isOfflineLlmMode()) {
    return false;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  return Boolean(key && key !== "your_key_here");
}
