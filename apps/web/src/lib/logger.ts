import { createLogger } from '@workspace/logging';
import { createRequestLogger } from '@workspace/logging/server';

export const logger = createLogger('web');
export const requestLogger = createRequestLogger(logger);
