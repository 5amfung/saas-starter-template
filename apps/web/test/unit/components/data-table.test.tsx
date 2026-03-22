// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

// 25 rows is enough to span 3 pages at the default page size of 10.
const manyRows = Array.from({ length: 25 }, (_, i) =>
  makeRow({ id: i + 1, header: `Section ${i + 1}` })
);

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

describe('DataTable pagination', () => {
  it('disables previous and first page buttons on page 1', () => {
    render(<DataTable data={manyRows} />);

    // First-page and previous-page buttons use sr-only text for accessible names.
    expect(
      screen.getByRole('button', { name: /go to first page/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /go to previous page/i })
    ).toBeDisabled();
  });

  it('enables next and last page buttons on page 1', () => {
    render(<DataTable data={manyRows} />);

    expect(
      screen.getByRole('button', { name: /go to next page/i })
    ).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: /go to last page/i })
    ).not.toBeDisabled();
  });

  it('navigates to the next page', async () => {
    const user = userEvent.setup();
    render(<DataTable data={manyRows} />);

    await user.click(screen.getByRole('button', { name: /go to next page/i }));

    expect(screen.getByText(/page 2 of/i)).toBeInTheDocument();
  });

  it('navigates to the last page and disables next and last page buttons', async () => {
    const user = userEvent.setup();
    render(<DataTable data={manyRows} />);

    await user.click(screen.getByRole('button', { name: /go to last page/i }));

    // 25 rows / 10 per page = 3 pages.
    expect(screen.getByText(/page 3 of/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /go to next page/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /go to last page/i })
    ).toBeDisabled();
  });

  it('navigates back to the first page', async () => {
    const user = userEvent.setup();
    render(<DataTable data={manyRows} />);

    // Advance to the last page, then return to the first.
    await user.click(screen.getByRole('button', { name: /go to last page/i }));
    await user.click(screen.getByRole('button', { name: /go to first page/i }));

    expect(screen.getByText(/page 1 of/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /go to first page/i })
    ).toBeDisabled();
  });

  it('changes rows per page via select', async () => {
    const user = userEvent.setup();
    render(<DataTable data={manyRows} />);

    // The label is "Rows per page"; the associated select has id="rows-per-page".
    const trigger = screen.getByRole('combobox', { name: /rows per page/i });
    await user.click(trigger);

    // Choose 20 rows per page; all 25 rows now fit on 2 pages.
    await user.click(screen.getByRole('option', { name: '20' }));

    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
  });
});

describe('TableCellViewer mobile vs desktop', () => {
  // jsdom does not implement matchMedia — vaul (Drawer) requires it.
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('shows chart in drawer on desktop', async () => {
    const user = userEvent.setup();
    render(<DataTable data={sampleData} />);

    // Click the header link to open the drawer (useIsMobile is mocked to false).
    await user.click(
      screen.getAllByRole('button', { name: /executive summary/i })[0]
    );

    // "Trending up by 5.2% this month" only renders inside the chart block (desktop only).
    expect(
      screen.getByText(/trending up by 5\.2% this month/i)
    ).toBeInTheDocument();
  });

  it('hides chart in drawer on mobile', async () => {
    const { useIsMobile } = await import('@workspace/ui/hooks/use-mobile');
    (useIsMobile as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const user = userEvent.setup();
    render(<DataTable data={sampleData} />);

    await user.click(
      screen.getAllByRole('button', { name: /executive summary/i })[0]
    );

    // The chart description block is absent on mobile.
    expect(
      screen.queryByText(/trending up by 5\.2% this month/i)
    ).not.toBeInTheDocument();

    // Reset to desktop for subsequent tests.
    (useIsMobile as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });
});
