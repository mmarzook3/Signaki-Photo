import { lazy, Suspense } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { z } from "zod";
import { AuthGate, PasswordForm, useUser } from "@/modules/session/Session";
import { Shell } from "./Shell";
import { Loading, ErrorNotice } from "@/components/common";
import { Dashboard } from "@/modules/properties/Dashboard";
const Gallery = lazy(() =>
  import("@/modules/gallery/Gallery").then((m) => ({ default: m.Gallery })),
);
const Viewer = lazy(() =>
  import("@/modules/viewer/Viewer").then((m) => ({ default: m.Viewer })),
);
const Customers = lazy(() =>
  import("@/modules/customers/Customers").then((m) => ({
    default: m.Customers,
  })),
);
const Feedback = lazy(() =>
  import("@/modules/feedback/Feedback").then((m) => ({ default: m.Feedback })),
);
function Layout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const content = (
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  );
  return (
    <AuthGate>
      {path.includes("/photos/") || path.includes("/properties/") ? (
        content
      ) : (
        <Shell>{content}</Shell>
      )}
    </AuthGate>
  );
}
function StaffOnly({ children }: { children: React.ReactNode }) {
  return useUser().is_staff ? (
    children
  ) : (
    <ErrorNotice error="This page is only available to the studio." />
  );
}
const root = createRootRoute({
  component: Layout,
  errorComponent: ({ error }) => (
    <ErrorNotice
      error={
        error instanceof Error ? error.message : "An unexpected error occurred."
      }
    />
  ),
  notFoundComponent: () => (
    <ErrorNotice error="Page not found. Return to your properties." />
  ),
});
const searchSchema = z.object({
  q: z.string().optional(),
  status: z
    .enum(["all", "pending", "approved", "rejected", "review", "in_progress", "unresolved"])
    .optional(),
  view: z.enum(["all", "grouped"]).optional(),
  group: z.string().optional(),
  scopeGroup: z.string().optional(),
  compact: z.boolean().optional(),
  version: z.string().optional(),
});
const dashboard = createRoute({
  getParentRoute: () => root,
  path: "/app/",
  component: Dashboard,
});
const gallery = createRoute({
  getParentRoute: () => root,
  path: "/app/properties/$propertyId",
  validateSearch: (input: unknown) => searchSchema.parse(input),
  component: Gallery,
});
const viewer = createRoute({
  getParentRoute: () => root,
  path: "/app/photos/$photoId",
  validateSearch: (input: unknown) => searchSchema.parse(input),
  component: Viewer,
});
const customers = createRoute({
  getParentRoute: () => root,
  path: "/app/customers",
  component: () => (
    <StaffOnly>
      <Customers />
    </StaffOnly>
  ),
});
const feedback = createRoute({
  getParentRoute: () => root,
  path: "/app/feedback",
  component: () => (
    <StaffOnly>
      <Feedback />
    </StaffOnly>
  ),
});
const account = createRoute({
  getParentRoute: () => root,
  path: "/app/account",
  component: PasswordForm,
});
export const router = createRouter({
  routeTree: root.addChildren([
    dashboard,
    gallery,
    viewer,
    customers,
    feedback,
    account,
  ]),
  scrollRestoration: true,
  defaultPreload: "intent",
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
