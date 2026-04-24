import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { FieldDescription } from '@workspace/ui/components/field';
import type { ReactNode } from 'react';

interface CheckEmailCardProps {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}

export function CheckEmailCard({
  title,
  description,
  actions,
  footer,
}: CheckEmailCardProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {actions}
        {footer && (
          <FieldDescription className="flex flex-col gap-2 text-center">
            {footer}
          </FieldDescription>
        )}
      </CardContent>
    </Card>
  );
}
