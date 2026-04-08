import { seedE2EBaseline } from './seed-e2e-baseline';

async function main() {
  await seedE2EBaseline();
  console.log('Seeded 4 E2E users across 2 workspaces.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
