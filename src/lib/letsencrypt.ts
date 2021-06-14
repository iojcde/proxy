import acme from 'acme-client'
import DigitalOcean from 'do-wrapper'
import logger from '../tools/logs'
import fs from 'fs'
import path from 'path'
import Cloudflare from 'cloudflare'
const fsPromises = fs.promises

const init = async (): Promise<acme.Client> => {
  const accountPrivateKey = fs.readFileSync(
    path.resolve(__dirname, '../config/accountPrivateKey.pem'),
  )
  const accountUrl = fs
    .readFileSync(path.resolve(__dirname, '../config/accountUrl.txt'))
    .toString()
    .replace('\n', '')

  const client = new acme.Client({
    directoryUrl: acme.directory.letsencrypt.production,
    accountKey: accountPrivateKey,
    accountUrl: accountUrl,
  })
  return client
}

interface getCertProps {
  domain: string
  isWildcard: boolean
  dns: 'DigitalOcean' | 'Cloudflare'
}

const sleep = async (time: number): Promise<void> => {
  return await new Promise((resolve) => setTimeout(resolve, time))
}

const getCert = async ({ domain, isWildcard, dns }: getCertProps): Promise<void> => {
  const client = await init()
  if (domain.includes('/')) {
    logger.error('Invalid request for certificate')
    return
  }
  const [certificateKey, cert] =
    dns === 'DigitalOcean'
      ? await getCertDO({ domain, client, isWildcard })
      : await getCertCF({ domain, client, isWildcard })

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

const getCertDO = async ({
  domain,
  client,
  isWildcard,
}: {
  domain: string
  client: acme.Client
  isWildcard: boolean
}): Promise<[Buffer, string | void]> => {
  const doInstance = new DigitalOcean(process.env.DO_TOKEN)

  doInstance.account
    .get()
    .then((data) => console.log(data))
    .catch((err) => console.error(err))

  const cleanDomain = domain.replace('*.', '')
  const [certificateKey, certificateRequest] = await acme.forge.createCsr({
    commonName: domain,
    altNames: isWildcard ? ['*.' + cleanDomain] : null,
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
        await doInstance.domains
          .createRecord(process.env.BASEDOMAIN, {
            type: 'TXT',
            name: `_acme-challenge.${cleanDomain}`.replace('.' + process.env.BASEDOMAIN, ''),
            data: keyAuthorization,
            ttl: 1800,
            tag: '',
          })
          .catch((err) => logger.error(err))
        await sleep(5000)
      },
      challengeRemoveFn: async (_authz, _challenge, keyAuthorization) => {
        const allRecords = await doInstance.domains.getAllRecords(process.env.BASEDOMAIN, '', true)
        const id = allRecords.find(
          (r: Record<string, unknown>) =>
            r.type === 'TXT' &&
            r.name === `_acme-challenge.${cleanDomain}`.replace('.' + process.env.BASEDOMAIN, '') &&
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
  return [certificateKey, cert]
}

export const getCertCF = async ({
  domain,
  client,
  isWildcard,
}: {
  domain: string
  client: acme.Client
  isWildcard: boolean
}): Promise<[Buffer, string | void]> => {
  const cleanDomain = domain.replace('*.', '')
  const cfInstance = new Cloudflare({ token: process.env.CF_TOKEN })
  const _allZones = await cfInstance.zones.browse()
  const _zone = _allZones['result'].find((item) => item.name == cleanDomain)
  const zoneID = _zone.id
  const [certificateKey, certificateRequest] = await acme.forge.createCsr({
    commonName: domain,
    altNames: isWildcard ? ['*.' + cleanDomain] : null,
  })

  const cert = await client.auto({
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
      await cfInstance.dnsRecords
        .add(zoneID, {
          type: 'TXT',
          name: `_acme-challenge.${cleanDomain}`.replace('.' + process.env.BASEDOMAIN, ''),
          content: keyAuthorization,
          ttl: 1800,
        })
        .catch((err) => logger.error(err))
      await sleep(5000)
    },
    challengeRemoveFn: async (_authz, _challenge, keyAuthorization) => {
      const _allRecords = await cfInstance.dnsRecords.browse(zoneID)
      const recordToDeleteID = _allRecords[cleanDomain].find(
        (item) => item.content === keyAuthorization,
      ).id
      await cfInstance.dnsRecords.del(zoneID, recordToDeleteID).catch((err) => {
        logger.error(err)
      })
    },
  })
  return [certificateKey, cert]
}
export default getCert
