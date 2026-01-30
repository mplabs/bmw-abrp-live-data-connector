type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogPayload = Record<string, unknown>

const REDACT_KEYS = new Set([
    'access',
    'refresh',
    'id',
    'token',
    'authorization',
    'apikey',
    'apiKey',
    'userToken',
    'password',
    'clientSecret',
])

const redactValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(redactValue)
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [key, entry] of Object.entries(value)) {
            if (REDACT_KEYS.has(key)) {
                out[key] = '***'
                continue
            }
            out[key] = redactValue(entry)
        }
        return out
    }
    return value
}

export const log = (level: LogLevel, message: string, payload: LogPayload = {}): void => {
    const entry = {
        ts: new Date().toISOString(),
        level,
        msg: message,
        ...payload,
    }
    const redacted = redactValue(entry)
    console.log(JSON.stringify(redacted))
}

export const logger = {
    debug: (message: string, payload?: LogPayload) => log('debug', message, payload),
    info: (message: string, payload?: LogPayload) => log('info', message, payload),
    warn: (message: string, payload?: LogPayload) => log('warn', message, payload),
    error: (message: string, payload?: LogPayload) => log('error', message, payload),
}
