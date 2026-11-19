import { Logger } from '@nestjs/common';
import { type ProblemDetails } from '@siteperso/contracts';
import { type FastifyReply } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendProblem } from './send-problem.js';

interface SentReply {
  status: number | undefined;
  headers: Record<string, string>;
  body: ProblemDetails | undefined;
}

/** Simule juste ce que `sendProblem` utilise de FastifyReply. */
function replyFor(sent: SentReply): FastifyReply {
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
  return reply as unknown as FastifyReply;
}

describe('sendProblem', () => {
  const request = { method: 'GET', url: '/api/v1/health' };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('journalise une valeur levée qui n’est pas une Error sous sa forme texte, en 500 générique', () => {
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const sent: SentReply = { status: undefined, headers: {}, body: undefined };

    sendProblem('panne brute', request, replyFor(sent));

    expect(sent.status).toBe(500);
    expect(sent.body?.detail).toBe('Une erreur interne est survenue.');
    expect(logError).toHaveBeenCalledWith('GET /api/v1/health -> 500', 'panne brute');
  });

  it('journalise la pile d’une Error et ajoute les en-têtes supplémentaires demandés', () => {
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const sent: SentReply = { status: undefined, headers: {}, body: undefined };
    const boom = new Error('secret');

    sendProblem(boom, request, replyFor(sent), { 'x-content-type-options': 'nosniff' });

    expect(logError).toHaveBeenCalledWith('GET /api/v1/health -> 500', boom.stack);
    expect(sent.headers).toEqual({
      'x-content-type-options': 'nosniff',
      'content-type': 'application/problem+json',
    });
    expect(JSON.stringify(sent.body)).not.toContain('secret');
  });

  it('ne journalise pas une erreur 4xx', () => {
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const sent: SentReply = { status: undefined, headers: {}, body: undefined };

    sendProblem(
      Object.assign(new Error('Body is not valid JSON'), { statusCode: 400 }),
      request,
      replyFor(sent),
    );

    expect(sent.status).toBe(400);
    expect(logError).not.toHaveBeenCalled();
  });
});
