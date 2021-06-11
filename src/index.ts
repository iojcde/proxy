import express, { Application } from 'express'
import { SecureContext } from 'tls'
import httpProxy from 'http-proxy'
import ShrinkRay from 'shrink-ray-current'
import http from 'http'
import https from 'https'
import { getSecureContext } from './lib/ssl'
import dotenv from 'dotenv'
import { initCerts, parseConfig, getUrl } from './lib/config'
import logger from './tools/logs'

const app: Application = express()
dotenv.config()
const proxy = httpProxy.createProxy()
proxy.on('error', (err) => {
  logger.error(err)
})

const config = parseConfig()
initCerts(config)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(ShrinkRay())
app.use((req, res) => {
  const url = getUrl(req.headers.host, config)
  if (url !== undefined) {
    proxy.web(req, res, { target: `http://${url}` })
  } else {
    res.json({ status: 404, message: 'not found' })
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

const httpsServer = https.createServer(options, app)

httpsServer.listen(443, function () {
  console.log('Listening https on port: 4000')
})

// Redirect http traffic to https
http
  .createServer((req, res) => {
    res.writeHead(301, { Location: 'https://' + req.headers['host'] + req.url })
    res.end()
  })
  .listen(80)
