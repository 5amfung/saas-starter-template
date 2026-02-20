import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/ws/$workspaceId/members')({
  component: WorkspaceMembersPage,
  staticData: { title: 'Members' },
});

function WorkspaceMembersPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="text-center">
        <h2 className="text-lg font-medium">Members</h2>
        <p className="text-muted-foreground text-sm">Coming soon.</p>
      </div>
    </div>
  );
}
