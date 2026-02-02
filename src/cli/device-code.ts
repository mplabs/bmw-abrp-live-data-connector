import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import { BMW_DEVICE_CODE_ENDPOINT, BMW_TOKEN_ENDPOINT } from '../bmw/endpoints'
import { BMW_TOKENS_PATH } from '../bmw/paths'
import { logger } from '../logger'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const assertUrl = (value: string, name: string): string => {
    if (value.includes('<') && value.includes('>')) {
        throw new Error(`Config ${name} is still a placeholder: ${value}`)
    }
    try {
        new URL(value)
    } catch {
        throw new Error(`Config ${name} must be a valid URL (got: ${value})`)
    }
    return value
}

const loadRawConfig = async (configPath: string): Promise<Record<string, unknown>> => {
    const raw = await readFile(configPath, 'utf8')
    const ext = path.extname(configPath).toLowerCase()
    const parsed = ext === '.yaml' || ext === '.yml' ? YAML.parse(raw) : JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Config file is not an object')
    }
    return parsed as Record<string, unknown>
}

const writeRawConfig = async (configPath: string, config: Record<string, unknown>): Promise<void> => {
    const ext = path.extname(configPath).toLowerCase()
    const output =
        ext === '.yaml' || ext === '.yml'
            ? YAML.stringify(config)
            : JSON.stringify(config, null, 2)
    await writeFile(configPath, output)
}

const looksLikePlaceholder = (value: string): boolean => value.includes('<') && value.includes('>')

const requestDeviceCode = async (endpoint: string, clientId: string, scope: string) => {
    const body = new URLSearchParams({
        client_id: clientId,
        scope,
    })

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    })

    if (!response.ok) {
        let errorBody: unknown = undefined
        try {
            errorBody = await response.json()
        } catch {
            try {
                errorBody = await response.text()
            } catch {
                errorBody = undefined
            }
        }
        logger.error('Device code request rejected', {
            status: response.status,
            scope,
            error: errorBody,
        })
        throw new Error(`Device code request failed (${response.status})`)
    }

    return (await response.json()) as Record<string, unknown>
}

const pollForTokens = async (
    endpoint: string,
    clientId: string,
    deviceCode: string,
    intervalSeconds: number,
    expiresInSeconds: number,
) => {
    const deadline = Date.now() + expiresInSeconds * 1000
    let interval = Math.max(intervalSeconds, 5)

    while (Date.now() < deadline) {
        await sleep(interval * 1000)

        const body = new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: deviceCode,
            client_id: clientId,
        })

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        })

        const payload = (await response.json()) as Record<string, unknown>

        if (response.ok) {
            return payload
        }

        const error = typeof payload.error === 'string' ? payload.error : 'unknown_error'
        if (error === 'authorization_pending') {
            logger.info('Waiting for user authorization')
            continue
        }
        if (error === 'slow_down') {
            interval += 5
            logger.warn('Device code polling slowed down', { interval })
            continue
        }

        throw new Error(`Device code flow failed: ${error}`)
    }

    throw new Error('Device code flow timed out')
}

const main = async () => {
    const configPath = process.env.CONFIG_PATH || 'config.yaml'
    logger.info('Loading config', { configPath })
    const config = await loadRawConfig(configPath)
    const bmw = (config.bmw ?? {}) as Record<string, unknown>
    const clientId = typeof bmw.clientId === 'string' ? bmw.clientId : undefined
    const deviceCodeEndpoint =
        typeof bmw.deviceCodeEndpoint === 'string'
            ? bmw.deviceCodeEndpoint
            : BMW_DEVICE_CODE_ENDPOINT
    const tokenEndpoint =
        typeof bmw.tokenEndpoint === 'string' ? bmw.tokenEndpoint : BMW_TOKEN_ENDPOINT

    if (!clientId || !deviceCodeEndpoint || !tokenEndpoint) {
        throw new Error('Missing bmw.clientId, bmw.deviceCodeEndpoint, or bmw.tokenEndpoint')
    }

    const scope = 'openid cardata:api:read cardata:streaming:read'

    const deviceCode = await requestDeviceCode(
        assertUrl(deviceCodeEndpoint, 'bmw.deviceCodeEndpoint'),
        clientId,
        scope,
    )

    const userCode = String(deviceCode.user_code ?? '')
    const manualVerifyUrl = 'https://customer.bmwgroup.com/oneid/link'
    const verifyUrl =
        String(deviceCode.verification_uri_complete ?? deviceCode.verification_uri ?? '') ||
        manualVerifyUrl
    const deviceCodeValue = String(deviceCode.device_code ?? '')
    const pollInterval = Number(deviceCode.interval ?? 5)
    const expiresIn = Number(deviceCode.expires_in ?? 900)

    if (!userCode || !verifyUrl || !deviceCodeValue) {
        throw new Error('Device code response missing required details')
    }

    logger.info('Complete authorization in the browser', {
        verificationUrl: verifyUrl,
        manualUrl: manualVerifyUrl,
        userCode,
    })

    const tokens = await pollForTokens(
        assertUrl(tokenEndpoint, 'bmw.tokenEndpoint'),
        clientId,
        deviceCodeValue,
        pollInterval,
        expiresIn,
    )

    const output = {
        access: tokens.access_token,
        refresh: tokens.refresh_token,
        id: tokens.id_token,
        gcid: tokens.gcid,
        raw: tokens,
    }

    const outputPath = BMW_TOKENS_PATH

    try {
        await mkdir(path.dirname(outputPath), { recursive: true })
        await writeFile(outputPath, JSON.stringify(output, null, 2))
    } catch (error) {
        throw new Error(
            `Failed to write tokens to ${outputPath}. Ensure /data is mounted and writable. (${(error as Error).message})`,
        )
    }

    logger.info('Tokens stored', { outputPath })

    if (typeof output.gcid === 'string') {
        const configRoot = config as Record<string, unknown>
        const bmwConfig = (configRoot.bmw ?? {}) as Record<string, unknown>
        const existingUsername =
            typeof bmwConfig.username === 'string' ? bmwConfig.username : ''

        let updated = false
        if (!existingUsername || looksLikePlaceholder(existingUsername)) {
            bmwConfig.username = output.gcid
            updated = true
        }

        if (updated) {
            configRoot.bmw = bmwConfig
            try {
                await writeRawConfig(configPath, configRoot)
                logger.info('Config updated with GCID', { configPath })
            } catch (error) {
                logger.warn('Config update skipped', { error: (error as Error).message })
            }
        }
    }
}

main().catch((error) => {
    logger.error('Device code flow failed', { error: (error as Error).message })
    process.exit(1)
})
