import { createServerFnMock } from '../../mocks/server-fn';
import {
  getAdminDashboardMetrics,
  getMauChartData,
  getSignupChartData,
} from '@/admin/admin.functions';

const {
  requireCurrentAdminAppCapabilityMock,
  queryDashboardMetricsMock,
  querySignupChartDataMock,
  queryMauChartDataMock,
} = vi.hoisted(() => ({
  requireCurrentAdminAppCapabilityMock: vi.fn(),
  queryDashboardMetricsMock: vi.fn(),
  querySignupChartDataMock: vi.fn(),
  queryMauChartDataMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => createServerFnMock());

vi.mock('@/admin/admin.server', () => ({
  queryDashboardMetrics: queryDashboardMetricsMock,
  querySignupChartData: querySignupChartDataMock,
  queryMauChartData: queryMauChartDataMock,
}));

vi.mock('@/policy/admin-app-capabilities.server', () => ({
  requireCurrentAdminAppCapability: requireCurrentAdminAppCapabilityMock,
}));

describe('getAdminDashboardMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when dashboard capability guard throws', async () => {
    requireCurrentAdminAppCapabilityMock.mockRejectedValueOnce(
      new Error('Forbidden')
    );
    await expect(
      getAdminDashboardMetrics({ data: { timezoneOffset: -300 } })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('passes timezoneOffset to queryDashboardMetrics', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    queryDashboardMetricsMock.mockResolvedValueOnce({ users: 10 });
    await getAdminDashboardMetrics({ data: { timezoneOffset: -300 } });
    expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
      'canViewDashboard'
    );
    expect(queryDashboardMetricsMock).toHaveBeenCalledWith(-300);
  });

  it('returns the query result', async () => {
    const metrics = { users: 42, signups: 5 };
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
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

  it('rejects when analytics capability guard throws', async () => {
    requireCurrentAdminAppCapabilityMock.mockRejectedValueOnce(
      new Error('Forbidden')
    );
    await expect(
      getSignupChartData({ data: { days: 7, timezoneOffset: -300 } })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('passes days and timezoneOffset to querySignupChartData', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    querySignupChartDataMock.mockResolvedValueOnce([]);
    await getSignupChartData({ data: { days: 30, timezoneOffset: -300 } });
    expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
      'canViewAnalytics'
    );
    expect(querySignupChartDataMock).toHaveBeenCalledWith(30, -300);
  });

  it('returns the query result', async () => {
    const chartData = [{ date: '2026-03-01', count: 3 }];
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
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

  it('rejects when analytics capability guard throws', async () => {
    requireCurrentAdminAppCapabilityMock.mockRejectedValueOnce(
      new Error('Forbidden')
    );
    await expect(
      getMauChartData({ data: { days: 7, timezoneOffset: -300 } })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('passes days and timezoneOffset to queryMauChartData', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    queryMauChartDataMock.mockResolvedValueOnce([]);
    await getMauChartData({ data: { days: 30, timezoneOffset: -300 } });
    expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
      'canViewAnalytics'
    );
    expect(queryMauChartDataMock).toHaveBeenCalledWith(30, -300);
  });

  it('returns the query result', async () => {
    const chartData = [{ date: '2026-03-01', mau: 100 }];
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    queryMauChartDataMock.mockResolvedValueOnce(chartData);
    const result = await getMauChartData({
      data: { days: 7, timezoneOffset: 0 },
    });
    expect(result).toEqual(chartData);
  });
});
