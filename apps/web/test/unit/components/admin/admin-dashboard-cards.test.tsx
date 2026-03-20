// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { AdminDashboardCards } from '@/components/admin/admin-dashboard-cards';

const defaultProps = {
  totalUsers: 150,
  verifiedUsers: 120,
  unverifiedUsers: 30,
  signupsToday: 5,
  verifiedToday: 3,
  unverifiedToday: 2,
};

describe('AdminDashboardCards', () => {
  it('renders verified user count as primary metric', () => {
    render(<AdminDashboardCards {...defaultProps} />);
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('renders total and unverified counts as secondary info', () => {
    render(<AdminDashboardCards {...defaultProps} />);
    expect(screen.getByText(/150 total/)).toBeInTheDocument();
    expect(screen.getByText(/30 unverified/)).toBeInTheDocument();
  });

  it('renders signups today as primary metric', () => {
    render(<AdminDashboardCards {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders today verified and unverified counts', () => {
    render(<AdminDashboardCards {...defaultProps} />);
    expect(screen.getByText(/3 verified/)).toBeInTheDocument();
    expect(screen.getByText(/2 unverified/)).toBeInTheDocument();
  });

  it('renders card titles', () => {
    render(<AdminDashboardCards {...defaultProps} />);
    expect(screen.getByText('Total Verified Users')).toBeInTheDocument();
    expect(screen.getByText('Signups Today')).toBeInTheDocument();
  });

  it('renders with zero values', () => {
    render(
      <AdminDashboardCards
        totalUsers={0}
        verifiedUsers={0}
        unverifiedUsers={0}
        signupsToday={0}
        verifiedToday={0}
        unverifiedToday={0}
      />
    );
    // Should render without crashing.
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });
});
