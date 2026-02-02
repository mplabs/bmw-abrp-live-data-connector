import { readFile } from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import { z } from 'zod'
import { BMW_DEVICE_CODE_ENDPOINT, BMW_TOKEN_ENDPOINT } from './bmw/endpoints'
import { BMW_TOKENS_PATH } from './bmw/paths'
import type { AppConfig } from './types'

const parseWithSchema = <T>(schema: z.ZodSchema<T>, data: unknown, name: string): T => {
    const result = schema.safeParse(data)
    if (!result.success) {
        const details = result.error.issues
            .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
            .join('; ')
        throw new Error(`${name} validation failed: ${details}`)
    }
    return result.data
}

const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error'])

const TokensSchema = z
    .object({
        access: z.string().min(1),
        refresh: z.string().min(1),
        id: z.string().min(1),
    })
    .passthrough()

const ConfigSchema = z
    .object({
        bmw: z
            .object({
                clientId: z.string().min(1),
                username: z.string().min(1),
                topic: z.string().min(1),
                deviceCodeEndpoint: z.string().url().optional(),
                tokenEndpoint: z.string().url().optional(),
            })
            .strict(),
        abrp: z
            .object({
                apiKey: z.string().min(1),
                userToken: z.string().min(1),
            })
            .strict(),
        mqtt: z
            .object({
                host: z.string().min(1),
                port: z.number().int().positive(),
                tls: z.boolean().optional(),
                clientId: z.string().optional(),
                keepaliveSeconds: z.number().int().optional(),
            })
            .strict(),
        mapping: z.record(z.array(z.string())),
        rateLimitSeconds: z.number().int().optional(),
        logLevel: LogLevelSchema.optional(),
    })
    .strict()

const normalizeConfig = (config: AppConfig): AppConfig => {
    return {
        ...config,
        mqtt: {
            ...config.mqtt,
            tls: config.mqtt.tls ?? true,
            keepaliveSeconds: config.mqtt.keepaliveSeconds ?? 60,
        },
        rateLimitSeconds: config.rateLimitSeconds ?? 10,
        logLevel: config.logLevel ?? 'info',
    }
}

const loadTokensFromFile = async (tokensPath: string): Promise<Record<string, unknown>> => {
    const resolvedPath = path.isAbsolute(tokensPath) ? tokensPath : path.resolve(tokensPath)
    try {
        const raw = await readFile(resolvedPath, 'utf8')
        return JSON.parse(raw) as Record<string, unknown>
    } catch (error) {
        const message = (error as Error).message
        throw new Error(`Failed to load BMW tokens at ${resolvedPath}: ${message}`)
    }
}

export const loadConfig = async (configPath?: string): Promise<AppConfig> => {
    const resolvedPath = configPath || process.env.CONFIG_PATH || 'config.yaml'
    const raw = await readFile(resolvedPath, 'utf8')
    const ext = path.extname(resolvedPath).toLowerCase()
    const parsed = ext === '.yaml' || ext === '.yml' ? YAML.parse(raw) : JSON.parse(raw)

    const root = parseWithSchema(ConfigSchema, parsed, 'config')
    const tokensFromFile = await loadTokensFromFile(BMW_TOKENS_PATH)
    const bmwTokens = parseWithSchema(TokensSchema, tokensFromFile, 'bmw.tokens')
    const tls = root.mqtt.tls ?? true
    const brokerUrl = `${tls ? 'mqtts' : 'mqtt'}://${root.mqtt.host}:${root.mqtt.port}`

    const config: AppConfig = {
        bmw: {
            clientId: root.bmw.clientId,
            username: root.bmw.username,
            topic: root.bmw.topic,
            deviceCodeEndpoint: root.bmw.deviceCodeEndpoint ?? BMW_DEVICE_CODE_ENDPOINT,
            tokenEndpoint: root.bmw.tokenEndpoint ?? BMW_TOKEN_ENDPOINT,
            tokens: {
                access: bmwTokens.access,
                refresh: bmwTokens.refresh,
                id: bmwTokens.id,
            },
        },
        abrp: {
            apiKey: root.abrp.apiKey,
            userToken: root.abrp.userToken,
        },
        mqtt: {
            brokerUrl,
            tls,
            clientId: root.mqtt.clientId,
            keepaliveSeconds: root.mqtt.keepaliveSeconds,
        },
        mapping: root.mapping,
        rateLimitSeconds: root.rateLimitSeconds,
        logLevel: root.logLevel,
    }

    return normalizeConfig(config)
}
