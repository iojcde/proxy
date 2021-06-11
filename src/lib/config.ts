import fs from 'fs'
import path from 'path'
import getCert from './letsencrypt'
import matcher from 'matcher'
import cache from './cache'

type configItem = { domain: string; port: number }
type configType = Record<string, configItem>

const parseConfig = (): configType => {
  const config = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../config.json')).toString('utf8'),
  )
  Object.keys(config).map((el) => {
    if (typeof config[el] === 'string') config[el] = { domain: config[el], port: 80 }
  })
  console.log(config)
  return config
}

const filterConfig = (
  config: configType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (a: any) => boolean,
): { domain: string; port: number } => config[Object.keys(config).filter((key) => fn(key))[0]]

const getUrl = (servername: string, config: configType): configItem | undefined => {
  const _cached = cache.get(`getUrl:${servername}`)
  if (_cached) return _cached
  else {
    if (servername.split('.').length > 3) return undefined
    const filtered = filterConfig(
      config,
      (el) => matcher.isMatch(servername, el) || matcher.isMatch(servername, el.replace('*.', '')),
    )
    cache.set(`getUrl:${servername}`, filtered)
    return filtered
  }
}

const initCerts = (config: configType): void => {
  const noCertDomains = Object.keys(config).filter((el) => {
    if (fs.existsSync(path.resolve(__dirname, `../certs/${el}`))) {
      return false
    } else return true
  })
  noCertDomains.map(async (el) => {
    await getCert({ domain: el.replace('*.', '') })
  })
}
export { initCerts, parseConfig, getUrl }
