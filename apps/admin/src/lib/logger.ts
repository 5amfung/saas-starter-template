import { createLogger, createRequestLogger } from '@workspace/components/lib';

export const logger = createLogger('admin');
export const requestLogger = createRequestLogger(logger);
