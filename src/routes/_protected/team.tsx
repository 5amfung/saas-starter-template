import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/team')({
  component: MembersPage,
  staticData: { title: 'Members' },
});

function MembersPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="text-center">
        <h2 className="text-lg font-medium">Members</h2>
        <p className="text-muted-foreground text-sm">Coming soon.</p>
      </div>
    </div>
  );
}
