import { createLogger as winstonCreateLogger, transports, format } from 'winston';
import 'winston-daily-rotate-file';

export function createLogger(context: string) {
  const logger = winstonCreateLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.splat(),
      format.json(),
    ),
    defaultMeta: { context },
    transports: [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.printf(({ timestamp, level, message, context: ctx, stack }) => {
            return `${timestamp} [${ctx}] ${level}: ${stack || message}`;
          }),
        ),
      }),
      new (transports as any).DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '30d',
        zippedArchive: true,
      }),
      new (transports as any).DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        zippedArchive: true,
      }),
    ],
  });

  return logger;
}
