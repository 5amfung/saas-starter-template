// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { z } from 'zod';
import type { schema } from '@/components/data-table';
import { DataTable } from '@/components/data-table';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  KeyboardSensor: vi.fn(),
  MouseSensor: vi.fn(),
  TouchSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToVerticalAxis: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  arrayMove: vi.fn((arr, from, to) => {
    const result = [...arr];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
  }),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ''),
    },
  },
}));

vi.mock('@workspace/ui/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock('sonner', () => ({
  toast: {
    promise: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

type Row = z.infer<typeof schema>;

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: 1,
  header: 'Executive Summary',
  type: 'Executive Summary',
  status: 'In Progress',
  target: '100',
  limit: '200',
  reviewer: 'Assign reviewer',
  ...overrides,
});

const sampleData: Array<Row> = [
  makeRow({ id: 1, header: 'Executive Summary', status: 'Done' }),
  makeRow({ id: 2, header: 'Technical Approach', status: 'In Progress' }),
  makeRow({ id: 3, header: 'Cover Page', reviewer: 'Eddie Lake' }),
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DataTable', () => {
  it('renders the table with column headers', () => {
    render(<DataTable data={sampleData} />);

    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Section Type')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    // "Reviewer" appears as the column header and in hidden labels; check for at least one.
    expect(screen.getAllByText('Reviewer').length).toBeGreaterThan(0);
  });

  it('renders a row for each data item', () => {
    render(<DataTable data={sampleData} />);

    // Each header value appears multiple times (row button + type badge), so check presence.
    expect(screen.getAllByText('Executive Summary').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Technical Approach').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cover Page').length).toBeGreaterThan(0);
  });

  it('renders the empty state when data is empty', () => {
    render(<DataTable data={[]} />);

    expect(screen.getByText('No results.')).toBeInTheDocument();
  });

  it('renders tab navigation', () => {
    render(<DataTable data={sampleData} />);

    expect(screen.getByText('Outline')).toBeInTheDocument();
    expect(screen.getByText('Past Performance')).toBeInTheDocument();
    expect(screen.getByText('Key Personnel')).toBeInTheDocument();
    expect(screen.getByText('Focus Documents')).toBeInTheDocument();
  });

  it('renders the Customize Columns button', () => {
    render(<DataTable data={sampleData} />);

    // The text is shown depending on screen size; both exist in DOM.
    expect(screen.getByText('Columns')).toBeInTheDocument();
  });

  it('renders the Add Section button', () => {
    render(<DataTable data={sampleData} />);

    expect(screen.getByText('Add Section')).toBeInTheDocument();
  });

  it('shows reviewer name when already assigned', () => {
    render(<DataTable data={sampleData} />);

    expect(screen.getByText('Eddie Lake')).toBeInTheDocument();
  });

  it('renders pagination controls', () => {
    render(<DataTable data={sampleData} />);

    expect(screen.getByText(/page 1/i)).toBeInTheDocument();
  });
});
