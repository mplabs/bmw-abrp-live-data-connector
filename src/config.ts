import { readFile } from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import { BMW_DEVICE_CODE_ENDPOINT, BMW_TOKEN_ENDPOINT } from './bmw/endpoints'
import type { AppConfig } from './types'

const assertString = (value: unknown, name: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Missing or invalid config field: ${name}`)
    }
    return value
}

const assertObject = (value: unknown, name: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Missing or invalid config object: ${name}`)
    }
    return value as Record<string, unknown>
}

const normalizeConfig = (config: AppConfig): AppConfig => {
    return {
        ...config,
        mqtt: {
            ...config.mqtt,
            tls: config.mqtt.tls ?? true,
            keepaliveSeconds: config.mqtt.keepaliveSeconds ?? 60,
        },
        rateLimitSeconds: config.rateLimitSeconds ?? 10,
    }
}

const loadTokensFromFile = async (
    tokensFile: string,
    configDir: string,
): Promise<Record<string, unknown>> => {
    const resolvedPath = path.isAbsolute(tokensFile) ? tokensFile : path.join(configDir, tokensFile)
    const raw = await readFile(resolvedPath, 'utf8')
    return JSON.parse(raw) as Record<string, unknown>
}

export const loadConfig = async (configPath?: string): Promise<AppConfig> => {
    const resolvedPath = configPath || process.env.CONFIG_PATH || 'config.yaml'
    const raw = await readFile(resolvedPath, 'utf8')
    const ext = path.extname(resolvedPath).toLowerCase()
    const configDir = path.dirname(resolvedPath)

    const parsed = ext === '.yaml' || ext === '.yml' ? YAML.parse(raw) : JSON.parse(raw)

    const root = assertObject(parsed, 'root')
    const bmw = assertObject(root.bmw, 'bmw')
    const tokensFile = typeof bmw.tokensFile === 'string' ? bmw.tokensFile : undefined
    const tokensFromConfig =
        bmw.tokens && typeof bmw.tokens === 'object'
            ? (bmw.tokens as Record<string, unknown>)
            : undefined
    const tokensFromFile = tokensFile ? await loadTokensFromFile(tokensFile, configDir) : undefined
    const bmwTokens = assertObject(tokensFromConfig ?? tokensFromFile, 'bmw.tokens')
    const mqtt = assertObject(root.mqtt, 'mqtt')
    const abrp = assertObject(root.abrp, 'abrp')
    const mapping = assertObject(root.mapping, 'mapping')

    const config: AppConfig = {
        bmw: {
            clientId: typeof bmw.clientId === 'string' ? bmw.clientId : undefined,
            gcid: assertString(bmw.gcid, 'bmw.gcid'),
            vin: assertString(bmw.vin, 'bmw.vin'),
            tokensFile,
            deviceCodeEndpoint:
                typeof bmw.deviceCodeEndpoint === 'string'
                    ? bmw.deviceCodeEndpoint
                    : BMW_DEVICE_CODE_ENDPOINT,
            tokenEndpoint:
                typeof bmw.tokenEndpoint === 'string' ? bmw.tokenEndpoint : BMW_TOKEN_ENDPOINT,
            tokens: {
                access: assertString(bmwTokens.access, 'bmw.tokens.access'),
                refresh: assertString(bmwTokens.refresh, 'bmw.tokens.refresh'),
                id: assertString(bmwTokens.id, 'bmw.tokens.id'),
            },
        },
        abrp: {
            apiKey: assertString(abrp.apiKey, 'abrp.apiKey'),
            userToken: assertString(abrp.userToken, 'abrp.userToken'),
        },
        mqtt: {
            brokerUrl: assertString(mqtt.brokerUrl, 'mqtt.brokerUrl'),
            tls: typeof mqtt.tls === 'boolean' ? mqtt.tls : undefined,
            clientId: typeof mqtt.clientId === 'string' ? mqtt.clientId : undefined,
            keepaliveSeconds:
                typeof mqtt.keepaliveSeconds === 'number' ? mqtt.keepaliveSeconds : undefined,
        },
        mapping: mapping as Record<string, string[]>,
        rateLimitSeconds:
            typeof root.rateLimitSeconds === 'number' ? root.rateLimitSeconds : undefined,
    }

    return normalizeConfig(config)
}
