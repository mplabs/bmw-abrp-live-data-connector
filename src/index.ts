import { loadConfig } from './config'
import { logger, setLogLevel } from './logger'
import { BmwTokenManager } from './bmw/tokens'
import { connectBmwMqtt } from './bmw/mqtt'
import { fetchTelematicData, resolveContainerId } from './bmw/rest'
import { AbrpClient } from './abrp/client'
import { extractTelemetry } from './mapping'
import { RateLimiter } from './rate-limit'

const main = async () => {
    const configPath = process.env.CONFIG_PATH || 'config.yaml'
    const config = await loadConfig(configPath)
    setLogLevel(config.logLevel ?? 'info')

    logger.info('Config loaded', {
        rateLimitSeconds: config.rateLimitSeconds,
        logLevel: config.logLevel ?? 'info',
    })

    const bmwAuthRequired =
        config.bmwRest.enabled ||
        (config.mqtt.enabled && (config.mqtt.source ?? 'bmw') === 'bmw')

    const tokenManager = bmwAuthRequired ? new BmwTokenManager(config.bmw) : null
    if (tokenManager) {
        await tokenManager.refreshIfNeeded()
    }

    const abrp = new AbrpClient(config.abrp)
    const rateLimiter = new RateLimiter(config.rateLimitSeconds ?? 10)

    let lastSocMissingLogAt = 0
    let socMissingCount = 0
    const latest: Record<string, unknown> = {}

    let mqttMessageCount = 0
    let lastMqttMessageAt: number | null = null
    const applyTelemetry = async (incoming: ReturnType<typeof extractTelemetry>, source: string) => {
        if (incoming.soc !== undefined) latest.soc = incoming.soc
        if (incoming.is_charging !== undefined) latest.is_charging = incoming.is_charging
        if (incoming.is_plugged_in !== undefined) latest.is_plugged_in = incoming.is_plugged_in
        if (incoming.lat !== undefined) latest.lat = incoming.lat
        if (incoming.lon !== undefined) latest.lon = incoming.lon
        if (incoming.elevation !== undefined) latest.elevation = incoming.elevation
        if (incoming.heading !== undefined) latest.heading = incoming.heading
        if (incoming.speed !== undefined) latest.speed = incoming.speed
        if (incoming.power !== undefined) latest.power = incoming.power
        if (incoming.charging_power !== undefined) latest.charging_power = incoming.charging_power
        if (incoming.remaining_charge_time !== undefined) {
            latest.remaining_charge_time = incoming.remaining_charge_time
        }
        if (incoming.remaining_range !== undefined) {
            latest.remaining_range = incoming.remaining_range
        }
        if (incoming.tire_pressure_fl !== undefined) {
            latest.tire_pressure_fl = incoming.tire_pressure_fl
        }
        if (incoming.tire_pressure_fr !== undefined) {
            latest.tire_pressure_fr = incoming.tire_pressure_fr
        }
        if (incoming.tire_pressure_rl !== undefined) {
            latest.tire_pressure_rl = incoming.tire_pressure_rl
        }
        if (incoming.tire_pressure_rr !== undefined) {
            latest.tire_pressure_rr = incoming.tire_pressure_rr
        }

        const soc = latest.soc as number | undefined
        if (soc === undefined) {
            socMissingCount += 1
            const now = Date.now()
            if (now - lastSocMissingLogAt >= 10000) {
                logger.warn('Telemetry missing soc; skipping ABRP push', {
                    count: socMissingCount,
                    source,
                })
                socMissingCount = 0
                lastSocMissingLogAt = now
            }
            return
        }

        const nowSeconds = Math.floor(Date.now() / 1000)
        if (!rateLimiter.shouldSend(nowSeconds)) {
            logger.debug('Rate limit active; skipping ABRP push', { utc: nowSeconds, source })
            return
        }

        const snapshot = {
            utc: nowSeconds,
            soc,
            is_charging: latest.is_charging as boolean | undefined,
            is_plugged_in: latest.is_plugged_in as boolean | undefined,
            lat: latest.lat as number | undefined,
            lon: latest.lon as number | undefined,
            elevation: latest.elevation as number | undefined,
            heading: latest.heading as number | undefined,
            speed: latest.speed as number | undefined,
            power: latest.power as number | undefined,
            charging_power: latest.charging_power as number | undefined,
            remaining_charge_time: latest.remaining_charge_time as number | undefined,
            remaining_range: latest.remaining_range as number | undefined,
            tire_pressure_fl: latest.tire_pressure_fl as number | undefined,
            tire_pressure_fr: latest.tire_pressure_fr as number | undefined,
            tire_pressure_rl: latest.tire_pressure_rl as number | undefined,
            tire_pressure_rr: latest.tire_pressure_rr as number | undefined,
        }

        logger.debug('Telemetry snapshot', snapshot)

        try {
            await abrp.sendTelemetry(snapshot)
        } catch (error) {
            logger.error('ABRP telemetry send failed', { error: (error as Error).message })
        }
    }

    const handleMqttMessage = (topic: string, payload: Buffer) => {
        void (async () => {
            mqttMessageCount += 1
            const now = Date.now()
            const intervalMs = lastMqttMessageAt === null ? null : now - lastMqttMessageAt
            lastMqttMessageAt = now
            logger.debug('MQTT message received', {
                count: mqttMessageCount,
                bytes: payload.length,
                intervalMs,
            })

            const payloadText = payload.toString('utf8')
            logger.debug('MQTT raw payload', {
                bytes: payload.length,
                payload: payloadText,
            })

            let decoded: unknown
            try {
                decoded = JSON.parse(payloadText)
            } catch (error) {
                logger.warn('MQTT payload parse failed', { error: (error as Error).message })
                return
            }

            const incoming = extractTelemetry(decoded, config.mapping)
            await applyTelemetry(incoming, 'mqtt')
        })()
    }

    let shuttingDown = false
    const shutdown = (signal: NodeJS.Signals) => {
        if (shuttingDown) {
            return
        }
        shuttingDown = true
        logger.info('Shutting down', { signal })
        if (mqttClient) {
            mqttClient.end(true)
            mqttClient = null
        }
        if (refreshTimer) {
            clearInterval(refreshTimer)
            refreshTimer = null
        }
        if (restTimer) {
            clearInterval(restTimer)
            restTimer = null
        }
        const forceExit = setTimeout(() => {
            logger.warn('Forced shutdown')
            process.exit(0)
        }, 5_000)

        clearTimeout(forceExit)
        process.exit(0)
    }

    process.once('SIGINT', () => shutdown('SIGINT'))
    process.once('SIGTERM', () => shutdown('SIGTERM'))

    let restTimer: NodeJS.Timeout | null = null
    let restContainerId: string | null = null
    let mqttClient: ReturnType<typeof connectBmwMqtt> | null = null

    const connectMqtt = (logWhenDisabled = false) => {
        if (!config.mqtt.enabled) {
            if (logWhenDisabled) {
                logger.info('MQTT disabled')
            }
            return
        }
        mqttClient?.end(true)
        mqttClient = connectBmwMqtt(config.bmw, config.mqtt, handleMqttMessage)
    }

    const startRestPolling = async () => {
        if (!config.bmwRest.enabled) {
            return
        }
        try {
            restContainerId = await resolveContainerId(config.bmwRest, config.bmw)
        } catch (error) {
            logger.error('BMW REST setup failed', { error: (error as Error).message })
            return
        }

        const poll = async () => {
            if (shuttingDown) {
                return
            }
            try {
                const payload = await fetchTelematicData(
                    config.bmwRest,
                    config.bmw,
                    config.bmw.topic,
                    restContainerId as string,
                )
                const incoming = extractTelemetry(payload, config.mapping)
                await applyTelemetry(incoming, 'rest')
            } catch (error) {
                const err = error as Error & { status?: number }
                logger.error('BMW REST poll failed', { error: err.message, status: err.status })
                if (err.status === 401) {
                    const refreshed = tokenManager ? await tokenManager.refreshNow() : false
                    if (refreshed) {
                        restContainerId = await resolveContainerId(
                            config.bmwRest,
                            config.bmw,
                        )
                        connectMqtt()
                    }
                }
            }
        }

        await poll()
        restTimer = setInterval(poll, config.bmwRest.intervalSeconds * 1000)
        logger.info('BMW REST polling enabled', {
            intervalSeconds: config.bmwRest.intervalSeconds,
        })
    }

    await startRestPolling()
    connectMqtt(true)

    let refreshTimer: NodeJS.Timeout | null = tokenManager
        ? setInterval(async () => {
              if (shuttingDown) {
                  return
              }
              const refreshed = await tokenManager.refreshIfNeeded()
              if (refreshed && config.mqtt.enabled) {
                  connectMqtt()
              }
          }, 60_000)
        : null
}

main().catch((error) => {
    logger.error('Fatal error', { error: (error as Error).message })
    process.exit(1)
})
