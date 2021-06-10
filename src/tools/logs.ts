import winston, { format } from 'winston'
import path from 'path'

const logger = winston.createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
  ),

  defaultMeta: { service: 'proxy' },
  transports: [
    new winston.transports.File({
      filename: path.resolve(__dirname, '../logs/error.log'),
      level: 'error',
    }),
    new winston.transports.File({ filename: path.resolve(__dirname, '../logs/combined.log') }),
  ],
})
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.colorize(),
        format.simple(),
      ),
    }),
  )
}
export default logger
