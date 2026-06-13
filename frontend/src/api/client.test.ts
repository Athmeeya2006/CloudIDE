import { describe, it, expect } from 'vitest';
import { rawFileUrl } from './client';

describe('rawFileUrl', () => {
  it('builds a same-origin raw URL for a workspace path', () => {
    expect(rawFileUrl('default/index.html')).toBe('/api/files/raw/default/index.html');
  });

  it('URL-encodes each path segment and drops empty parts', () => {
    expect(rawFileUrl('default//my dir/a b.html'))
      .toBe('/api/files/raw/default/my%20dir/a%20b.html');
  });
});
