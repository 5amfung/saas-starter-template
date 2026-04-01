import { createLogger } from '@workspace/logging';
import { createRequestLogger } from '@workspace/logging/server';

export const logger = createLogger('admin');
export const requestLogger = createRequestLogger(logger);
