// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { SectionCards } from '@/components/section-cards';

describe('SectionCards', () => {
  it('renders all four metric card titles', () => {
    render(<SectionCards />);

    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('New Customers')).toBeInTheDocument();
    expect(screen.getByText('Active Accounts')).toBeInTheDocument();
    expect(screen.getByText('Growth Rate')).toBeInTheDocument();
  });

  it('renders trend indicators', () => {
    render(<SectionCards />);

    expect(screen.getAllByText('+12.5%')).toHaveLength(2);
    expect(screen.getByText('-20%')).toBeInTheDocument();
    expect(screen.getByText('+4.5%')).toBeInTheDocument();
  });
});
