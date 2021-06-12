import { SecureContext } from 'tls'
import http2 from 'http2'
import http from 'http'
import { getSecureContext } from './lib/ssl'
import dotenv from 'dotenv'
import { parseConfig, getUrl } from './lib/config'
import h2request from 'http2-wrapper'
import proxy from 'http2-proxy'

const options = {
  allowHTTP1: true,
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

const defaultWebHandler = (
  err: Error,
  req: http2.Http2ServerRequest,
  res: http2.Http2ServerResponse,
): void => {
  if (err) {
    console.error('proxy error', err)
    res.end('Internal server error')
  }
}

const defaultWSHandler = (err: Error, req: http2.Http2ServerRequest, socket): void => {
  if (err) {
    console.error('proxy error', err)
    socket.destroy()
  }
}
const server = http2.createSecureServer(options)

server.on('request', (req, res) => {
  const url = getUrl(req.headers.host, config)
  console.log('url: ' + url)
  proxy.web(
    req,
    res,
    {
      hostname: url.domain,
      port: url.port,
      onReq: async (req, options) => h2request.request(options),
    },
    defaultWebHandler,
  )
})

server.on('upgrade', (req, res, head) => {
  const url = getUrl(req.headers.host, config)
  console.log('url: ' + url)
  proxy.ws(
    req,
    res,
    head,
    {
      hostname: url.domain,
      port: url.port,
    },
    defaultWSHandler,
  )
})
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
