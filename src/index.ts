import { loadConfig } from './config'
import { logger } from './logger'
import { connectBmwMqtt } from './bmw/mqtt'
import { AbrpClient } from './abrp/client'
import { extractTelemetry } from './mapping'
import { RateLimiter } from './rate-limit'

const main = async () => {
    const config = await loadConfig()

    logger.info('Config loaded', {
        rateLimitSeconds: config.rateLimitSeconds,
        mqtt: { brokerUrl: config.mqtt.brokerUrl },
    })

    const abrp = new AbrpClient(config.abrp)
    const rateLimiter = new RateLimiter(config.rateLimitSeconds ?? 10)

    const client = connectBmwMqtt(config.bmw, config.mqtt, async (_topic, payload) => {
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

    const shutdown = () => {
        logger.info('Shutting down')
        client.end(true)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main().catch((error) => {
    logger.error('Fatal error', { error: (error as Error).message })
    process.exit(1)
})
