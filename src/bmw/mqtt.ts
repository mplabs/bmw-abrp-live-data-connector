import mqtt, { type MqttClient } from 'mqtt'
import type { BmwConfig, MqttConfig } from '../types'
import { logger } from '../logger'

export type MessageHandler = (topic: string, payload: Buffer) => void

const normalizeTopicPrefix = (topicPrefix: string | undefined): string => {
    const prefix = topicPrefix?.trim() || 'bmw/'
    return prefix.endsWith('/') ? prefix : `${prefix}/`
}

const buildSubscribeTopic = (bmw: BmwConfig, mqttConfig: MqttConfig): string => {
    if (mqttConfig.source === 'mirror') {
        const prefix = normalizeTopicPrefix(mqttConfig.topicPrefix)
        return `${prefix}raw/${bmw.topic}/#`
    }
    if (!bmw.username) {
        throw new Error('bmw.username is required when mqtt.source is "bmw"')
    }
    return `${bmw.username}/${bmw.topic}/#`
}

export const connectBmwMqtt = (
    bmw: BmwConfig,
    mqttConfig: MqttConfig,
    onMessage: MessageHandler,
): MqttClient => {
    const source = mqttConfig.source ?? 'bmw'
    const subscribeTopic = buildSubscribeTopic(bmw, mqttConfig)
    const clientId = mqttConfig.clientId ?? `abrp-bmw-${bmw.topic.slice(-6)}-${Date.now()}`
    const username = mqttConfig.username ?? (source === 'bmw' ? bmw.username : undefined)
    const password = mqttConfig.password ?? (source === 'bmw' ? bmw.tokens.id : undefined)

    logger.info('MQTT auth configured', {
        source,
        username,
        hasPassword: Boolean(password),
    })

    const client = mqtt.connect(mqttConfig.brokerUrl, {
        username,
        password,
        clientId,
        keepalive: mqttConfig.keepaliveSeconds,
        reconnectPeriod: 5000,
    })

    client.on('connect', () => {
        logger.info('MQTT connected', { topic: subscribeTopic })
        client.subscribe(subscribeTopic, { qos: 0 }, (err) => {
            if (err) {
                logger.error('MQTT subscribe failed', { error: err.message })
            } else {
                logger.info('MQTT subscribed', { topic: subscribeTopic })
            }
        })
    })

    client.on('message', (topic, payload) => {
        onMessage(topic, payload)
    })

    client.on('reconnect', () => {
        logger.warn('MQTT reconnecting')
    })

    client.on('error', (error) => {
        logger.error('MQTT error', { error: error.message })
    })

    client.on('close', () => {
        logger.warn('MQTT connection closed')
    })

    return client
}
