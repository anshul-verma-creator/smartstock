import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { RouteError, PageFallback } from '@/features/misc/RouteStates';
import '@/styles/index.css';

const page = (load: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(load);
  return (
    <Suspense fallback={<PageFallback />}>
      <C />
    </Suspense>
  );
};

const router = createBrowserRouter([
  { path: '/welcome', element: page(() => import('@/features/auth/Welcome')), errorElement: <RouteError /> },
  { path: '/onboarding', element: page(() => import('@/features/auth/Onboarding')), errorElement: <RouteError /> },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: page(() => import('@/features/dashboard/Dashboard')) },
      { path: 'inventory', element: page(() => import('@/features/inventory/Inventory')) },
      { path: 'inventory/activity', element: page(() => import('@/features/inventory/Activity')) },
      { path: 'products/:id', element: page(() => import('@/features/product/ProductPage')) },
      { path: 'alerts', element: page(() => import('@/features/alerts/Alerts')) },
      { path: 'insights', element: page(() => import('@/features/insights/Insights')) },
      { path: 'profit', element: page(() => import('@/features/profit/Profit')) },
      { path: 'rescue', element: page(() => import('@/features/rescue/Rescue')) },
      { path: 'suppliers', element: page(() => import('@/features/suppliers/Suppliers')) },
      { path: 'suppliers/:id', element: page(() => import('@/features/suppliers/SupplierDetail')) },
      { path: 'pos', element: page(() => import('@/features/pos/POS')) },
      { path: 'sales', element: page(() => import('@/features/sales/Sales')) },
      { path: 'sales/:id', element: page(() => import('@/features/sales/InvoiceView')) },
      { path: 'purchases', element: page(() => import('@/features/purchases/Purchases')) },
      { path: 'purchases/new', element: page(() => import('@/features/purchases/NewPurchase')) },
      { path: 'customers', element: page(() => import('@/features/customers/Customers')) },
      { path: 'customers/:id', element: page(() => import('@/features/customers/CustomerDetail')) },
      { path: 'reports', element: page(() => import('@/features/reports/Reports')) },
      { path: 'settings', element: page(() => import('@/features/settings/Settings')) },
      { path: '*', element: page(() => import('@/features/misc/NotFound')) },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster
      position="top-center"
      toastOptions={{ className: '!rounded-[18px] !border-white/80 !bg-white/85 !backdrop-blur-xl !shadow-lift !text-ink', duration: 3500 }}
    />
  </StrictMode>,
);
