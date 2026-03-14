// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { AdminMauChart } from './admin-mau-chart';
import { AdminSignupChart } from './admin-signup-chart';

// Mock Recharts — components don't render in jsdom. SVG elements like
// <defs>, <linearGradient>, and <stop> are unrecognized by jsdom, so we
// discard children to avoid console warnings.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: () => <div data-testid="area-chart" />,
  Area: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Legend: () => null,
}));

// Mock shadcn chart components.
vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

describe('AdminMauChart', () => {
  const mauData = [
    { date: '2025-03-01', mau: 100 },
    { date: '2025-03-02', mau: 120 },
  ];

  it('renders chart title', () => {
    render(
      <AdminMauChart
        data={mauData}
        timeRange="30d"
        onTimeRangeChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Monthly Active Users')).toBeInTheDocument();
  });

  it('renders chart description', () => {
    render(
      <AdminMauChart
        data={mauData}
        timeRange="30d"
        onTimeRangeChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Users with a sign-in in the past 30 days'),
    ).toBeInTheDocument();
  });

  it('renders time range options', () => {
    render(
      <AdminMauChart
        data={mauData}
        timeRange="30d"
        onTimeRangeChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Last 30 days').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Last 7 days').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Last 3 months').length).toBeGreaterThan(0);
  });
});

describe('AdminSignupChart', () => {
  const signupData = [
    { date: '2025-03-01', verified: 5, unverified: 2 },
    { date: '2025-03-02', verified: 8, unverified: 1 },
  ];

  it('renders chart title', () => {
    render(
      <AdminSignupChart
        data={signupData}
        timeRange="30d"
        onTimeRangeChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Signups')).toBeInTheDocument();
  });

  it('renders chart description', () => {
    render(
      <AdminSignupChart
        data={signupData}
        timeRange="30d"
        onTimeRangeChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Daily signups by verification status'),
    ).toBeInTheDocument();
  });

  it('renders time range options', () => {
    render(
      <AdminSignupChart
        data={signupData}
        timeRange="7d"
        onTimeRangeChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Last 30 days').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Last 7 days').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Last 3 months').length).toBeGreaterThan(0);
  });
});
