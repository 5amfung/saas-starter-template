## Email OTP (verification codes, sign-in OTP, forgot password)

Email OTP is implemented via the `emailOTP()` plugin on the server and `emailOTPClient()` on the client.

### Server setup

Add the plugin and implement `sendVerificationOTP`:

```ts
import { emailOTP } from "better-auth/plugins"

plugins: [
  emailOTP({
    overrideDefaultEmailVerification: true,
    async sendVerificationOTP({ email, otp, type }) {
      // Send `otp` to `email`.
      // `type` can be: "sign-in" | "email-verification" | "forget-password".
    },
  }),
]
```

Key options commonly used:

- **`overrideDefaultEmailVerification: true`**: use OTP instead of link-based email verification.
- **`sendVerificationOnSignUp: true`**: automatically start verification on sign-up.

### Client setup

Add the client plugin:

```ts
import { createAuthClient } from "better-auth/react"
import { emailOTPClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
})
```

### Client usage patterns

Send verification OTP:

```ts
await authClient.emailOtp.sendVerificationOtp({
  email,
  type: "email-verification",
})
```

Verify email with OTP:

```ts
await authClient.emailOtp.verifyEmail({
  email,
  otp,
})
```

### Relevant endpoints (server)

These are handled by the Better Auth handler route (`/api/auth/$`):

- `POST /email-otp/send-verification-otp`
- `POST /email-otp/check-verification-otp`
- `POST /sign-in/email-otp`

### Common mistakes

- **OTP emails not sending**: `sendVerificationOTP` must be implemented server-side.
- **Client plugin missing**: add `emailOTPClient()` or `authClient.emailOtp.*` won’t exist.
