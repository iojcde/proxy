import { SecureContext } from 'tls'
import http2 from 'http2'
import http from 'http'
import { getSecureContext } from './lib/ssl'
import dotenv from 'dotenv'
import { parseConfig, getUrl } from './lib/config'
import proxy from 'http2-proxy'
const config = parseConfig()

const options = {
  allowHTTP1: true,
  SNICallback: async (servername: string, cb: (err: Error, ctx: SecureContext | null) => void) => {
    const ctx = await getSecureContext(servername, config)
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

server.on('request', async (req, res) => {
  const baseDomain = req.headers.host ? req.headers.host : req.headers[':authority']
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const url = getUrl(baseDomain, config)
  if (url === null) {
    res.statusCode = 400
    res.end('400 bad request')
  }
  await proxy.web(req, res, {
    hostname: url.domain,
    port: url.port,
    onReq: async (req, { headers }) => {
      headers['host'] = baseDomain
    },
  }),
    defaultWebHandler
})

server.on('upgrade', async (req, res, head) => {
  const baseDomain = req.headers.host ? req.headers.host : req.headers[':authority']
  const url = getUrl(baseDomain, config)
  await proxy.ws(
    req,
    res,
    head,
    {
      hostname: url.domain,
      port: url.port,
      onReq: async (req, { headers }) => {
        headers['x-forwarded-host'] = baseDomain
      },
    },
    defaultWSHandler,
  )
})
dotenv.config()

http
  .createServer((req, res) => {
    res.writeHead(301, { Location: 'https://' + req.headers['host'] + req.url })
    res.end()
  })
  .listen(80)

server.listen(443)
