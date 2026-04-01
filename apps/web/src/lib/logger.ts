import { createLogger } from '@workspace/components/lib';
import { createRequestLogger } from '@workspace/components/lib/server';

export const logger = createLogger('web');
export const requestLogger = createRequestLogger(logger);
