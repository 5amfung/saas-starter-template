import { createServerFnMock } from '../../mocks/server-fn';
import {
  getAdminDashboardMetrics,
  getMauChartData,
  getSignupChartData,
} from '@/admin/admin.functions';

const {
  requireAdminMock,
  queryDashboardMetricsMock,
  querySignupChartDataMock,
  queryMauChartDataMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  queryDashboardMetricsMock: vi.fn(),
  querySignupChartDataMock: vi.fn(),
  queryMauChartDataMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => createServerFnMock());

vi.mock('@/admin/admin.server', () => ({
  requireAdmin: requireAdminMock,
  queryDashboardMetrics: queryDashboardMetricsMock,
  querySignupChartData: querySignupChartDataMock,
  queryMauChartData: queryMauChartDataMock,
}));

describe('getAdminDashboardMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when requireAdmin throws', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(
      getAdminDashboardMetrics({ data: { timezoneOffset: -300 } })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('passes timezoneOffset to queryDashboardMetrics', async () => {
    requireAdminMock.mockResolvedValueOnce({});
    queryDashboardMetricsMock.mockResolvedValueOnce({ users: 10 });
    await getAdminDashboardMetrics({ data: { timezoneOffset: -300 } });
    expect(queryDashboardMetricsMock).toHaveBeenCalledWith(-300);
  });

  it('returns the query result', async () => {
    const metrics = { users: 42, signups: 5 };
    requireAdminMock.mockResolvedValueOnce({});
    queryDashboardMetricsMock.mockResolvedValueOnce(metrics);
    const result = await getAdminDashboardMetrics({
      data: { timezoneOffset: 0 },
    });
    expect(result).toEqual(metrics);
  });
});

describe('getSignupChartData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when requireAdmin throws', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(
      getSignupChartData({ data: { days: 7, timezoneOffset: -300 } })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('passes days and timezoneOffset to querySignupChartData', async () => {
    requireAdminMock.mockResolvedValueOnce({});
    querySignupChartDataMock.mockResolvedValueOnce([]);
    await getSignupChartData({ data: { days: 30, timezoneOffset: -300 } });
    expect(querySignupChartDataMock).toHaveBeenCalledWith(30, -300);
  });

  it('returns the query result', async () => {
    const chartData = [{ date: '2026-03-01', count: 3 }];
    requireAdminMock.mockResolvedValueOnce({});
    querySignupChartDataMock.mockResolvedValueOnce(chartData);
    const result = await getSignupChartData({
      data: { days: 7, timezoneOffset: 0 },
    });
    expect(result).toEqual(chartData);
  });
});

describe('getMauChartData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when requireAdmin throws', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(
      getMauChartData({ data: { days: 7, timezoneOffset: -300 } })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('passes days and timezoneOffset to queryMauChartData', async () => {
    requireAdminMock.mockResolvedValueOnce({});
    queryMauChartDataMock.mockResolvedValueOnce([]);
    await getMauChartData({ data: { days: 30, timezoneOffset: -300 } });
    expect(queryMauChartDataMock).toHaveBeenCalledWith(30, -300);
  });

  it('returns the query result', async () => {
    const chartData = [{ date: '2026-03-01', mau: 100 }];
    requireAdminMock.mockResolvedValueOnce({});
    queryMauChartDataMock.mockResolvedValueOnce(chartData);
    const result = await getMauChartData({
      data: { days: 7, timezoneOffset: 0 },
    });
    expect(result).toEqual(chartData);
  });
});
