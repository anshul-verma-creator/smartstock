import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

export function PageFallback() {
  return (
    <div className="animate-rise space-y-6 py-4" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton h-12 w-72" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
      </div>
    </div>
  );
}

export function RouteError() {
  const err = useRouteError();
  const msg = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : 'Unknown error';
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-6">
      <div className="panel-read max-w-md p-8 text-center">
        <p className="eyebrow mb-2">Something went wrong</p>
        <h1 className="text-2xl font-light">This screen could not load</h1>
        <p className="mt-2 text-sm text-ink-2">{msg}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => location.reload()} className="focus-ring rounded-[14px] bg-ink px-4 py-2 text-sm font-semibold text-white">Reload</button>
          <Link to="/" className="focus-ring rounded-[14px] px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-white">Go to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
