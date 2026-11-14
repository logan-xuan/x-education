import type { Rules } from '../../shared/model.js';

export interface RainPrize {
  kind: 'fixed' | 'second' | 'third';
  name: string;
  value: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface HitRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export const ROUND_SECONDS = 20;

export function rainPrizes(rules: Rules): RainPrize[] {
  return [
    ...(rules.fixedCount > 0
      ? [{ kind: 'fixed' as const, name: '超级免单券', value: rules.fixedValue }]
      : []),
    { kind: 'second', name: '二等奖', value: rules.secondValue },
    { kind: 'third', name: '三等奖', value: rules.thirdValue },
  ];
}
export function drawPrize(prizes: readonly RainPrize[], random = Math.random()): RainPrize {
  return prizes[Math.min(prizes.length - 1, Math.floor(random * prizes.length))];
}
// Test the full swipe so quick gestures cannot jump over packets between events.
export function swipeHitsRect(from: Point, to: Point, rect: HitRect, padding = 0): boolean {
  let enter = 0,
    leave = 1;
  for (const [start, end, low, high] of [
    [from.x, to.x, rect.left - padding, rect.right + padding],
    [from.y, to.y, rect.top - padding, rect.bottom + padding],
  ]) {
    const distance = end - start;
    if (distance === 0) {
      if (start < low || start > high) return false;
    } else {
      const first = (low - start) / distance,
        last = (high - start) / distance;
      enter = Math.max(enter, Math.min(first, last));
      leave = Math.min(leave, Math.max(first, last));
      if (enter > leave) return false;
    }
  }
  return true;
}
