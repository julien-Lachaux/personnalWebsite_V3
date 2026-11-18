import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import { PROBLEM_JSON_CONTENT_TYPE } from '@siteperso/contracts';
import { type FastifyReply, type FastifyRequest } from 'fastify';

import { toProblemDetails } from './problem-details.js';

/**
 * Filtre d'erreurs global : toute exception devient une réponse `application/problem+json`
 * (RFC 9457). Les 5xx sont journalisées avec leur pile, jamais renvoyées au client.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const problem = toProblemDetails(exception, request.url);

    if (problem.status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${problem.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    void reply
      .status(problem.status)
      .header('content-type', PROBLEM_JSON_CONTENT_TYPE)
      .send(problem);
  }
}
