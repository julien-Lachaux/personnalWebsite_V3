import {
  type ArgumentsHost,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { type ProblemDetails } from '@siteperso/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityNotFoundError } from '../../../domain/index.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

interface SentReply {
  status: number | undefined;
  headers: Record<string, string>;
  body: ProblemDetails | undefined;
}

/** Simule juste ce que le filtre utilise de FastifyReply et FastifyRequest. */
function hostFor(url: string, sent: SentReply): ArgumentsHost {
  const reply = {
    status(code: number) {
      sent.status = code;
      return reply;
    },
    header(name: string, value: string) {
      sent.headers[name] = value;
      return reply;
    },
    send(body: ProblemDetails) {
      sent.body = body;
      return reply;
    },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url }),
      getResponse: () => reply,
    }),
  } as unknown as ArgumentsHost;
}

describe('ProblemDetailsFilter', () => {
  let sent: SentReply;
  let logError: ReturnType<typeof vi.spyOn>;
  const filter = new ProblemDetailsFilter();

  beforeEach(() => {
    sent = { status: undefined, headers: {}, body: undefined };
    logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('traduit une HttpException en problem+json avec son statut', () => {
    filter.catch(new NotImplementedException('Pas encore.'), hostFor('/api/v1/profile', sent));

    expect(sent.status).toBe(501);
    expect(sent.headers['content-type']).toBe('application/problem+json');
    expect(sent.body).toEqual({
      type: 'about:blank',
      title: 'Not Implemented',
      status: 501,
      detail: 'Pas encore.',
      instance: '/api/v1/profile',
    });
  });

  it('garde le message des 404 de Nest', () => {
    filter.catch(new NotFoundException('Cannot GET /api/v1/nope'), hostFor('/api/v1/nope', sent));

    expect(sent.status).toBe(404);
    expect(sent.body?.title).toBe('Not Found');
    expect(sent.body?.detail).toBe('Cannot GET /api/v1/nope');
  });

  it('traduit une erreur de domaine EntityNotFoundError en 404', () => {
    filter.catch(
      new EntityNotFoundError('Projet', 'inconnu'),
      hostFor('/api/v1/projects/inconnu', sent),
    );

    expect(sent.status).toBe(404);
    expect(sent.body?.detail).toBe('Projet « inconnu » introuvable.');
  });

  it('renvoie un 500 générique sans fuite de message ni de pile', () => {
    const boom = new Error('secret interne : mot de passe de la base');

    filter.catch(boom, hostFor('/api/v1/health', sent));

    expect(sent.status).toBe(500);
    expect(sent.body).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'Une erreur interne est survenue.',
      instance: '/api/v1/health',
    });
    expect(JSON.stringify(sent.body)).not.toContain('secret');
    expect(JSON.stringify(sent.body)).not.toContain('stack');
    expect(logError).toHaveBeenCalledOnce();
  });

  it("reprend le statut 4xx d'une erreur Fastify", () => {
    const parseError = Object.assign(new Error('Body is not valid JSON'), { statusCode: 400 });

    filter.catch(parseError, hostFor('/api/v1/health', sent));

    expect(sent.status).toBe(400);
    expect(sent.body?.title).toBe('Bad Request');
  });
});
