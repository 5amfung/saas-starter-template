// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SortingState } from '@tanstack/react-table';
import { AdminUserTable } from '@/components/admin/admin-user-table';

// Mock TanStack Router Link component.
vi.mock('@tanstack/react-router', async () => {
  const actual = await import('@tanstack/react-router');
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      ...rest
    }: {
      children?: React.ReactNode;
      to?: string;
      params?: Record<string, string>;
      [key: string]: unknown;
    }) => (
      <a href={to} data-params={JSON.stringify(params)} {...rest}>
        {children}
      </a>
    ),
  };
});

const defaultProps = {
  data: [
    {
      id: 'u-1',
      name: 'Alice Admin',
      email: 'alice@example.com',
      emailVerified: true,
      role: 'admin',
      banned: false,
      banReason: null,
      banExpires: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-03-01T00:00:00.000Z',
    },
    {
      id: 'u-2',
      name: 'Bob User',
      email: 'bob@example.com',
      emailVerified: false,
      role: 'user',
      banned: true,
      banReason: 'Spam',
      banExpires: null,
      createdAt: '2025-02-01T00:00:00.000Z',
      updatedAt: '2025-03-02T00:00:00.000Z',
    },
  ],
  total: 2,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  search: '',
  filter: 'all',
  sorting: [] as SortingState,
  onSearchChange: vi.fn(),
  onSearchSubmit: vi.fn(),
  onSearchClear: vi.fn(),
  onFilterChange: vi.fn(),
  onSortingChange: vi.fn(),
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('AdminUserTable', () => {
  it('renders user rows with names and emails', () => {
    render(<AdminUserTable {...defaultProps} />);
    expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('shows role badges', () => {
    render(<AdminUserTable {...defaultProps} />);
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
  });

  it('shows banned badge for banned users', () => {
    render(<AdminUserTable {...defaultProps} />);
    const badge = screen
      .getAllByText('Banned')
      .find((el) => el.getAttribute('data-slot') === 'badge');
    expect(badge).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<AdminUserTable {...defaultProps} data={[]} total={0} />);
    expect(screen.getByText('No users found.')).toBeInTheDocument();
  });

  it('shows filter-aware empty state when filters are active', () => {
    render(
      <AdminUserTable {...defaultProps} data={[]} total={0} filter="banned" />
    );
    expect(screen.getByText('No results. Clear filters.')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in search', async () => {
    const user = userEvent.setup();
    render(<AdminUserTable {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search by email...');
    await user.type(searchInput, 'test');
    expect(defaultProps.onSearchChange).toHaveBeenCalled();
  });

  it('calls onSearchSubmit when pressing Enter in search', async () => {
    const user = userEvent.setup();
    render(<AdminUserTable {...defaultProps} search="alice" />);
    const searchInput = screen.getByPlaceholderText('Search by email...');
    await user.click(searchInput);
    await user.keyboard('{Enter}');
    expect(defaultProps.onSearchSubmit).toHaveBeenCalled();
  });

  it('calls onSearchClear when pressing Escape with search text', async () => {
    const user = userEvent.setup();
    render(<AdminUserTable {...defaultProps} search="alice" />);
    const searchInput = screen.getByPlaceholderText('Search by email...');
    await user.click(searchInput);
    await user.keyboard('{Escape}');
    expect(defaultProps.onSearchClear).toHaveBeenCalled();
  });

  it('shows clear button when search has text', () => {
    render(<AdminUserTable {...defaultProps} search="alice" />);
    expect(
      screen.getByRole('button', { name: /clear search/i })
    ).toBeInTheDocument();
  });

  it('does not show clear button when search is empty', () => {
    render(<AdminUserTable {...defaultProps} search="" />);
    expect(
      screen.queryByRole('button', { name: /clear search/i })
    ).not.toBeInTheDocument();
  });

  it('shows skeleton loaders when loading', () => {
    render(<AdminUserTable {...defaultProps} isLoading />);
    expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument();
  });

  it('displays total user count', () => {
    render(<AdminUserTable {...defaultProps} />);
    expect(screen.getByText('2 users')).toBeInTheDocument();
  });

  it('displays singular user count', () => {
    render(
      <AdminUserTable
        {...defaultProps}
        data={[defaultProps.data[0]]}
        total={1}
      />
    );
    expect(screen.getByText('1 user')).toBeInTheDocument();
  });

  it('displays page information', () => {
    render(<AdminUserTable {...defaultProps} page={1} totalPages={3} />);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('renders verified badge for verified users', () => {
    render(<AdminUserTable {...defaultProps} />);
    const badge = screen
      .getAllByText('Verified')
      .find((el) => el.getAttribute('data-slot') === 'badge');
    expect(badge).toBeInTheDocument();
  });
});
