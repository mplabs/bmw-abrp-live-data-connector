import { loadConfig } from './config'
import { logger, setLogLevel } from './logger'
import { connectBmwMqtt } from './bmw/mqtt'
import { BmwTokenManager } from './bmw/tokens'
import { AbrpClient } from './abrp/client'
import { extractTelemetry } from './mapping'
import { RateLimiter } from './rate-limit'

const main = async () => {
    const configPath = process.env.CONFIG_PATH || 'config.yaml'
    const config = await loadConfig(configPath)
    setLogLevel(config.logLevel ?? 'info')

    logger.info('Config loaded', {
        rateLimitSeconds: config.rateLimitSeconds,
        mqtt: { brokerUrl: config.mqtt.brokerUrl },
        logLevel: config.logLevel ?? 'info',
    })

    const tokenManager = new BmwTokenManager(config.bmw, configPath)
    await tokenManager.refreshIfNeeded()

    const abrp = new AbrpClient(config.abrp)
    const rateLimiter = new RateLimiter(config.rateLimitSeconds ?? 10)

    let messageCount = 0
    let lastMessageAt: number | null = null
    let lastSocMissingLogAt = 0
    let socMissingCount = 0
    const latest: Record<string, unknown> = {}
    const handleMessage = async (_topic: string, payload: Buffer) => {
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
        const rawText = payload.toString('utf8')
        try {
            parsed = JSON.parse(rawText)
        } catch (error) {
            logger.warn('MQTT payload is not valid JSON', {
                error: (error as Error).message,
            })
            return
        }

        const incoming = extractTelemetry(parsed, config.mapping)
        if (incoming.soc !== undefined) latest.soc = incoming.soc
        if (incoming.is_charging !== undefined) latest.is_charging = incoming.is_charging
        if (incoming.is_plugged_in !== undefined) latest.is_plugged_in = incoming.is_plugged_in
        if (incoming.lat !== undefined) latest.lat = incoming.lat
        if (incoming.lon !== undefined) latest.lon = incoming.lon
        if (incoming.speed !== undefined) latest.speed = incoming.speed
        if (incoming.power !== undefined) latest.power = incoming.power
        if (incoming.charging_power !== undefined) latest.charging_power = incoming.charging_power
        if (incoming.remaining_charge_time !== undefined) {
            latest.remaining_charge_time = incoming.remaining_charge_time
        }

        const soc = latest.soc as number | undefined
        if (soc === undefined) {
            socMissingCount += 1
            const now = Date.now()
            if (now - lastSocMissingLogAt >= 10000) {
                logger.warn('Telemetry missing soc; skipping ABRP push', {
                    count: socMissingCount,
                })
                socMissingCount = 0
                lastSocMissingLogAt = now
            }
            return
        }

        const nowSeconds = Math.floor(Date.now() / 1000)
        if (!rateLimiter.shouldSend(nowSeconds)) {
            logger.debug('Rate limit active; skipping ABRP push', { utc: nowSeconds })
            return
        }

        const snapshot = {
            utc: nowSeconds,
            soc,
            is_charging: latest.is_charging as boolean | undefined,
            is_plugged_in: latest.is_plugged_in as boolean | undefined,
            lat: latest.lat as number | undefined,
            lon: latest.lon as number | undefined,
            speed: latest.speed as number | undefined,
            power: latest.power as number | undefined,
            charging_power: latest.charging_power as number | undefined,
            remaining_charge_time: latest.remaining_charge_time as number | undefined,
        }

        logger.debug('Telemetry snapshot', snapshot)

        try {
            await abrp.sendTelemetry(snapshot)
        } catch (error) {
            logger.error('ABRP telemetry send failed', { error: (error as Error).message })
        }
    }

    let client = connectBmwMqtt(config.bmw, config.mqtt, handleMessage)

    let shuttingDown = false
    const shutdown = (signal: NodeJS.Signals) => {
        if (shuttingDown) {
            return
        }
        shuttingDown = true
        logger.info('Shutting down', { signal })
        if (refreshTimer) {
            clearInterval(refreshTimer)
            refreshTimer = null
        }
        const forceExit = setTimeout(() => {
            logger.warn('Forced shutdown')
            process.exit(0)
        }, 5_000)

        try {
            client.end(true, () => {
                clearTimeout(forceExit)
                process.exit(0)
            })
        } catch {
            clearTimeout(forceExit)
            process.exit(0)
        }
    }

    process.once('SIGINT', () => shutdown('SIGINT'))
    process.once('SIGTERM', () => shutdown('SIGTERM'))

    let refreshTimer: NodeJS.Timeout | null = setInterval(async () => {
        if (shuttingDown) {
            return
        }
        const refreshed = await tokenManager.refreshIfNeeded()
        if (refreshed) {
            client.end(true)
            client = connectBmwMqtt(config.bmw, config.mqtt, handleMessage)
        }
    }, 60_000)
}

main().catch((error) => {
    logger.error('Fatal error', { error: (error as Error).message })
    process.exit(1)
})
