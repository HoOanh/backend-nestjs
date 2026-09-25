import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient.ts';
import type { UserProfile } from '../types/user.ts';

export function useAuthSession() {
  const [studentUser, setStudentUser] = useState<UserProfile | null>(() => {
    const stored = apiClient.getStoredUser();
    return stored && stored.role !== 'admin' ? stored : null;
  });

  const [adminUser, setAdminUser] = useState<UserProfile | null>(() => {
    const stored = apiClient.getStoredUser();
    return stored && stored.role === 'admin' ? stored : null;
  });

  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => {
    const stored = apiClient.getStoredUser();
    const token = apiClient.getToken();
    return !stored && Boolean(token);
  });

  useEffect(() => {
    async function verifyAuth() {
      const stored = apiClient.getStoredUser();
      const token = apiClient.getToken();
      if (!token && !stored) {
        setIsAuthChecking(false);
        return;
      }

      try {
        const user = await apiClient.getMe();
        if (user) {
          if (user.role === 'admin') {
            setAdminUser(user);
            setStudentUser(null);
          } else {
            setStudentUser(user);
            setAdminUser(null);
          }
        } else {
          if (!apiClient.getToken()) {
            setStudentUser(null);
            setAdminUser(null);
          }
        }
      } catch (e) {
        console.error('Session verify notice:', e);
      } finally {
        setIsAuthChecking(false);
      }
    }
    void verifyAuth();
  }, []);

  const activeUser = studentUser || adminUser;
  const isEffectiveAdmin = adminUser?.role === 'admin' || studentUser?.role === 'admin';

  const logoutStudent = async () => {
    await apiClient.logout();
    setStudentUser(null);
    setAdminUser(null);
  };

  const logoutAdmin = async () => {
    await apiClient.logout();
    setAdminUser(null);
  };

  return {
    studentUser,
    setStudentUser,
    adminUser,
    setAdminUser,
    isAuthChecking,
    activeUser,
    isEffectiveAdmin,
    logoutStudent,
    logoutAdmin
  };
}
