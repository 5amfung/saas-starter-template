import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { authClient } from "@workspace/auth/client"
import {
  LINKED_ACCOUNTS_QUERY_KEY,
  useLinkedAccountsQuery,
} from "@/hooks/use-linked-accounts-query"
import { GoogleIcon } from "@/components/icons/google-icon"

interface Provider {
  id: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

const PROVIDERS: Array<Provider> = [
  { id: "google", label: "Google", Icon: GoogleIcon },
]

const LINK_ERROR_MESSAGES: Record<string, string> = {
  "email_doesn't_match":
    "Could not connect Google account. Make sure you sign in with the same email address as your account.",
  account_already_linked_to_different_user:
    "This Google account is already connected to another account.",
}

function getLinkErrorMessage(code: string): string {
  return (
    LINK_ERROR_MESSAGES[code] ?? "Failed to connect account. Please try again."
  )
}

export function LinkedAccountsCard() {
  const queryClient = useQueryClient()
  const { data: accounts, isPending } = useLinkedAccountsQuery()
  const [confirmDisconnect, setConfirmDisconnect] = React.useState<
    string | null
  >(null)
  const [connectingId, setConnectingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has("link_error")) return
    const errorCode = params.get("error") ?? ""
    toast.error(getLinkErrorMessage(errorCode))
    params.delete("link_error")
    params.delete("error")
    const newSearch = params.toString()
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (newSearch ? `?${newSearch}` : "")
    )
  }, [])

  const linkedProviderIds = React.useMemo(() => {
    if (!accounts) return new Set<string>()
    return new Set(
      accounts
        .filter((a) => a.providerId !== "credential")
        .map((a) => a.providerId)
    )
  }, [accounts])

  const hasPassword =
    accounts != null
      ? accounts.some((a) => a.providerId === "credential")
      : false

  const totalAuthMethods = (hasPassword ? 1 : 0) + linkedProviderIds.size

  async function handleConnect(providerId: string) {
    setConnectingId(providerId)
    const { error } = await authClient.linkSocial({
      provider: providerId as Parameters<
        typeof authClient.linkSocial
      >[0]["provider"],
      callbackURL: "/account",
      errorCallbackURL: "/account?link_error=1",
    })
    if (error) {
      toast.error(error.message || "Failed to connect account.")
      setConnectingId(null)
    }
    // On success the browser is redirected; no further action needed.
  }

  const disconnectMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const { error } = await authClient.unlinkAccount({ providerId })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      toast.success("Account disconnected.")
      setConfirmDisconnect(null)
      await queryClient.invalidateQueries({
        queryKey: LINKED_ACCOUNTS_QUERY_KEY,
      })
    },
    onError: (err) => {
      toast.error(err.message || "Failed to disconnect account.")
    },
  })

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
          <CardDescription>
            Link social accounts to sign in without a password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPending && <Skeleton className="h-14 w-full" />}

          {!isPending &&
            PROVIDERS.map(({ id, label, Icon }) => {
              const isLinked = linkedProviderIds.has(id)
              const isLastMethod = totalAuthMethods <= 1
              const isConnecting = connectingId === id

              return (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md border bg-muted p-2">
                      <Icon className="size-4" />
                    </div>
                    <span className="text-sm font-medium">{label}</span>
                  </div>

                  {isLinked ? (
                    <span
                      title={
                        isLastMethod
                          ? "You cannot remove your only sign-in method."
                          : undefined
                      }
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={isLastMethod || disconnectMutation.isPending}
                        onClick={() => setConfirmDisconnect(id)}
                      >
                        Disconnect
                      </Button>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isConnecting}
                      onClick={() => void handleConnect(id)}
                    >
                      {isConnecting && (
                        <IconLoader2 className="size-4 animate-spin" />
                      )}
                      Connect
                    </Button>
                  )}
                </div>
              )
            })}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmDisconnect !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDisconnect(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect account?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to sign in with this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!confirmDisconnect || disconnectMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (!confirmDisconnect) return
                disconnectMutation.mutate(confirmDisconnect)
              }}
            >
              {disconnectMutation.isPending && (
                <IconLoader2 className="size-4 animate-spin" />
              )}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
