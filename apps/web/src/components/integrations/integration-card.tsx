import * as React from 'react';
import { IconBrandSlack } from '@tabler/icons-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@workspace/ui/components/card';

const integrationIcons = {
  slack: IconBrandSlack,
} as const;

interface IntegrationCardProps {
  integration: keyof typeof integrationIcons;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function IntegrationCard({
  integration,
  title,
  description,
  children,
}: IntegrationCardProps) {
  const Icon = integrationIcons[integration];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border bg-muted/40">
            <Icon className="size-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base leading-normal font-medium">{title}</h2>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
