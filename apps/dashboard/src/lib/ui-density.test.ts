import { describe, expect, test } from 'vitest';
import { cardContentClass, cardHeaderClass } from './ui-density';

describe('ui-density', () => {
  test('exports compact card classes', () => {
    expect(cardHeaderClass).toContain('py-');
    expect(cardContentClass).toContain('pt-');
  });
});
