## Social providers (Google, Apple, Microsoft)

Better Auth social callbacks default to:

- **Callback path**: `/api/auth/callback/<provider>`
- Example (Google): `https://your-app.com/api/auth/callback/google`

### Required baseline config

- **Set the base URL** so Better Auth can construct correct callback URLs:
  - `baseURL: process.env.BETTER_AUTH_URL`
  - or set env `BETTER_AUTH_URL=https://your-app.com`

### Google

- **Env**:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`

- **Server config**:

```ts
socialProviders: {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  },
}
```

### Apple

Apple requires `trustedOrigins` to include Apple’s identity host.

- **Env** (typical):
  - `APPLE_CLIENT_ID`
  - `APPLE_CLIENT_SECRET`
  - Optional: `APPLE_APP_BUNDLE_IDENTIFIER`

- **Server config**:

```ts
socialProviders: {
  apple: {
    clientId: process.env.APPLE_CLIENT_ID as string,
    clientSecret: process.env.APPLE_CLIENT_SECRET as string,
    appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER as string,
  },
},
trustedOrigins: ["https://appleid.apple.com"],
```

### Microsoft (Entra ID / Azure AD)

- **Env**:
  - `MICROSOFT_CLIENT_ID`
  - `MICROSOFT_CLIENT_SECRET`

- **Server config**:

```ts
socialProviders: {
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID as string,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
    // Optional:
    tenantId: "common",
    authority: "https://login.microsoftonline.com",
    prompt: "select_account",
  },
},
```

### Client usage

In React (TanStack Start client components), trigger social sign-in:

```ts
await authClient.signIn.social({
  provider: "google", // or "apple" or "microsoft"
  callbackURL: "/dashboard",
})
```

### Common mistakes

- **Wrong callback URL**:
  - Fix by setting `BETTER_AUTH_URL` to the correct public origin.
- **Apple failing origin checks**:
  - Ensure `trustedOrigins` includes `https://appleid.apple.com`.
