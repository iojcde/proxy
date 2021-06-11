import acme from 'acme-client'
import DigitalOcean from 'do-wrapper'
import logger from '../tools/logs'
import fs from 'fs'
import path from 'path'
const fsPromises = fs.promises

const init = async (): Promise<acme.Client> => {
  let accountUrl = null

  try {
    accountUrl = fs.readFileSync('accountUrl.txt')
  } catch (e) {}
  const accountPrivateKey = await acme.forge.createPrivateKey()
  const client = new acme.Client({
    directoryUrl: acme.directory.letsencrypt.production,
    accountKey: accountPrivateKey,
    accountUrl: accountUrl,
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
      skipChallengeVerification: true,
      challengePriority: ['dns-01'],
      termsOfServiceAgreed: true,
      challengeCreateFn: async (
        _authz: acme.Authorization,
        _challenge: unknown,
        keyAuthorization: string,
      ) => {
        logger.info(`Requesting certificate for ${domain}...`)
        const _record = await doInstance.domains
          .createRecord(process.env.BASEDOMAIN, {
            type: 'TXT',
            name: `_acme-challenge.${domain}`.replace('.' + process.env.BASEDOMAIN, ''),
            data: keyAuthorization,
            ttl: 1800,
            tag: '',
          })
          .catch((err) => logger.error(err))
        console.log(_record)
        await sleep(5000)
      },
      challengeRemoveFn: async (_authz, _challenge, keyAuthorization) => {
        const allRecords = await doInstance.domains.getAllRecords(process.env.BASEDOMAIN, '', true)
        const id = allRecords.find(
          (r: Record<string, unknown>) =>
            r.type === 'TXT' &&
            r.name === `_acme-challenge.${domain}`.replace('.' + process.env.BASEDOMAIN, '') &&
            r.data === keyAuthorization,
        ).id
        console.log('Deleting record id ' + id.toString())
        await doInstance.domains
          .deleteRecord(process.env.BASEDOMAIN, id)
          .catch((err) => logger.error(err))
      },
    })
    .catch((err) => {
      logger.error(err)
    })
  try {
    const dir = path.resolve(__dirname, `../certs/${domain}`)

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
    await fsPromises.writeFile(path.resolve(__dirname, '../accountUrl.txt'), client.getAccountUrl())
  } catch (e) {
    logger.error(e)
  }
  return
}
export default getCert
