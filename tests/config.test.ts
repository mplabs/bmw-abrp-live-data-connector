import { describe, expect, it } from 'bun:test'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { loadConfig } from '../src/config'

const writeJson = async (filePath: string, data: unknown) => {
    await writeFile(filePath, JSON.stringify(data, null, 2))
}

const writeYaml = async (filePath: string, data: string) => {
    await writeFile(filePath, data)
}

const canUseDataDir = async () => {
    try {
        await mkdir('/data', { recursive: true })
        await access('/data', fsConstants.W_OK)
        return true
    } catch {
        return false
    }
}

const maybeIt = (await canUseDataDir()) ? it : it.skip

describe('loadConfig', () => {
    maybeIt('loads tokens from /data/bmw.tokens.json', async () => {
        const tempDir = path.join(tmpdir(), `abrp-test-${randomUUID()}`)
        await mkdir(tempDir, { recursive: true })

        const tokensPath = '/data/bmw.tokens.json'
        await writeJson(tokensPath, {
            access: 'access-file',
            refresh: 'refresh-file',
            id: 'id-file',
        })

        const configPath = path.join(tempDir, 'config.yaml')
        await writeYaml(
            configPath,
            `bmw:
  clientId: "client-id"
  username: "username"
  topic: "topic"
abrp:
  apiKey: "api"
  userToken: "user"
mqtt:
  host: "broker.example"
  port: 9000
mapping:
  soc: ["vehicle.soc"]
`,
        )

        const config = await loadConfig(configPath)

        expect(config.mqtt.brokerUrl).toBe('mqtts://broker.example:9000')
        expect(config.bmw.tokens.access).toBe('access-file')
        expect(config.bmw.tokens.refresh).toBe('refresh-file')
        expect(config.bmw.tokens.id).toBe('id-file')

        await rm(tokensPath, { force: true })
        await rm(tempDir, { recursive: true, force: true })
    })

    maybeIt('throws when /data/bmw.tokens.json is missing', async () => {
        const tempDir = path.join(tmpdir(), `abrp-test-${randomUUID()}`)
        await mkdir(tempDir, { recursive: true })

        const configPath = path.join(tempDir, 'config.yaml')
        await writeYaml(
            configPath,
            `bmw:
  clientId: "client-id"
  username: "username"
  topic: "topic"
abrp:
  apiKey: "api"
  userToken: "user"
mqtt:
  host: "broker.example"
  port: 9000
mapping:
  soc: ["vehicle.soc"]
`,
        )

        await rm('/data/bmw.tokens.json', { force: true })
        await expect(loadConfig(configPath)).rejects.toThrow('/data/bmw.tokens.json')

        await rm(tempDir, { recursive: true, force: true })
    })
})
