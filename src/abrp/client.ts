import type { AbrpConfig, Telemetry } from '../types'
import { logger } from '../logger'

export class AbrpClient {
    private readonly apiKey: string
    private readonly userToken: string

    constructor(config: AbrpConfig) {
        this.apiKey = config.apiKey
        this.userToken = config.userToken
    }

    async sendTelemetry(telemetry: Telemetry): Promise<void> {
        const url = new URL('https://api.iternio.com/1/tlm/send')
        url.searchParams.set('token', this.userToken)

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `APIKEY ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tlm: telemetry }),
        })

        if (!response.ok) {
            const text = await response.text()
            logger.warn('ABRP telemetry rejected', {
                status: response.status,
                body: text,
            })
            return
        }

        logger.info('ABRP telemetry sent', { status: response.status })
    }
}
