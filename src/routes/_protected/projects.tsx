import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/projects')({
  component: ProjectsPage,
  staticData: { title: 'Projects' },
});

function ProjectsPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="text-center">
        <h2 className="text-lg font-medium">Projects</h2>
        <p className="text-muted-foreground text-sm">Coming soon.</p>
      </div>
    </div>
  );
}
