import { genId } from './utils';

test('genId always returns a database-compatible UUID', () => {
  expect(genId()).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
});
