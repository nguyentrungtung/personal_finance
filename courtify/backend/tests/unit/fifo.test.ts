import { describe, it, expect } from 'vitest';
import { fifoMatch } from '../../src/lib/fifo.js';
import type { FifoLot } from '../../src/lib/fifo.js';

const makeLot = (id: number, remainingVolume: number, buyPricePerUnit: number, purchaseDate: string): FifoLot => ({
  id, remainingVolume, buyPricePerUnit, purchaseDate,
});

describe('fifoMatch', () => {
  it('single-lot exact fill', () => {
    const lots = [makeLot(1, 100, 90000, '2026-01-01')];
    const result = fifoMatch(lots, 100);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ lotId: 1, volumeConsumed: 100, lotBuyPrice: 90000 });
  });

  it('single-lot partial fill', () => {
    const lots = [makeLot(1, 100, 90000, '2026-01-01')];
    const result = fifoMatch(lots, 60);
    expect(result[0].volumeConsumed).toBe(60);
  });

  it('multi-lot spill-over consumes oldest first', () => {
    const lots = [
      makeLot(2, 50, 100000, '2026-02-01'),
      makeLot(1, 50, 90000, '2026-01-01'),
    ];
    const result = fifoMatch(lots, 80);
    expect(result[0].lotId).toBe(1); // oldest first
    expect(result[0].volumeConsumed).toBe(50);
    expect(result[1].lotId).toBe(2);
    expect(result[1].volumeConsumed).toBe(30);
  });

  it('insufficient volume throws BusinessRuleError', () => {
    const lots = [makeLot(1, 50, 90000, '2026-01-01')];
    expect(() => fifoMatch(lots, 100)).toThrow();
  });

  it('FIFO ordering enforced by purchaseDate ASC', () => {
    const lots = [
      makeLot(3, 10, 300, '2026-03-01'),
      makeLot(1, 10, 100, '2026-01-01'),
      makeLot(2, 10, 200, '2026-02-01'),
    ];
    const result = fifoMatch(lots, 15);
    expect(result[0].lotId).toBe(1);
    expect(result[0].volumeConsumed).toBe(10);
    expect(result[1].lotId).toBe(2);
    expect(result[1].volumeConsumed).toBe(5);
  });

  it('realized_pnl per segment = (sellPrice − lotBuyPrice) × volume [computed by caller]', () => {
    const lots = [makeLot(1, 100, 90000, '2026-01-01')];
    const sellPrice = 110000;
    const result = fifoMatch(lots, 50);
    const pnl = (sellPrice - result[0].lotBuyPrice) * result[0].volumeConsumed;
    expect(pnl).toBe(1000000); // (110000 - 90000) * 50
  });

  it('empty lots array throws when sellVolume > 0', () => {
    expect(() => fifoMatch([], 10)).toThrow();
  });

  it('zero sellVolume returns empty array', () => {
    const lots = [makeLot(1, 100, 90000, '2026-01-01')];
    const result = fifoMatch(lots, 0);
    expect(result).toHaveLength(0);
  });
});
