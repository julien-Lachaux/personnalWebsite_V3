import {
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProblemDetailsSchema } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { EntityNotFoundError } from '../../../domain/index.js';
import { titleFor, toProblemDetails } from './problem-details.js';

describe('titleFor', () => {
  it.each([
    [400, 'Bad Request'],
    [404, 'Not Found'],
    [405, 'Method Not Allowed'],
    [429, 'Too Many Requests'],
    [500, 'Internal Server Error'],
    [503, 'Service Unavailable'],
  ])('statut %i : %s', (status, title) => {
    expect(titleFor(status)).toBe(title);
  });

  it('retombe sur « Error » pour un statut inconnu', () => {
    expect(titleFor(418)).toBe('Error');
  });
});

describe('toProblemDetails', () => {
  it('produit toujours un corps valide pour ProblemDetailsSchema', () => {
    const exceptions = [
      new NotFoundException('absent'),
      new EntityNotFoundError('Profil', '1'),
      new Error('boum'),
      'chaîne levée',
      undefined,
    ];

    for (const exception of exceptions) {
      expect(() => ProblemDetailsSchema.parse(toProblemDetails(exception, '/x'))).not.toThrow();
    }
  });

  describe('HttpException', () => {
    it('reprend le message d’une réponse sous forme de chaîne', () => {
      const problem = toProblemDetails(new HttpException('Message public', 418), '/x');

      expect(problem).toStrictEqual({
        type: 'about:blank',
        title: 'Error',
        status: 418,
        detail: 'Message public',
        instance: '/x',
      });
    });

    it('reprend le message d’une réponse objet Nest', () => {
      const problem = toProblemDetails(new BadRequestException('Paramètre invalide'), '/x?a=1');

      expect(problem).toMatchObject({
        status: 400,
        detail: 'Paramètre invalide',
        instance: '/x?a=1',
      });
    });

    it('joint les messages d’un tableau (et ignore les éléments non textuels)', () => {
      const exception = new HttpException({ message: ['a', 'b', 3, null] }, 400);

      expect(toProblemDetails(exception, '/x').detail).toBe('a b');
    });

    it('omet detail quand la réponse n’a pas de message textuel', () => {
      const withoutMessage = toProblemDetails(new HttpException({ code: 1 }, 400), '/x');
      const numericMessage = toProblemDetails(new HttpException({ message: 42 }, 400), '/x');

      expect(withoutMessage).not.toHaveProperty('detail');
      expect(numericMessage).not.toHaveProperty('detail');
    });

    it('garde le statut 503 d’une indisponibilité volontaire', () => {
      const problem = toProblemDetails(new ServiceUnavailableException('Base injoignable'), '/h');

      expect(problem).toMatchObject({ status: 503, title: 'Service Unavailable' });
    });
  });

  describe('erreur de domaine', () => {
    it('EntityNotFoundError devient un 404 avec son message', () => {
      const problem = toProblemDetails(new EntityNotFoundError('Profil', 'x'), '/api/v1/profile');

      expect(problem).toMatchObject({
        status: 404,
        title: 'Not Found',
        detail: 'Profil « x » introuvable.',
      });
    });
  });

  describe('erreurs inattendues', () => {
    it.each([
      ['Error', new Error('secret /apps/api/src/x.ts:1:1')],
      ['TypeError', new TypeError('undefined is not a function')],
      ['chaîne', 'secret'],
      ['null', null],
      ['objet', { message: 'secret' }],
    ])('%s : 500 générique sans fuite', (_label, exception) => {
      const problem = toProblemDetails(exception, '/api/v1/skills');

      expect(problem).toStrictEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Une erreur interne est survenue.',
        instance: '/api/v1/skills',
      });
    });

    it('une erreur Fastify 4xx garde son statut et son message', () => {
      const error = Object.assign(new Error('Body is not valid JSON'), { statusCode: 400 });

      expect(toProblemDetails(error, '/x')).toMatchObject({
        status: 400,
        detail: 'Body is not valid JSON',
      });
    });

    it.each([200, 399, 600, '400', Number.NaN])(
      'un statusCode %j hors 400-499 ne sert jamais de statut',
      (statusCode) => {
        const error = Object.assign(new Error('secret'), { statusCode });

        const problem = toProblemDetails(error, '/x');

        expect(problem.status).toBe(500);
        expect(problem.detail).toBe('Une erreur interne est survenue.');
      },
    );

    it('une erreur Fastify 5xx ne fuit pas son message', () => {
      const error = Object.assign(new Error('secret'), { statusCode: 502 });

      expect(toProblemDetails(error, '/x')).toMatchObject({
        status: 500,
        detail: 'Une erreur interne est survenue.',
      });
    });
  });

  it('traduit le dépassement de délai de Fastify (FST_ERR_HANDLER_TIMEOUT) en 503 sans détail interne', () => {
    const timeout = Object.assign(new Error('Request timed out'), {
      code: 'FST_ERR_HANDLER_TIMEOUT',
      statusCode: 503,
    });

    expect(toProblemDetails(timeout, '/api/v1/cv')).toMatchObject({
      status: 503,
      title: 'Service Unavailable',
      instance: '/api/v1/cv',
    });
    expect(JSON.stringify(toProblemDetails(timeout, '/api/v1/cv'))).not.toContain('timed out');
  });
});
