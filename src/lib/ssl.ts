import fs from 'fs'
import logger from '../tools/logs'
import { SecureContext } from 'tls'
import tls from 'tls'
import path from 'path'
import matcher from 'matcher'
import cache from '../lib/cache'
import { configType, filterConfig } from '../lib/config'

export async function getSecureContext(
  servername: string,
  config: configType,
): Promise<SecureContext | null> {
  const filtered = filterConfig({
    config: config,
    mode: 'KEY',
    fn: (el) =>
      matcher.isMatch(servername, el) || matcher.isMatch(servername, el.replace('*.', '')),
  }) as string
  if (filtered === undefined) return null
  const newServerName = filtered.replace('*.', '')
  const _cached = cache.get(newServerName)

  if (_cached) return _cached
  else {
    if (!fs.existsSync(path.resolve(__dirname, `../certs/${newServerName}`))) {
      return null
    }

    try {
      const ctx = tls.createSecureContext({
        key: fs.readFileSync(path.resolve(__dirname, `../certs/${newServerName}/key.pem`)),
        cert: fs.readFileSync(path.resolve(__dirname, `../certs/${newServerName}/cert.pem`)),
      })

      logger.info(`SSL certificate has been found and assigned to ${newServerName}`)
      cache.set(newServerName, ctx)
      return ctx
    } catch (e) {
      logger.error(e)
    }
  }
  return _cached
}
