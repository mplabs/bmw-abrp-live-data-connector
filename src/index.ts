import { loadConfig } from './config'
import { logger, setLogLevel } from './logger'
import { connectBmwMqtt } from './bmw/mqtt'
import { AbrpClient } from './abrp/client'
import { extractTelemetry } from './mapping'
import { RateLimiter } from './rate-limit'

const main = async () => {
    const config = await loadConfig()
    setLogLevel(config.logLevel ?? 'info')

    logger.info('Config loaded', {
        rateLimitSeconds: config.rateLimitSeconds,
        mqtt: { brokerUrl: config.mqtt.brokerUrl },
        logLevel: config.logLevel ?? 'info',
    })

    const abrp = new AbrpClient(config.abrp)
    const rateLimiter = new RateLimiter(config.rateLimitSeconds ?? 10)

    let messageCount = 0
    let lastMessageAt: number | null = null
    const client = connectBmwMqtt(config.bmw, config.mqtt, async (_topic, payload) => {
        messageCount += 1
        const nowMs = Date.now()
        if (lastMessageAt === null || nowMs - lastMessageAt >= 1000) {
            const intervalMs = lastMessageAt ? nowMs - lastMessageAt : null
            logger.debug('MQTT message received', {
                count: messageCount,
                bytes: payload.length,
                intervalMs,
            })
            lastMessageAt = nowMs
        }
        let parsed: unknown
        try {
            parsed = JSON.parse(payload.toString('utf8'))
        } catch (error) {
            logger.warn('MQTT payload is not valid JSON', {
                error: (error as Error).message,
            })
            return
        }

        const telemetry = extractTelemetry(parsed, config.mapping)
        if (telemetry.soc === undefined) {
            logger.warn('Telemetry missing soc; skipping ABRP push', {
                utc: telemetry.utc,
            })
            return
        }

        const nowSeconds = Math.floor(Date.now() / 1000)
        if (!rateLimiter.shouldSend(nowSeconds)) {
            logger.debug('Rate limit active; skipping ABRP push', {
                utc: telemetry.utc,
            })
            return
        }

        try {
            await abrp.sendTelemetry(telemetry)
        } catch (error) {
            logger.error('ABRP telemetry send failed', { error: (error as Error).message })
        }
    })

    let shuttingDown = false
    const shutdown = (signal: NodeJS.Signals) => {
        if (shuttingDown) {
            return
        }
        shuttingDown = true
        logger.info('Shutting down', { signal })
        client.end(true, () => {
            process.exit(0)
        })
    }

    process.once('SIGINT', () => shutdown('SIGINT'))
    process.once('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error) => {
    logger.error('Fatal error', { error: (error as Error).message })
    process.exit(1)
})
