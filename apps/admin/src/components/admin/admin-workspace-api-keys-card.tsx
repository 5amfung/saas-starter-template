import { IconCopy } from '@tabler/icons-react';
import * as React from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import type { GeneratedWorkspaceApiKey } from '@/components/admin/admin-generate-workspace-api-key-dialog';
import { AdminDeleteWorkspaceApiKeyDialog } from '@/components/admin/admin-delete-workspace-api-key-dialog';
import { AdminGenerateWorkspaceApiKeyDialog } from '@/components/admin/admin-generate-workspace-api-key-dialog';

interface WorkspaceApiKeyRow {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  configId: string;
  createdAt: Date | string;
}

interface AdminWorkspaceApiKeysCardProps {
  workspaceId: string;
  apiKeys: Array<WorkspaceApiKeyRow>;
}

function formatTimestamp(value: Date | string) {
  return new Date(value).toLocaleString();
}

export function AdminWorkspaceApiKeysCard({
  workspaceId,
  apiKeys,
}: AdminWorkspaceApiKeysCardProps) {
  const [generatedKey, setGeneratedKey] =
    React.useState<GeneratedWorkspaceApiKey | null>(null);

  async function handleCopyGeneratedKey() {
    if (!generatedKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedKey.key);
      toast.success('Generated API key copied.');
    } catch {
      toast.error('Failed to copy generated API key.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Workspace-owned keys used during Enterprise onboarding and support
            workflows. Platform admins manage them on behalf of the workspace.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <AdminGenerateWorkspaceApiKeyDialog
            workspaceId={workspaceId}
            onKeyCreated={setGeneratedKey}
          />
        </div>
        {generatedKey ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="space-y-3">
              <div>
                <div className="font-medium">Copy this API key now</div>
                <p className="text-sm text-muted-foreground">
                  This secret is only shown once. After you leave this page, you
                  can only identify it by its stored prefix and starting
                  characters.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  readOnly
                  value={generatedKey.key}
                  aria-label="Generated API key"
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy generated API key"
                  onClick={() => void handleCopyGeneratedKey()}
                >
                  <IconCopy className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {apiKeys.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No workspace-owned API keys yet.
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="truncate font-medium">
                    {apiKey.name ?? 'Unnamed API Key'}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      {apiKey.start?.trim()
                        ? `${apiKey.start}******`
                        : 'Identifier unavailable'}
                    </span>
                    <span>{apiKey.configId}</span>
                    <span>{formatTimestamp(apiKey.createdAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <AdminDeleteWorkspaceApiKeyDialog
                    workspaceId={workspaceId}
                    apiKeyId={apiKey.id}
                    apiKeyName={apiKey.name}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
