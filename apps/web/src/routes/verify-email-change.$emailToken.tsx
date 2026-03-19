import { useEffect } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { authClient } from "@/auth/auth-client"
import { AuthLayout } from "@/components/auth/auth-layout"
import { CheckEmailCard } from "@/components/auth/check-email-card"
import { getWebmailLinkForEmail } from "@/lib/email-provider"

const SUCCESS_REDIRECT_DELAY_MS = 3000

function fromBase64Url(base64Url: string) {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/")
  const base64 = padded + "=".repeat((4 - (padded.length % 4)) % 4)

  if (typeof window === "undefined") {
    return Buffer.from(base64, "base64").toString("utf8")
  }

  return decodeURIComponent(escape(window.atob(base64)))
}

export const Route = createFileRoute("/verify-email-change/$emailToken")({
  component: VerifyEmailChangePage,
})

function VerifyEmailChangePage() {
  const navigate = useNavigate()
  const { emailToken } = Route.useParams()
  const { data: session, isPending } = authClient.useSession()

  let email: string | null = null
  try {
    email = fromBase64Url(emailToken).trim()
  } catch {
    email = null
  }

  const isEmailUpdated = !!(
    email &&
    session?.user.emailVerified &&
    session.user.email.toLowerCase() === email.toLowerCase()
  )

  useEffect(() => {
    if (!isEmailUpdated) return
    const timer = window.setTimeout(() => {
      navigate({ to: "/account" })
    }, SUCCESS_REDIRECT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [isEmailUpdated, navigate])

  if (!email) {
    return (
      <AuthLayout>
        <CheckEmailCard
          title="Check your email"
          description="We sent a verification link to your new email address. Click the link to complete the change."
        />
      </AuthLayout>
    )
  }

  if (isPending) return null

  if (isEmailUpdated) {
    return (
      <AuthLayout>
        <CheckEmailCard
          title="Email updated"
          description={
            <>
              Your email has been successfully updated to{" "}
              <strong>{session.user.email}</strong>.
            </>
          }
          footer={
            <Link to="/account" className="underline-offset-4 hover:underline">
              Go to account settings (redirecting…)
            </Link>
          }
        />
      </AuthLayout>
    )
  }

  const webmail = getWebmailLinkForEmail(email)

  return (
    <AuthLayout>
      <CheckEmailCard
        title="Check your email"
        description={
          <>
            We sent a verification link to <strong>{email}</strong>. Click the
            link in the email to complete the change.
          </>
        }
        footer={
          webmail ? (
            <a
              href={webmail.href}
              target="_blank"
              rel="noreferrer noopener"
              className="underline-offset-4 hover:underline"
            >
              Go to {webmail.label}
            </a>
          ) : undefined
        }
      />
    </AuthLayout>
  )
}
