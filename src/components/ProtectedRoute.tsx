import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useErp } from '../context/ErpContext';

export function ProtectedRoute() {
  const { currentUser } = useErp();
  const location = useLocation();

  if (!currentUser) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}
