/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs'
import path from 'path'
import getCert from './letsencrypt'
import matcher from 'matcher'
import cache from './cache'

type configItem = { domain: string; port: number; dns: 'Cloudflare' | 'DigitalOcean' }
export type configType = Record<string, configItem>

const parseConfig = (): configType => {
  const config = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../config/config.json')).toString('utf8'),
  )
  Object.keys(config).map((el) => {
    if (typeof config[el] === 'string') config[el] = { domain: config[el], port: 80 }
  })
  console.log(config)
  return config
}

const filterConfig = ({
  config,
  mode,
  fn,
}:
  | { config: configType; mode: 'ITEM'; fn: (a: any) => boolean }
  | { config: configType; mode: 'KEY'; fn: (a: any) => boolean }):
  | { domain: string; port: number }
  | string =>
  mode === 'ITEM'
    ? config[Object.keys(config).filter((key) => fn(key))[0]]
    : Object.keys(config).filter((key) => fn(key))[0]

const getUrl = (servername: string, config: configType): configItem | undefined => {
  const _cached = cache.get(`getUrl:${servername}`)
  if (_cached) return _cached
  if (servername.split('.').length > 4) {
    cache.set(`getUrl:${servername}`, undefined)
    return undefined
  } else {
    const filtered = filterConfig({
      config: config,
      mode: 'ITEM',
      fn: (el) =>
        matcher.isMatch(servername, el) || matcher.isMatch(servername, el.replace('*.', '')),
    })
    cache.set(`getUrl:${servername}`, filtered)
    return filtered as configItem
  }
}

const initCerts = (config: configType): void => {
  const noCertDomains = Object.keys(config).filter((el) => {
    if (fs.existsSync(path.resolve(__dirname, `../certs/${el.replace('*.', '')}`))) {
      return false
    } else return true
  })
  noCertDomains.map(async (el) => {
    await getCert({ domain: el, isWildcard: el.startsWith('*.'), dns: config[el].dns })
  })
}
export { initCerts, parseConfig, getUrl, filterConfig }
