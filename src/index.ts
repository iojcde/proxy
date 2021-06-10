import express, { Application } from 'express'
import { SecureContext } from 'tls'
import httpProxy from 'http-proxy'
import ShrinkRay from 'shrink-ray-current'
const app: Application = express()
import http from 'http'
import https from 'https'
import { getSecureContext } from './lib/ssl'
import dotenv from 'dotenv'
dotenv.config()

const proxy = httpProxy.createProxy()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(ShrinkRay())

app.use((req, res) => {
  proxy.web(req, res, { target: 'http://google.com' })
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

httpsServer.listen(4000, function () {
  console.log('Listening https on port: 4000')
})

// Redirect http traffic to https
http
  .createServer((req, res) => {
    res.writeHead(301, { Location: 'https://' + req.headers['host'] + req.url })
    res.end()
  })
  .listen(80)
