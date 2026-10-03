import { toPositiveInt } from './helper';

describe('toPositiveInt', () => {
  test('parses a positive integer string', () => {
    expect(toPositiveInt('250', 100)).toBe(250);
  });

  test.each([undefined, null, '', 'abc', '0', '-5', '1.5'])(
    'falls back for %p',
    (value) => {
      expect(toPositiveInt(value, 100)).toBe(100);
    },
  );
});
