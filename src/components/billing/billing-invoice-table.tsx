import React from 'react';
import { IconExternalLink } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// React import needed for useState

export interface Invoice {
  id: string;
  date: number; // Unix timestamp seconds
  status: string | null;
  amount: number; // Cents
  currency: string;
  invoiceUrl: string | null | undefined;
  invoicePdf: string | null | undefined;
}

interface BillingInvoiceTableProps {
  invoices: Array<Invoice>;
  isLoading?: boolean;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function getStatusVariant(
  status: string | null,
): 'default' | 'secondary' | 'destructive' {
  if (status === 'paid') return 'default';
  if (status === 'open') return 'secondary';
  return 'destructive';
}

/** Returns a YYYY-MM key for grouping invoices by month. */
function monthKey(timestampSeconds: number): string {
  const d = new Date(timestampSeconds * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Returns the current month key. */
function currentMonthKey(): string {
  return monthKey(Date.now() / 1000);
}

export function BillingInvoiceTable({
  invoices,
  isLoading,
}: BillingInvoiceTableProps) {
  // Compute unique months from invoices, sorted newest first.
  const monthKeys = Array.from(
    new Set(invoices.map((inv) => monthKey(inv.date))),
  ).sort((a, b) => b.localeCompare(a));

  const defaultMonth = monthKeys.includes(currentMonthKey())
    ? currentMonthKey()
    : (monthKeys[0] ?? currentMonthKey());
  const [selectedMonth, setSelectedMonth] = React.useState(defaultMonth);

  const filtered = invoices.filter(
    (inv) => monthKey(inv.date) === selectedMonth,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Invoice history</h3>
        {monthKeys.length > 0 && (
          <Select
            value={selectedMonth}
            onValueChange={(v) => v && setSelectedMonth(v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthKeys.map((key) => {
                const [year, month] = key.split('-').map(Number);
                const label = MONTH_FORMAT.format(new Date(year, month - 1));
                return (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          Loading invoices...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          No invoices for this period.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="text-sm">
                  {DATE_FORMAT.format(new Date(invoice.date * 1000))}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(invoice.status)}>
                    {invoice.status ?? 'unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {formatAmount(invoice.amount, invoice.currency)}
                </TableCell>
                <TableCell className="text-right">
                  {invoice.invoiceUrl != null ? (
                    <a
                      href={invoice.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
                    >
                      View
                      <IconExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
