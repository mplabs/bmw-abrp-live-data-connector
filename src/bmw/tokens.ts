import { readFile, writeFile } from 'node:fs/promises'
import { logger } from '../logger'
import { BMW_TOKENS_PATH } from './paths'
import type { BmwConfig } from '../types'

type TokenPayload = Record<string, unknown>

const decodeJwtPayload = (token: string): TokenPayload | null => {
    const parts = token.split('.')
    if (parts.length < 2) {
        return null
    }
    const base = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base + '='.repeat((4 - (base.length % 4)) % 4)
    try {
        const json = Buffer.from(padded, 'base64').toString('utf8')
        return JSON.parse(json) as TokenPayload
    } catch {
        return null
    }
}

const getExpirySeconds = (token: string): number | null => {
    const payload = decodeJwtPayload(token)
    const exp = payload?.exp
    return typeof exp === 'number' ? exp : null
}

const loadTokensFromFile = async () => {
    const resolvedPath = BMW_TOKENS_PATH
    try {
        const raw = await readFile(resolvedPath, 'utf8')
        return JSON.parse(raw) as Record<string, unknown>
    } catch {
        return {}
    }
}

const saveTokensToFile = async (
    tokens: Record<string, unknown>,
): Promise<void> => {
    const resolvedPath = BMW_TOKENS_PATH
    await writeFile(resolvedPath, JSON.stringify(tokens, null, 2))
}

const refreshTokens = async (config: BmwConfig): Promise<Record<string, unknown>> => {
    if (!config.clientId) {
        throw new Error('BMW clientId is required for token refresh')
    }
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: config.tokens.refresh,
        client_id: config.clientId,
    })

    const response = await fetch(config.tokenEndpoint ?? '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`Token refresh failed (${response.status}): ${text}`)
    }

    return (await response.json()) as Record<string, unknown>
}

export class BmwTokenManager {
    private refreshing = false

    constructor(private readonly config: BmwConfig) {}

    private getExpirySeconds(): number | null {
        return getExpirySeconds(this.config.tokens.id)
    }

    isExpired(graceSeconds = 60): boolean {
        const exp = this.getExpirySeconds()
        if (!exp) {
            return true
        }
        const now = Math.floor(Date.now() / 1000)
        return exp - now <= graceSeconds
    }

    private async refreshTokens(): Promise<boolean> {
        if (!this.config.tokenEndpoint) {
            return false
        }
        if (!this.config.clientId) {
            logger.warn('BMW token refresh skipped: missing clientId')
            return false
        }
        if (this.refreshing) {
            return false
        }
        this.refreshing = true
        try {
            logger.info('Refreshing BMW tokens')
            const response = await refreshTokens(this.config)
            const refreshed = {
                access: response.access_token ?? this.config.tokens.access,
                refresh: response.refresh_token ?? this.config.tokens.refresh,
                id: response.id_token ?? this.config.tokens.id,
                gcid: response.gcid ?? undefined,
                raw: response,
            }

            this.config.tokens = {
                access: String(refreshed.access),
                refresh: String(refreshed.refresh),
                id: String(refreshed.id),
            }

            const existing = await loadTokensFromFile()
            const merged = {
                ...existing,
                ...refreshed,
            }
            await saveTokensToFile(merged)
            logger.info('BMW tokens refreshed')
            return true
        } catch (error) {
            logger.error('BMW token refresh failed', { error: (error as Error).message })
            return false
        } finally {
            this.refreshing = false
        }
    }

    async refreshIfNeeded(graceSeconds = 300): Promise<boolean> {
        if (!this.isExpired(graceSeconds)) {
            return false
        }
        return this.refreshTokens()
    }

    async refreshNow(): Promise<boolean> {
        return this.refreshTokens()
    }
}
