import fs from 'fs'
import path from 'path'
const parseConfig = (): Record<string, string> => {
  const config = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../config.json')).toString('utf8'),
  )
  return config
}
const getUrl = (servername: string, config: Record<string, string>): string | undefined => {
  const withoutBasedomain = servername.replace(process.env.BASEDOMAIN, '')

  if (withoutBasedomain.split('.').length > 2) return undefined

  const filtered =
    config[Object.keys(config).find((el) => el.replace('*.', '') == withoutBasedomain)]
  if (filtered == undefined) return undefined

  return filtered
}
export { parseConfig, getUrl }
