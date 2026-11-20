import { describe, expect, it } from 'vitest';

import { CvSourceError } from './cv-source.js';

describe('CvSourceError', () => {
  it('porte la nature, le message, la cause et le statut', () => {
    const cause = new Error('origine');
    const error = new CvSourceError('http', 'HTTP 503', { cause, status: 503 });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CvSourceError');
    expect(error.kind).toBe('http');
    expect(error.message).toBe('HTTP 503');
    expect(error.status).toBe(503);
    expect(error.cause).toBe(cause);
  });

  it('n’a ni statut ni cause par défaut', () => {
    const error = new CvSourceError('config', 'absent');

    expect(error.kind).toBe('config');
    expect(error.status).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });
});
