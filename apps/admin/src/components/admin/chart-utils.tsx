import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@workspace/ui/components/toggle-group';
import { formatDate } from '@workspace/components/lib';

interface TimeRangeToggleProps {
  value: string;
  onChange: (v: string) => void;
}

export function TimeRangeToggle({ value, onChange }: TimeRangeToggleProps) {
  return (
    <>
      <ToggleGroup
        multiple={false}
        value={value ? [value] : []}
        onValueChange={(v) => onChange(v[0] ?? '7d')}
        variant="outline"
        className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
      >
        <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
        <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
        <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
      </ToggleGroup>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v);
        }}
      >
        <SelectTrigger
          className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
          size="sm"
          aria-label="Select time range"
        >
          <SelectValue placeholder="Last 7 days" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="90d" className="rounded-lg">
            Last 3 months
          </SelectItem>
          <SelectItem value="30d" className="rounded-lg">
            Last 30 days
          </SelectItem>
          <SelectItem value="7d" className="rounded-lg">
            Last 7 days
          </SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

export function formatDateTick(value: string) {
  const date = new Date(value + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateLabel(value: unknown) {
  return formatDate(String(value));
}
