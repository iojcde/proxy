import fs from 'fs'
import logger from '../tools/logs'
import { SecureContext } from 'tls'
import tls from 'tls'
import path from 'path'
import cache from '../lib/cache'
import { getCert } from './letsencrypt'

export async function getSecureContext(servername: string): Promise<SecureContext | null> {
  const _cached = cache.get(servername)
  if (!_cached) {
    if (!fs.existsSync(path.resolve(__dirname, `../certs/${servername}`))) {
      await getCert({ domain: servername })
    }
    try {
      const ctx = tls.createSecureContext({
        key: fs.readFileSync(path.resolve(__dirname, `../certs/${servername}/key.pem`)),
        cert: fs.readFileSync(path.resolve(__dirname, `../certs/${servername}/cert.pem`)),
      })

      logger.info(`SSL certificate has been found and assigned to ${servername}`)
      cache.set(servername, ctx)
      return ctx
    } catch (e) {
      logger.error(e)
    }
  }
  return _cached
}
