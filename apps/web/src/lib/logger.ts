import { createLogger, createRequestLogger } from '@workspace/components/lib';

export const logger = createLogger('web');
export const requestLogger = createRequestLogger(logger);
