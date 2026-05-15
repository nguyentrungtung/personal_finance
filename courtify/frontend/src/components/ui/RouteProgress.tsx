import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Slim top-of-page progress bar that animates on every route change.
 * Mount once inside BrowserRouter (App.tsx).
 */
export function RouteProgress() {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Start animation
    setWidth(0);
    setActive(true);

    // Quickly jump to ~80% then complete
    const t1 = setTimeout(() => setWidth(80), 50);
    const t2 = setTimeout(() => setWidth(100), 300);
    const t3 = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [location.pathname]);

  if (!active && width === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99999] h-0.5 pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-full bg-brand-green shadow-[0_0_8px_rgba(34,197,94,0.6)] transition-all ease-out"
        style={{
          width: `${width}%`,
          opacity: active ? 1 : 0,
          transitionDuration: width === 100 ? '200ms' : '400ms',
        }}
      />
    </div>
  );
}
