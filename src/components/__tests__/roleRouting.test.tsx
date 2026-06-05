/**
 * Contract tests — role-routing guards.
 *
 * Verifies ClinicianProtectedRoute and AdminProtectedRoute enforce the
 * expected access matrix by mocking the underlying auth/permission hooks.
 * No runtime logic is modified.
 *
 * Access matrix:
 *   ClinicianProtectedRoute -> allow only if isClinician (DB role:
 *                              clinician/moderator/admin). uiMode is NOT
 *                              an authorization boundary and is ignored.
 *                              redirect to /auth if no user
 *                              redirect to /today (default) otherwise
 *   AdminProtectedRoute     -> allow only if isAdmin
 *                              redirect to /auth if no user
 *                              redirect to /dashboard (default) otherwise
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ClinicianProtectedRoute } from '@/components/ClinicianProtectedRoute';
import { AdminProtectedRoute } from '@/components/AdminProtectedRoute';

// ---- Hook mocks ----
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: vi.fn(),
}));

import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';

const Protected = () => <div>PROTECTED_CONTENT</div>;
const Today = () => <div>TODAY_PAGE</div>;
const Dashboard = () => <div>DASHBOARD_PAGE</div>;
const Auth = () => <div>AUTH_PAGE</div>;

function renderClinician(startPath = '/clinician') {
  return render(
    <MemoryRouter initialEntries={[startPath]}>
      <Routes>
        <Route
          path="/clinician"
          element={
            <ClinicianProtectedRoute>
              <Protected />
            </ClinicianProtectedRoute>
          }
        />
        <Route path="/today" element={<Today />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderAdmin(startPath = '/admin') {
  return render(
    <MemoryRouter initialEntries={[startPath]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <Protected />
            </AdminProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>
  );
}

const setAuth = (user: { id: string } | null, loading = false) =>
  (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ user, loading });
const setPerms = (
  opts: Partial<{ isAdmin: boolean; isModerator: boolean; isClinician: boolean; isCaregiver: boolean; isLoading: boolean }>
) =>
  (useUserPermissions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    isAdmin: false,
    isModerator: false,
    isClinician: false,
    isCaregiver: false,
    roles: [],
    isLoading: false,
    ...opts,
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ClinicianProtectedRoute', () => {
  it('redirects unauthenticated user to /auth', () => {
    setAuth(null);
    setPerms({});
    renderClinician();
    expect(screen.getByText('AUTH_PAGE')).toBeInTheDocument();
  });

  it('redirects plain patient (no role) to /today', () => {
    setAuth({ id: 'u1' });
    setPerms({});
    renderClinician();
    expect(screen.getByText('TODAY_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
  });

  it('allows admin via DB role', () => {
    setAuth({ id: 'u1' });
    setPerms({ isAdmin: true, isClinician: true });
    renderClinician();
    expect(screen.getByText('PROTECTED_CONTENT')).toBeInTheDocument();
  });

  it('allows clinician via DB role', () => {
    setAuth({ id: 'u1' });
    setPerms({ isClinician: true });
    renderClinician();
    expect(screen.getByText('PROTECTED_CONTENT')).toBeInTheDocument();
  });

  it('blocks a user without a clinician DB role (uiMode cannot grant access)', () => {
    setAuth({ id: 'u1' });
    setPerms({ isClinician: false });
    renderClinician();
    expect(screen.getByText('TODAY_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
  });

  it('shows loader while auth is loading', () => {
    setAuth(null, true);
    setPerms({});
    renderClinician();
    expect(screen.getByText(/Checking permissions/i)).toBeInTheDocument();
  });

  it('shows loader while permissions are loading', () => {
    setAuth({ id: 'u1' });
    setPerms({ isLoading: true });
    renderClinician();
    expect(screen.getByText(/Checking permissions/i)).toBeInTheDocument();
  });
});

describe('AdminProtectedRoute', () => {
  it('redirects unauthenticated user to /auth', () => {
    setAuth(null);
    setPerms({});
    renderAdmin();
    expect(screen.getByText('AUTH_PAGE')).toBeInTheDocument();
  });

  it('redirects non-admin (even moderator) to /dashboard', () => {
    setAuth({ id: 'u1' });
    setPerms({ isModerator: true });
    renderAdmin();
    expect(screen.getByText('DASHBOARD_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
  });

  it('allows real admin', () => {
    setAuth({ id: 'u1' });
    setPerms({ isAdmin: true });
    renderAdmin();
    expect(screen.getByText('PROTECTED_CONTENT')).toBeInTheDocument();
  });

  it('ignores uiMode — admin requires DB role only', () => {
    setAuth({ id: 'u1' });
    setPerms({});
    renderAdmin();
    expect(screen.getByText('DASHBOARD_PAGE')).toBeInTheDocument();
  });
});
