// Minimal ambient declaration so `await import("resend")` typechecks without the
// package installed. Replace with the real types if/when `resend` is added to deps.
declare module "resend" {
  export class Resend {
    constructor(apiKey: string)
    emails: {
      send(opts: {
        from: string
        to: string | string[]
        subject: string
        html?: string
        text?: string
      }): Promise<unknown>
    }
  }
}
