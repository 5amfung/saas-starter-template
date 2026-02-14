import * as React from 'react';
import { Link, useMatches } from '@tanstack/react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export function DynamicBreadcrumb() {
  const matches = useMatches();
  const crumbs = matches.filter((m) => m.staticData.title);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((match, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <React.Fragment key={match.id}>
              <BreadcrumbItem>
                {!isLast ? (
                  <BreadcrumbLink
                    render={
                      <Link
                        to={match.staticData.breadcrumbHref ?? match.fullPath}
                      />
                    }
                  >
                    {match.staticData.title}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{match.staticData.title}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
