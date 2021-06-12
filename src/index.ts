import { SecureContext } from 'tls'
import https from 'https'
import http from 'http'
import { getSecureContext } from './lib/ssl'
import dotenv from 'dotenv'
import { parseConfig, getUrl } from './lib/config'
import Restana from 'restana'
import { proxy } from 'fast-proxy'
const options = {
  // A function that will be called if the client supports SNI TLS extension(Pretty much every modern browser).
  SNICallback: async (servername: string, cb: (err: Error, ctx: SecureContext | null) => void) => {
    const ctx = await getSecureContext(servername)
    if (cb) {
      cb(null, ctx)
    } else {
      return ctx
    }
  },
}

const restana = Restana({
  server: https.createServer(options),
})

restana.all('/*', function (req, res) {
  const url = getUrl(req.headers.host, config)
  console.log('url: ' + url)
  proxy(req, res, req.url, { base: `http://${url.domain}:${url.port}` })
})
restana.start(443)

dotenv.config()

const config = parseConfig()
// initCerts(config)

// Redirect http traffic to https
http
  .createServer((req, res) => {
    res.writeHead(301, { Location: 'https://' + req.headers['host'] + req.url })
    res.end()
  })
  .listen(80)
