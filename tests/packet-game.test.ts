import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultQuestion } from '../shared/model.js';
import { drawPrize, rainPrizes, swipeHitsRect } from '../src/lib/packet-game.js';

test('packet rewards use all three denominations from the submitted question snapshot', () => {
  const rules = { ...defaultQuestion.rules, fixedValue: 168, secondValue: 36, thirdValue: 9 };
  const prizes = rainPrizes(rules);
  assert.deepEqual(
    prizes.map((p) => [p.name, p.value]),
    [
      ['超级免单券', 168],
      ['二等奖', 36],
      ['三等奖', 9],
    ],
  );
  rules.fixedValue = 999;
  assert.equal(prizes[0].value, 168);
  assert.equal(
    rainPrizes({ ...rules, fixedCount: 0 }).some((p) => p.kind === 'fixed'),
    false,
  );
});

test('random reward selection can reach each tier and works when only two tiers exist', () => {
  const prizes = rainPrizes(defaultQuestion.rules);
  assert.equal(drawPrize(prizes, 0).kind, 'fixed');
  assert.equal(drawPrize(prizes, 1 / 3).kind, 'second');
  assert.equal(drawPrize(prizes, 2 / 3).kind, 'third');
  assert.equal(drawPrize(prizes, 0.99999).kind, 'third');
  const two = rainPrizes({ ...defaultQuestion.rules, fixedCount: 0 });
  assert.equal(drawPrize(two, 0).kind, 'second');
  assert.equal(drawPrize(two, 0.99999).kind, 'third');
});

test('a fast swipe opens packets along its full path, including reversed and stationary gestures', () => {
  const rect = { left: 100, right: 150, top: 100, bottom: 150 };
  assert.equal(swipeHitsRect({ x: 0, y: 125 }, { x: 300, y: 125 }, rect), true);
  assert.equal(swipeHitsRect({ x: 300, y: 125 }, { x: 0, y: 125 }, rect), true);
  assert.equal(swipeHitsRect({ x: 125, y: 0 }, { x: 125, y: 300 }, rect), true);
  assert.equal(swipeHitsRect({ x: 125, y: 125 }, { x: 125, y: 125 }, rect), true);
});

test('hit detection rejects near misses and diagonal bounding-box false positives; touch padding is forgiving', () => {
  const rect = { left: 100, right: 150, top: 100, bottom: 150 };
  assert.equal(swipeHitsRect({ x: 0, y: 90 }, { x: 300, y: 90 }, rect), false);
  assert.equal(swipeHitsRect({ x: 0, y: 90 }, { x: 300, y: 90 }, rect, 14), true);
  assert.equal(swipeHitsRect({ x: 0, y: 0 }, { x: 150, y: 90 }, rect), false);
  assert.equal(swipeHitsRect({ x: 0, y: 90 }, { x: 110, y: 200 }, rect), false);
  assert.equal(swipeHitsRect({ x: 0, y: 0 }, { x: 300, y: 300 }, rect), true);
});
