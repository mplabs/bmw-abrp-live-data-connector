export class RateLimiter {
    private lastSent = 0

    constructor(private readonly intervalSeconds: number) {}

    shouldSend(nowSeconds: number): boolean {
        if (this.lastSent === 0 || nowSeconds - this.lastSent >= this.intervalSeconds) {
            this.lastSent = nowSeconds
            return true
        }
        return false
    }
}
