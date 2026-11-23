import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { BOOTSTRAPPED_ADMIN_EMAIL, safeEmailKey } from '../lib/kpiMath';
import { upsertUserProfile } from '../lib/firestoreService';
import type { UserPermission, UserRole } from '../types/kpi';

interface AuthContextValue {
  user: User | null;
  permission: UserPermission | null;
  role: UserRole | null;
  isAuthorized: boolean;
  isSuperAdmin: boolean;
  isMgmtViewer: boolean;
  isDeptEmployeeEditor: boolean;
  canViewAll: boolean;
  isEditor: boolean;
  isViewerOnly: boolean;
  authLoading: boolean;
  authError: string | null;
  unauthorizedEmail: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshPermission: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permission, setPermission] = useState<UserPermission | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null);

  const loadPermissionForUser = async (currentUser: User) => {
    const email = (currentUser.email || '').trim().toLowerCase();
    if (!email || !currentUser.emailVerified) {
      setPermission(null);
      setUnauthorizedEmail(email || 'Unverified Account');
      return;
    }

    const emailKey = safeEmailKey(email);
    const permRef = doc(db, 'user_permissions', emailKey);
    const snap = await getDoc(permRef);

    if (snap.exists()) {
      const data = snap.data() as Omit<UserPermission, 'id'>;
      if (!data.isActive) {
        setPermission(null);
        setUnauthorizedEmail(email);
        return;
      }
      setPermission({ id: snap.id, ...data });
      setUnauthorizedEmail(null);
      await upsertUserProfile(currentUser);
      return;
    }

    // Bootstrapped Super Administrator automatic registration
    if (email === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
      const bootstrapPerm: Omit<UserPermission, 'id' | 'createdAt' | 'updatedAt'> & {
        createdAt: any;
        updatedAt: any;
      } = {
        email,
        displayName: currentUser.displayName || 'Super Administrator',
        role: 'super_admin',
        departmentIds: [],
        isActive: true,
        notes: 'Bootstrapped Super Administrator',
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(permRef, bootstrapPerm);
      const freshSnap = await getDoc(permRef);
      if (freshSnap.exists()) {
        setPermission({ id: freshSnap.id, ...(freshSnap.data() as Omit<UserPermission, 'id'>) });
      } else {
        setPermission({
          id: emailKey,
          email,
          displayName: currentUser.displayName || 'Super Administrator',
          role: 'super_admin',
          departmentIds: [],
          isActive: true,
          notes: 'Bootstrapped Super Administrator',
          createdBy: currentUser.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      setUnauthorizedEmail(null);
      await upsertUserProfile(currentUser);
      return;
    }

    // Not approved in Admin Portal
    setPermission(null);
    setUnauthorizedEmail(email);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        if (!firebaseUser) {
          setUser(null);
          setPermission(null);
          setUnauthorizedEmail(null);
        } else {
          setUser(firebaseUser);
          await loadPermissionForUser(firebaseUser);
        }
      } catch (err) {
        console.error('Auth verification error:', err);
        setAuthError(
          err instanceof Error ? err.message : 'Unable to verify account authorization.'
        );
        setPermission(null);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        return;
      }
      setAuthError(err instanceof Error ? err.message : 'Google authentication failed.');
    }
  };

  const logout = async () => {
    setAuthError(null);
    setUnauthorizedEmail(null);
    setPermission(null);
    await signOut(auth);
  };

  const refreshPermission = async () => {
    if (user) {
      await loadPermissionForUser(user);
    }
  };

  const isAuthorized = Boolean(user && permission && permission.isActive);
  const role = permission?.role ?? null;
  const isSuperAdmin = isAuthorized && role === 'super_admin';
  const isMgmtViewer = isAuthorized && role === 'mgmt_viewer';
  const isDeptEmployeeEditor = isAuthorized && role === 'dept_employee_editor';
  const canViewAll = isSuperAdmin || isMgmtViewer || isDeptEmployeeEditor;
  const isEditor =
    isAuthorized &&
    (role === 'super_admin' || role === 'dept_editor' || role === 'dept_employee_editor');
  const isViewerOnly = isAuthorized && (role === 'dept_viewer' || role === 'mgmt_viewer');

  return (
    <AuthContext.Provider
      value={{
        user,
        permission,
        role,
        isAuthorized,
        isSuperAdmin,
        isMgmtViewer,
        isDeptEmployeeEditor,
        canViewAll,
        isEditor,
        isViewerOnly,
        authLoading,
        authError,
        unauthorizedEmail,
        signInWithGoogle,
        logout,
        refreshPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
