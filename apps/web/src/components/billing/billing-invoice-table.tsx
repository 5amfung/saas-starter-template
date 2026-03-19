import React from "react"
import { IconExternalLink } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export interface Invoice {
  id: string
  date: number // Unix timestamp seconds
  status: string | null
  amount: number // Cents
  currency: string
  invoiceUrl: string | null | undefined
  invoicePdf: string | null | undefined
}

interface BillingInvoiceTableProps {
  invoices: Array<Invoice>
  isLoading?: boolean
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
})

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

function getStatusVariant(
  status: string | null
): "default" | "secondary" | "destructive" {
  if (status === "paid") return "default"
  if (status === "open") return "secondary"
  return "destructive"
}

/** Returns a YYYY-MM key for grouping invoices by month. */
function monthKey(timestampSeconds: number): string {
  const d = new Date(timestampSeconds * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

interface MonthOption {
  key: string // YYYY-MM for filtering.
  label: string // Human-readable label shown in dropdown.
}

/** Generates month options for the last 12 months, newest first. */
function getLast12Months(): Array<MonthOption> {
  const options: Array<MonthOption> = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_FORMAT.format(d),
    })
  }
  return options
}

export function BillingInvoiceTable({
  invoices,
  isLoading,
}: BillingInvoiceTableProps) {
  const monthOptions = getLast12Months()
  const [selectedKey, setSelectedKey] = React.useState(monthOptions[0].key)

  const filtered = invoices.filter((inv) => monthKey(inv.date) === selectedKey)

  /** Maps a label back to its YYYY-MM key. */
  const labelToKey = React.useMemo(
    () => new Map(monthOptions.map((o) => [o.label, o.key])),
    [monthOptions]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Invoices</h3>
        <Select
          defaultValue={monthOptions[0].label}
          onValueChange={(v) => {
            if (!v) return
            const key = labelToKey.get(v)
            if (key) setSelectedKey(key)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.key} value={option.label}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading invoices...
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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No invoices for this period.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="text-sm">
                    {DATE_FORMAT.format(new Date(invoice.date * 1000))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(invoice.status)}>
                      {invoice.status ?? "unknown"}
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
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        View
                        <IconExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
