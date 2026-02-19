import { beforeAll, describe, expect, it } from 'bun:test'
import type { MqttConfig, BmwConfig } from '../src/types'

let connectArgs: { url: string; options: Record<string, unknown> } | null = null
let subscribeArgs: { topic: string; options: Record<string, unknown> } | null = null

const handlers = new Map<string, (...args: unknown[]) => void>()

const fakeClient = {
    on: (event: string, callback: (...args: unknown[]) => void) => {
        handlers.set(event, callback)
    },
    subscribe: (
        topic: string,
        options: Record<string, unknown>,
        callback?: (err?: Error | null) => void,
    ) => {
        subscribeArgs = { topic, options }
        callback?.(null)
    },
    end: () => undefined,
}

beforeAll(async () => {
    const { mock } = await import('bun:test')

    mock.module('mqtt', () => ({
        default: {
            connect: (url: string, options: Record<string, unknown>) => {
                connectArgs = { url, options }
                return fakeClient as unknown
            },
        },
    }))

    await import('../src/bmw/mqtt')
})

describe('connectBmwMqtt', () => {
    it('passes credentials and subscribes to GCID/VIN topic', async () => {
        const { connectBmwMqtt } = await import('../src/bmw/mqtt')

        const bmw: BmwConfig = {
            username: 'user-123',
            topic: 'TOPIC1234567890',
            tokens: {
                access: 'access',
                refresh: 'refresh',
                id: 'id-token',
            },
        }

        const mqttConfig: MqttConfig = {
            brokerUrl: 'mqtt://broker',
            keepaliveSeconds: 30,
        }

        connectArgs = null
        subscribeArgs = null
        handlers.clear()

        const client = connectBmwMqtt(bmw, mqttConfig, () => undefined)
        expect(client).toBe(fakeClient)

        expect(connectArgs).not.toBeNull()
        expect(connectArgs?.url).toBe('mqtt://broker')
        expect(connectArgs?.options).toMatchObject({
            username: 'user-123',
            password: 'id-token',
            keepalive: 30,
            reconnectPeriod: 5000,
        })

        const onConnect = handlers.get('connect')
        expect(onConnect).toBeDefined()

        onConnect?.()
        expect(subscribeArgs).toEqual({
            topic: 'user-123/TOPIC1234567890/#',
            options: { qos: 0 },
        })
    })

    it('generates a default clientId using the VIN suffix', async () => {
        const { connectBmwMqtt } = await import('../src/bmw/mqtt')

        const realNow = Date.now
        Date.now = () => 1_700_000_000_000

        const bmw: BmwConfig = {
            username: 'user-456',
            topic: 'TOPIC-ABCDEF123456',
            tokens: {
                access: 'access',
                refresh: 'refresh',
                id: 'id-token',
            },
        }

        const mqttConfig: MqttConfig = {
            brokerUrl: 'mqtt://broker',
        }

        connectArgs = null
        handlers.clear()

        connectBmwMqtt(bmw, mqttConfig, () => undefined)

        expect(connectArgs?.options.clientId).toBe('abrp-bmw-123456-1700000000000')

        Date.now = realNow
    })

    it('subscribes to mirrored raw topics using the configured prefix', async () => {
        const { connectBmwMqtt } = await import('../src/bmw/mqtt')

        const bmw: BmwConfig = {
            topic: 'WBY71AW050FN29092',
            tokens: {
                access: '',
                refresh: '',
                id: '',
            },
        }

        const mqttConfig: MqttConfig = {
            source: 'mirror',
            brokerUrl: 'mqtt://broker',
            topicPrefix: 'bmw',
            username: 'mirror-user',
            password: 'mirror-pass',
        }

        connectArgs = null
        subscribeArgs = null
        handlers.clear()

        connectBmwMqtt(bmw, mqttConfig, () => undefined)

        expect(connectArgs?.options).toMatchObject({
            username: 'mirror-user',
            password: 'mirror-pass',
        })

        const onConnect = handlers.get('connect')
        expect(onConnect).toBeDefined()

        onConnect?.()
        expect(subscribeArgs).toEqual({
            topic: 'bmw/raw/WBY71AW050FN29092/#',
            options: { qos: 0 },
        })
    })
})
