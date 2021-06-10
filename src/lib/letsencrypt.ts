import acme from 'acme-client'
import DigitalOcean from 'do-wrapper'
import logger from '../tools/logs'
import fs from 'fs'
import path from 'path'
import cache from './cache'
const fsPromises = fs.promises

const init = async (): Promise<acme.Client> => {
  const accountPrivateKey = await acme.forge.createPrivateKey()
  const client = new acme.Client({
    directoryUrl: acme.directory.letsencrypt.staging,
    accountKey: accountPrivateKey,
  })
  return client
}

interface getCertProps {
  domain: string
}

const sleep = async (time: number): Promise<void> => {
  return await new Promise((resolve) => setTimeout(resolve, time))
}

const getCert = async ({ domain }: getCertProps): Promise<void> => {
  const client = await init()
  if (domain.includes('/')) {
    logger.error('Invalid request for certificate')
    return
  }
  const doInstance = new DigitalOcean(process.env.DO_TOKEN)

  doInstance.account
    .get()
    .then((data) => console.log(data))
    .catch((err) => console.error(err))

  const [certificateKey, certificateRequest] = await acme.forge.createCsr({
    commonName: domain,
    altNames: ['*.' + domain],
  })

  const cert = await client
    .auto({
      email: process.env.EMAIL,
      csr: certificateRequest,
      challengePriority: ['dns-01'],
      termsOfServiceAgreed: true,
      challengeCreateFn: async (
        _authz: acme.Authorization,
        _challenge: unknown,
        keyAuthorization: string,
      ) => {
        if (!cache.get(`pending:${domain}`)) {
          logger.info('requesting certificate...')
          const _record = await doInstance.domains
            .createRecord(process.env.BASEDOMAIN, {
              type: 'TXT',
              name: `_acme-challenge.${domain}`,
              data: keyAuthorization,
              ttl: 1800,
              tag: '',
            })
            .catch((err) => logger.error(err))
          cache.set(`pending:${domain}`, true)
          console.log(_record)
          await sleep(5000)
        }
      },
      challengeRemoveFn: async () => {
        cache.set(`pending:${domain}`, false)
        const allRecords = await doInstance.domains.getByName(process.env.BASEDOMAIN)
        const id = allRecords.find(
          (r) => r.type === 'TXT' && r.name === `_acme-challenge.${domain}`,
        )
        await doInstance.domains
          .deleteRecord(process.env.BASEDOMAIN, id)
          .catch((err) => logger.error(err))
      },
    })
    .catch((err) => {
      logger.error(err)
    })
  console.log(cert)
  console.log('we got the cert!!!')
  try {
    const dir = path.resolve(__dirname, `../certs/${domain}/key.pem`)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }
    await fsPromises.writeFile(
      path.resolve(__dirname, `../certs/${domain}/key.pem`),
      certificateKey,
    )
    await fsPromises.writeFile(
      path.resolve(__dirname, `../certs/${domain}/cert.pem`),
      cert as string,
    )
  } catch (e) {
    logger.error(e)
  }
  return
}
export { getCert }
