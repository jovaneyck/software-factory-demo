import { describe, it, expect } from 'vitest';

describe('CI red check (temporary)', () => {
    it('fails on purpose', () => {
        expect(1).toBe(2);
    });
});
