import { SecureContext } from 'tls'
import http2 from 'http2'
import http from 'http'
import { getSecureContext } from './lib/ssl'
import dotenv from 'dotenv'
import { parseConfig, getUrl } from './lib/config'
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
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const url = getUrl(req.headers.host ? req.headers.host : req.headers[':authority'], config)
  res.setHeader('x-forwarded-for', req.socket.remoteAddress)
  res.setHeader('x-forwarded-proto', 'https')
  res.setHeader('x-forwarded-host', req.headers.host ? req.headers.host : req.headers[':authority'])
  proxy.web(
    req,
    res,
    {
      hostname: url.domain,
      port: url.port,
    },
    defaultWebHandler,
  )
})

server.on('upgrade', (req, res, head) => {
  const url = getUrl(req.headers.host ? req.headers.host : req.headers[':authority'], config)
  res.setHeader('x-forwarded-for', req.socket.remoteAddress)
  res.setHeader('x-forwarded-proto', 'https')
  res.setHeader('x-forwarded-host', req.headers.host ? req.headers.host : req.headers[':authority'])
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

server.listen(443)
