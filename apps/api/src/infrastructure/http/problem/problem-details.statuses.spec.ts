import { describe, expect, it } from 'vitest';

import { titleFor, toProblemDetails } from './problem-details.js';

describe('titleFor : statuts RFC 9110 restants', () => {
  it.each([
    [406, 'Not Acceptable'],
    [413, 'Payload Too Large'],
    [415, 'Unsupported Media Type'],
    [422, 'Unprocessable Content'],
    [501, 'Not Implemented'],
  ])('statut %i : %s', (status, title) => {
    expect(titleFor(status)).toBe(title);
  });
});

describe('toProblemDetails : erreurs techniques', () => {
  it('donne le délai imparti comme détail du 503 de dépassement de délai', () => {
    const timeout = Object.assign(new Error('Request timed out'), {
      code: 'FST_ERR_HANDLER_TIMEOUT',
    });

    expect(toProblemDetails(timeout, '/api/v1/cv')).toStrictEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Le traitement de la requête a dépassé le délai imparti.',
      instance: '/api/v1/cv',
    });
  });

  it.each(['FST_ERR_AUTRE', 'ECONNRESET', ''])(
    'un code %j n’est pas un dépassement de délai : 500 générique',
    (code) => {
      const error = Object.assign(new Error('secret'), { code });

      expect(toProblemDetails(error, '/x')).toMatchObject({
        status: 500,
        detail: 'Une erreur interne est survenue.',
      });
    },
  );

  it('une erreur dont le statusCode est exactement 500 ne fuit pas son message', () => {
    const error = Object.assign(new Error('secret interne'), { statusCode: 500 });

    const problem = toProblemDetails(error, '/x');

    expect(problem.status).toBe(500);
    expect(problem.detail).toBe('Une erreur interne est survenue.');
  });

  it.each([400, 404, 413, 429, 499])('une erreur Fastify %i garde son statut', (statusCode) => {
    const error = Object.assign(new Error('Message public'), { statusCode });

    expect(toProblemDetails(error, '/x')).toMatchObject({
      status: statusCode,
      detail: 'Message public',
    });
  });
});
