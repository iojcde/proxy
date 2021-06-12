import { SecureContext } from 'tls'
import http2 from 'http2'
import http from 'http'
import Koa from 'koa'
import { getSecureContext } from './lib/ssl'
import dotenv from 'dotenv'
import { initCerts, parseConfig, getUrl } from './lib/config'
import compress from 'koa-compress'
import zlib from 'zlib'
const app = new Koa()
import proxy from 'koa-proxy'
dotenv.config()

const config = parseConfig()
initCerts(config)
app.use(
  compress({
    br: {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
      },
    },
  }),
)

app.use((ctx) => {
  const url = getUrl(ctx.headers.host, config)
  if (url !== undefined) {
    proxy({ host: url.domain })
  } else {
    ctx.res.end('404 not found')
  }
})

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

const httpsServer = http2.createSecureServer(options, app.callback())
httpsServer.listen(443)

// Redirect http traffic to https
http
  .createServer((req, res) => {
    res.writeHead(301, { Location: 'https://' + req.headers['host'] + req.url })
    res.end()
  })
  .listen(80)
