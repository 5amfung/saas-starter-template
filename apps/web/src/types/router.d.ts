import '@tanstack/react-router';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    title?: string;
    /** Override breadcrumb link target (e.g. for layout routes with no index). */
    breadcrumbHref?: string;
  }
}
