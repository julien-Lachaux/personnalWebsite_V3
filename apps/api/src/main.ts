import 'reflect-metadata';

import { Logger } from '@nestjs/common';

import { APP_CONFIG } from './infrastructure/config/config.module.js';
import { type Env } from './infrastructure/config/env.schema.js';
import { createApp, GLOBAL_PREFIX } from './infrastructure/http/create-app.js';

const app = await createApp();
const env = app.get<Env>(APP_CONFIG);

await app.listen({ port: env.PORT, host: env.HOST });

Logger.log(`API démarrée sur http://${env.HOST}:${String(env.PORT)}/${GLOBAL_PREFIX}`, 'Bootstrap');
