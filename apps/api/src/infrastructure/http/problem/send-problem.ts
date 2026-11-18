import { Logger } from '@nestjs/common';
import { PROBLEM_JSON_CONTENT_TYPE } from '@siteperso/contracts';
import { type FastifyReply, type FastifyRequest } from 'fastify';

import { toProblemDetails } from './problem-details.js';

const logger = new Logger('ProblemDetails');

/**
 * Écrit une exception en réponse `application/problem+json` (RFC 9457). Partagé par le filtre
 * Nest et par les gestionnaires d'erreurs de Fastify (erreurs levées hors du routage Nest :
 * URL invalide, préflight CORS, rate limiting d'une route enregistrée avant Nest). Les 5xx sont
 * journalisées avec leur pile, jamais renvoyées au client.
 */
export function sendProblem(
  exception: unknown,
  request: Pick<FastifyRequest, 'method' | 'url'>,
  reply: FastifyReply,
  extraHeaders: Readonly<Record<string, string>> = {},
): void {
  const problem = toProblemDetails(exception, request.url);

  if (problem.status >= 500) {
    logger.error(
      `${request.method} ${request.url} -> ${problem.status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
  }

  reply.status(problem.status);
  for (const [name, value] of Object.entries(extraHeaders)) {
    reply.header(name, value);
  }
  void reply.header('content-type', PROBLEM_JSON_CONTENT_TYPE).send(problem);
}
