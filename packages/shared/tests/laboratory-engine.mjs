import assert from 'node:assert/strict';
import { consolidateSensoryEvaluations, qualityDecisionTransition, sensoryIntelligence } from '../dist/laboratory-engine.js';
const result = consolidateSensoryEvaluations([
  { fragrance: 8, flavor: 9, finish: 8, acidity: 7, body: 8, sweetness: 9, uniformity: 10, cleanliness: 10, descriptors: ['Chocolate', 'Frutas'] },
  { fragrance: 8, flavor: 8, finish: 9, acidity: 7, body: 8, sweetness: 8, uniformity: 10, cleanliness: 10, descriptors: ['Chocolate'] },
]);
assert.equal(result.averages.flavor, 8.5);
assert.equal(result.score, 8.56);
assert.deepEqual(result.recurringDescriptors[0], { name: 'Chocolate', count: 2 });
assert.throws(() => consolidateSensoryEvaluations([]));
console.log('✔ consolidação sensorial calcula médias e descritores recorrentes');

assert.deepEqual(qualityDecisionTransition('APPROVED'), { lotStatus: 'APPROVED', sampleStatus: 'APPROVED', requiresReason: false });
assert.deepEqual(qualityDecisionTransition('RETEST_REQUIRED'), { lotStatus: 'QUALITY_REVIEW', sampleStatus: 'PENDING', requiresReason: true });
assert.deepEqual(qualityDecisionTransition('REJECTED'), { lotStatus: 'BLOCKED', sampleStatus: 'BLOCKED', requiresReason: true });

const intelligence = sensoryIntelligence([
  { sessionId: 'session-a', score: 84, descriptors: ['Chocolate', 'Caramelo'], acidityTypes: ['Cítrica'] },
  { sessionId: 'session-a', score: 86, descriptors: ['Chocolate'], acidityTypes: ['Málica'] },
  { sessionId: 'session-b', score: null, descriptors: ['Floral'], acidityTypes: [] },
]);
assert.equal(intelligence.scores.average, 85);
assert.equal(intelligence.sessionsConsidered, 2);
assert.deepEqual(intelligence.descriptors[0], { name: 'Chocolate', occurrences: 2 });
assert.equal(sensoryIntelligence([]).scores, null);
console.log('✔ decisões e inteligência sensorial preservam estados e dados reais');
