// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

// Mock AreaChart to intercept the data prop passed to it.
const mockAreaChart = vi.fn(({ children }: { children: React.ReactNode }) => (
  <div data-testid="area-chart">{children}</div>
));

const { mockUseIsMobile } = vi.hoisted(() => ({
  mockUseIsMobile: vi.fn(() => false),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('recharts', () => ({
  Area: ({ children }: { children?: React.ReactNode }) => (
    <g data-testid="area">{children}</g>
  ),
  AreaChart: (props: { children: React.ReactNode; data?: Array<unknown> }) => {
    mockAreaChart(props);
    return <svg data-testid="area-chart">{props.children}</svg>;
  },
  CartesianGrid: () => <g />,
  XAxis: () => <g />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@workspace/ui/hooks/use-mobile', () => ({
  useIsMobile: mockUseIsMobile,
}));

vi.mock('@workspace/ui/components/chart', () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

vi.mock('@workspace/ui/components/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardAction: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@workspace/ui/components/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
}));

vi.mock('@workspace/ui/components/toggle-group', () => ({
  ToggleGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ToggleGroupItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <button data-value={value}>{children}</button>,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChartAreaInteractive', () => {
  let ChartAreaInteractive: () => React.ReactElement;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
    // Dynamic import ensures mocks are applied before the module is evaluated.
    const mod = await import('@/components/chart-area-interactive');
    ChartAreaInteractive = mod.ChartAreaInteractive;
  });

  it('renders with default 90d time range', () => {
    render(<ChartAreaInteractive />);
    expect(mockAreaChart).toHaveBeenCalled();
    const dataLength = (
      mockAreaChart.mock.calls[0][0] as unknown as { data: Array<unknown> }
    ).data.length;
    // The chart data spans 2024-04-01 to 2024-06-30 (91 days). The 90d filter
    // uses startDate = referenceDate(2024-06-30) - 90 days = 2024-04-01, so
    // all 91 entries satisfy date >= 2024-04-01.
    expect(dataLength).toBe(91);
  });

  it('defaults to 7d time range on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<ChartAreaInteractive />);
    // The last call captures the re-render triggered by the useEffect that sets '7d'.
    const lastCall =
      mockAreaChart.mock.calls[mockAreaChart.mock.calls.length - 1];
    // 7d from reference date 2024-06-30 yields entries from June 23–30 (8 entries).
    expect(
      (lastCall[0] as unknown as { data: Array<unknown> }).data.length
    ).toBe(8);
  });

  it('renders chart container', () => {
    render(<ChartAreaInteractive />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });
});
