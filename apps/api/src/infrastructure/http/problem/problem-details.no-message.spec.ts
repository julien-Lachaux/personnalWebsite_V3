import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { toProblemDetails } from './problem-details.js';

describe('toProblemDetails : HttpException sans message exploitable', () => {
  it('une réponse absente (undefined) donne un problème sans champ detail, sans lever', () => {
    const exception = new HttpException(undefined as never, 500);

    expect(toProblemDetails(exception, '/api/v1/x')).toStrictEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      instance: '/api/v1/x',
    });
  });

  it('une réponse objet sans clé message donne un problème sans champ detail', () => {
    const exception = new HttpException({ code: 'X' }, 503);

    expect(toProblemDetails(exception, '/api/v1/x')).toStrictEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      instance: '/api/v1/x',
    });
  });
});
