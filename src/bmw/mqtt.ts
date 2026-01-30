import mqtt, { type MqttClient } from 'mqtt'
import type { BmwConfig, MqttConfig } from '../types'
import { logger } from '../logger'

export type MessageHandler = (topic: string, payload: Buffer) => void

export const connectBmwMqtt = (
    bmw: BmwConfig,
    mqttConfig: MqttConfig,
    onMessage: MessageHandler,
): MqttClient => {
    const clientId = mqttConfig.clientId ?? `abrp-bmw-${bmw.vin.slice(-6)}-${Date.now()}`
    const tokenType = mqttConfig.passwordToken ?? 'id'
    const tokenFromBmw = {
        access: bmw.tokens.access,
        refresh: bmw.tokens.refresh,
        id: bmw.tokens.id,
    }[tokenType]
    const username = mqttConfig.username ?? bmw.gcid
    const password = mqttConfig.password ?? tokenFromBmw

    logger.info('MQTT auth configured', {
        usernameSource: mqttConfig.username ? 'mqtt.username' : 'bmw.gcid',
        passwordSource: mqttConfig.password ? 'mqtt.password' : `bmw.tokens.${tokenType}`,
    })

    const client = mqtt.connect(mqttConfig.brokerUrl, {
        username,
        password,
        clientId,
        keepalive: mqttConfig.keepaliveSeconds,
        reconnectPeriod: 5000,
    })

    client.on('connect', () => {
        const topic = `${bmw.gcid}/${bmw.vin}/#`
        logger.info('MQTT connected', { topic })
        client.subscribe(topic, { qos: 0 }, (err) => {
            if (err) {
                logger.error('MQTT subscribe failed', { error: err.message })
            } else {
                logger.info('MQTT subscribed', { topic })
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
