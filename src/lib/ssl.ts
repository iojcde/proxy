import fs from 'fs'
import logger from '../tools/logs'
import { SecureContext } from 'tls'
import tls from 'tls'
import path from 'path'
import cache from '../lib/cache'

export function getSecureContext(servername: string): SecureContext | null {
  const _cached = cache.get(servername)
  if (!_cached) {
    logger.info(`SSL certificate has been found and assigned to ${servername}`)
    if (!fs.existsSync(path.resolve(__dirname, `../certs/${servername}`))) {
      return null
    }
    try {
      const ctx = tls.createSecureContext({
        key: fs.readFileSync(path.resolve(__dirname, `../certs/${servername}/key.pem`)),
        cert: fs.readFileSync(path.resolve(__dirname, `../certs/${servername}/cert.pem`)),
      })
      cache.set(servername, ctx)
      return ctx
    } catch (e) {
      logger.error(e)
    }
  }
  return _cached
}
