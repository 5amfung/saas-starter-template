import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockSend = vi.fn()

/** Helper: reset modules, re-register resend mock, dynamically import sendEmail. */
async function importSendEmail() {
  vi.resetModules()
  vi.doMock("resend", () => ({
    Resend: class {
      emails = { send: mockSend }
    },
  }))
  const mod = await import("@/email/resend.server")
  return mod
}

describe("sendEmail", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    mockSend.mockReset()
    process.env.RESEND_API_KEY = "test-api-key"
    process.env.RESEND_FROM_EMAIL = "noreply@test.com"
    process.env.RESEND_REPLY_TO_EMAIL = ""
    process.env.NODE_ENV = "test"
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("sends email with correct params and [DEV] prefix in non-production", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null })
    const { sendEmail } = await importSendEmail()

    const mockReact = createElement("div", null, "Hello")
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Welcome",
      react: mockReact,
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@test.com",
        to: "user@example.com",
        subject: "[DEV] Welcome",
        react: mockReact,
      })
    )
    expect(result).toEqual({ id: "email-1" })
  })

  it("does not prefix subject in production", async () => {
    process.env.NODE_ENV = "production"
    mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null })
    const { sendEmail } = await importSendEmail()

    await sendEmail({
      to: "user@example.com",
      subject: "Welcome",
      react: createElement("div"),
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Welcome" })
    )
  })

  it("throws when Resend API returns an error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Rate limit exceeded" },
    })
    const { sendEmail } = await importSendEmail()

    await expect(
      sendEmail({
        to: "user@example.com",
        subject: "Test",
        react: createElement("div"),
      })
    ).rejects.toThrow("Failed to send email: Rate limit exceeded")
  })

  it("throws when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY
    const { sendEmail } = await importSendEmail()

    await expect(
      sendEmail({
        to: "user@example.com",
        subject: "Test",
        react: createElement("div"),
      })
    ).rejects.toThrow("RESEND_API_KEY is required")
  })

  it("throws when RESEND_FROM_EMAIL is missing", async () => {
    delete process.env.RESEND_FROM_EMAIL
    const { sendEmail } = await importSendEmail()

    await expect(
      sendEmail({
        to: "user@example.com",
        subject: "Test",
        react: createElement("div"),
      })
    ).rejects.toThrow("RESEND_FROM_EMAIL is required")
  })

  it("includes replyTo when RESEND_REPLY_TO_EMAIL is set", async () => {
    process.env.RESEND_REPLY_TO_EMAIL = "reply@test.com"
    mockSend.mockResolvedValue({ data: { id: "email-3" }, error: null })
    const { sendEmail } = await importSendEmail()

    await sendEmail({
      to: "user@example.com",
      subject: "Test",
      react: createElement("div"),
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "reply@test.com" })
    )
  })
})
