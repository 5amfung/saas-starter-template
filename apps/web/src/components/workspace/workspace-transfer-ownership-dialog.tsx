import * as React from 'react';
import { IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog';
import { Input } from '@workspace/ui/components/input';

const CONFIRMATION_TEXT = 'TRANSFER';

type WorkspaceTransferOwnershipDialogProps = {
  open: boolean;
  workspaceName: string;
  targetMemberEmail: string;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onTransfer?: () => Promise<void> | void;
};

export function WorkspaceTransferOwnershipDialog({
  open,
  workspaceName,
  targetMemberEmail,
  isPending = false,
  onOpenChange,
  onTransfer,
}: WorkspaceTransferOwnershipDialogProps) {
  const [confirmation, setConfirmation] = React.useState('');
  const isConfirmed = confirmation === CONFIRMATION_TEXT;

  React.useEffect(() => {
    if (!open) setConfirmation('');
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10">
            <IconAlertTriangle className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>Transfer workspace ownership</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              You are transferring <strong>{workspaceName}</strong> to{' '}
              <strong>{targetMemberEmail}</strong>. Your account will be demoted
              to admin when the transfer completes.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>The workspace must always have exactly one owner.</li>
              <li>
                Billing stays with the workspace, but payment transfer in Stripe
                must be handled separately.
              </li>
              <li>
                This action cannot be reversed unless the new owner transfers
                ownership back to you.
              </li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="workspace-transfer-confirm"
            className="text-sm font-medium"
          >
            Type <strong>{CONFIRMATION_TEXT}</strong> to confirm
          </label>
          <Input
            id="workspace-transfer-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={CONFIRMATION_TEXT}
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!isConfirmed || isPending}
            onClick={(event) => {
              event.preventDefault();
              void onTransfer?.();
            }}
          >
            {isPending && <IconLoader2 className="size-4 animate-spin" />}
            Transfer ownership
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
