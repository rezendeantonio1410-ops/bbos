import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinishedGoodsBalance } from '../dist/inventory-engine.js';

test('estoque disponível desconta reserva sem alterar físico', () => {
  assert.deepEqual(calculateFinishedGoodsBalance(184, 24), {
    physicalUnits: 184,
    reservedUnits: 24,
    availableUnits: 160,
  });
});

test('variantes mantêm saldos independentes', () => {
  const variant500g = calculateFinishedGoodsBalance(184, 10);
  const variant1kg = calculateFinishedGoodsBalance(72, 2);
  assert.equal(variant500g.availableUnits, 174);
  assert.equal(variant1kg.availableUnits, 70);
});

test('reserva maior que o físico é rejeitada', () => {
  assert.throws(() => calculateFinishedGoodsBalance(10, 11), /não pode superar/);
});

test('saldos negativos ou fracionários são rejeitados', () => {
  assert.throws(() => calculateFinishedGoodsBalance(-1, 0));
  assert.throws(() => calculateFinishedGoodsBalance(10.5, 0));
});
