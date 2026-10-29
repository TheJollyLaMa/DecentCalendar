import test from 'node:test';
import assert from 'node:assert/strict';
import { localValue, roundUp, durationLabel, monthGrid, withDay, sameDay } from '../decent-calendar-vanilla/js/when-picker.js';

test('localValue writes local wall time and keeps only non-zero seconds', () => {
  assert.equal(localValue(new Date(2026, 10, 3, 9, 5)), '2026-11-03T09:05');
  assert.equal(localValue(new Date(2026, 0, 1, 0, 0, 7)), '2026-01-01T00:00:07');
  assert.equal(new Date(localValue(new Date(2026, 10, 3, 9, 5))).getHours(), 9);
});

test('roundUp snaps to the next quarter hour and leaves exact boundaries', () => {
  assert.equal(localValue(roundUp(new Date(2026, 9, 28, 20, 34))), '2026-10-28T20:45');
  assert.equal(localValue(roundUp(new Date(2026, 9, 28, 23, 50))), '2026-10-29T00:00');
  assert.equal(localValue(roundUp(new Date(2026, 9, 28, 20, 45))), '2026-10-28T20:45');
});

test('durationLabel is compact', () => {
  assert.deepEqual([15, 60, 90, 120, 0].map(durationLabel), ['15m', '1h', '1h 30m', '2h', '0m']);
});

test('monthGrid covers six Sunday-first weeks including the whole month', () => {
  const grid = monthGrid(new Date(2026, 9, 15));
  assert.equal(grid.length, 42);
  assert.equal(grid[0].getDay(), 0);
  assert.equal(localValue(grid[0]).slice(0, 10), '2026-09-27');
  assert.ok(grid.some(day => sameDay(day, new Date(2026, 9, 1))));
  assert.ok(grid.some(day => sameDay(day, new Date(2026, 9, 31))));
});

test('withDay moves a time onto another day without changing the wall clock', () => {
  assert.equal(localValue(withDay(new Date(2026, 9, 28, 21, 15, 9), new Date(2026, 10, 8))), '2026-11-08T21:15:09');
});
