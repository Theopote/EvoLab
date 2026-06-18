export const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const round1 = (value: number) => Math.round(value * 10) / 10;
