import { describe, expect, it } from 'vitest';
import { contentPackageSchema } from '../lib/content-schema';
import example from '../examples/content-packs/empty-platform.json';

describe('contentPackageSchema', () => {
  it('accepts the documented example pack', () => {
    const result = contentPackageSchema.parse(example);
    expect(result.schemaVersion).toBe('1.0');
    expect(result.cast[0].kind).toBe('mob');
  });
  it('rejects unsupported schema versions', () => {
    expect(() =>
      contentPackageSchema.parse({ ...example, schemaVersion: '2.0' }),
    ).toThrow();
  });
  it('rejects out-of-range game values', () => {
    expect(() =>
      contentPackageSchema.parse({
        ...example,
        cast: [{ ...example.cast[0], hp: 1000 }],
      }),
    ).toThrow();
  });
});
