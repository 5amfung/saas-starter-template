// @vitest-environment jsdom
// apps/web/test/unit/components/billing/billing-invoice-table.test.tsx
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@workspace/test-utils';
import type { Invoice } from '@/components/billing/billing-invoice-table';
import { BillingInvoiceTable } from '@/components/billing/billing-invoice-table';

/** Returns a Unix timestamp (seconds) for the first day of the current month. */
function currentMonthTimestamp(): number {
  const now = new Date();
  return Math.floor(
    new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  );
}

/** Returns a Unix timestamp (seconds) for the first day of two months ago. */
function oldMonthTimestamp(): number {
  const now = new Date();
  return Math.floor(
    new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime() / 1000
  );
}

const CURRENT_INVOICE: Invoice = {
  id: 'inv_001',
  date: currentMonthTimestamp(),
  status: 'paid',
  amount: 1999,
  currency: 'usd',
  invoiceUrl: 'https://example.com/invoice/001',
  invoicePdf: null,
};

const OLD_INVOICE: Invoice = {
  id: 'inv_002',
  date: oldMonthTimestamp(),
  status: 'open',
  amount: 5000,
  currency: 'usd',
  invoiceUrl: null,
  invoicePdf: null,
};

describe('BillingInvoiceTable', () => {
  describe('loading state', () => {
    it('shows loading message when isLoading is true', () => {
      renderWithProviders(
        <BillingInvoiceTable invoices={[]} isLoading={true} />
      );
      expect(screen.getByText('Loading invoices...')).toBeInTheDocument();
    });

    it('does not render the table when isLoading is true', () => {
      renderWithProviders(
        <BillingInvoiceTable invoices={[CURRENT_INVOICE]} isLoading={true} />
      );
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when there are no invoices for the selected month', () => {
      renderWithProviders(
        <BillingInvoiceTable invoices={[]} isLoading={false} />
      );
      expect(
        screen.getByText('No invoices for this period.')
      ).toBeInTheDocument();
    });
  });

  describe('invoice row rendering', () => {
    it('renders invoice date in human-readable format', () => {
      renderWithProviders(<BillingInvoiceTable invoices={[CURRENT_INVOICE]} />);
      // The date is the 1st of the current month — assert the table cell contains it.
      const now = new Date();
      const expectedYear = now.getFullYear().toString();
      const dateCells = screen.getAllByText(new RegExp(expectedYear));
      // At least one match should be a table cell (td), not just the month select.
      const tableCell = dateCells.find((el) => el.tagName === 'TD');
      expect(tableCell).toBeInTheDocument();
    });

    it('renders paid status badge', () => {
      renderWithProviders(<BillingInvoiceTable invoices={[CURRENT_INVOICE]} />);
      expect(screen.getByText('paid')).toBeInTheDocument();
    });

    it('converts amount from cents to dollars', () => {
      renderWithProviders(<BillingInvoiceTable invoices={[CURRENT_INVOICE]} />);
      // 1999 cents = $19.99
      expect(screen.getByText('$19.99')).toBeInTheDocument();
    });

    it('renders View link when invoiceUrl is present', () => {
      renderWithProviders(<BillingInvoiceTable invoices={[CURRENT_INVOICE]} />);
      const link = screen.getByRole('link', { name: /view/i });
      expect(link).toHaveAttribute('href', 'https://example.com/invoice/001');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders a dash when invoiceUrl is null', () => {
      renderWithProviders(
        <BillingInvoiceTable
          invoices={[{ ...CURRENT_INVOICE, invoiceUrl: null }]}
        />
      );
      expect(screen.getByText('—')).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /view/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('month filter interaction', () => {
    it('only shows invoices matching the selected month', () => {
      renderWithProviders(
        <BillingInvoiceTable invoices={[CURRENT_INVOICE, OLD_INVOICE]} />
      );
      // The current month invoice should be visible; the old one should not render in this view.
      expect(screen.getByText('paid')).toBeInTheDocument();
      expect(screen.queryByText('open')).not.toBeInTheDocument();
    });
  });
});
