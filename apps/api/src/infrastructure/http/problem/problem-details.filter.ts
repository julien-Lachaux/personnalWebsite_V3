import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { type FastifyReply, type FastifyRequest } from 'fastify';

import { sendProblem } from './send-problem.js';

/**
 * Filtre d'erreurs global : toute exception devient une réponse `application/problem+json`
 * (RFC 9457). Les 5xx sont journalisées avec leur pile, jamais renvoyées au client.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    sendProblem(exception, http.getRequest<FastifyRequest>(), http.getResponse<FastifyReply>());
  }
}
