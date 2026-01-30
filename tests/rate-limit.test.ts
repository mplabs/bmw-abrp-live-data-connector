import { describe, expect, it } from 'bun:test'
import { RateLimiter } from '../src/rate-limit'

describe('RateLimiter', () => {
    it('allows the first send and enforces interval', () => {
        const limiter = new RateLimiter(10)

        expect(limiter.shouldSend(100)).toBe(true)
        expect(limiter.shouldSend(105)).toBe(false)
        expect(limiter.shouldSend(109)).toBe(false)
        expect(limiter.shouldSend(110)).toBe(true)
    })

    it('resets after sufficient time passes', () => {
        const limiter = new RateLimiter(5)

        expect(limiter.shouldSend(1)).toBe(true)
        expect(limiter.shouldSend(4)).toBe(false)
        expect(limiter.shouldSend(6)).toBe(true)
        expect(limiter.shouldSend(7)).toBe(false)
        expect(limiter.shouldSend(11)).toBe(true)
    })
})
