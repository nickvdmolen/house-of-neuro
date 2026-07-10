import { awardFromDb } from './useAwards';

test('hides persisted badge no-op claims from score history consumers', () => {
  const award = { id: 'award-1', amount: 50 };
  const noop = {
    id: 'noop-1',
    amount: 0,
    mutation_meta: { noop: true, requestedAmount: 50 },
  };

  expect(awardFromDb(award)).toBe(award);
  expect(awardFromDb(noop)).toBeNull();
});
