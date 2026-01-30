import { beforeEach, afterEach, describe, expect, it } from 'bun:test'
import { AbrpClient } from '../src/abrp/client'
import type { Telemetry } from '../src/types'

const sampleTelemetry: Telemetry = {
    utc: 1_700_000_000,
    soc: 75,
    is_charging: false,
}

describe('AbrpClient', () => {
    const realFetch = globalThis.fetch

    afterEach(() => {
        globalThis.fetch = realFetch
    })

    it('sends telemetry to ABRP with correct URL and headers', async () => {
        const calls: Array<{ url: string; init: RequestInit }> = []

        globalThis.fetch = (async (url, init) => {
            calls.push({ url: String(url), init: init ?? {} })
            return {
                ok: true,
                status: 200,
                text: async () => '',
            } as Response
        }) as typeof fetch

        const client = new AbrpClient({ apiKey: 'api-key', userToken: 'user-token' })
        await client.sendTelemetry(sampleTelemetry)

        expect(calls.length).toBe(1)
        const call = calls[0]
        expect(call.url).toBe('https://api.iternio.com/1/tlm/send?token=user-token')
        expect(call.init.method).toBe('POST')
        expect(call.init.headers).toEqual({
            Authorization: 'APIKEY api-key',
            'Content-Type': 'application/json',
        })
        expect(call.init.body).toBe(JSON.stringify({ tlm: sampleTelemetry }))
    })

    it('does not throw when ABRP responds with an error', async () => {
        globalThis.fetch = (async () => {
            return {
                ok: false,
                status: 401,
                text: async () => 'unauthorized',
            } as Response
        }) as typeof fetch

        const client = new AbrpClient({ apiKey: 'api-key', userToken: 'user-token' })
        await expect(client.sendTelemetry(sampleTelemetry)).resolves.toBeUndefined()
    })
})
