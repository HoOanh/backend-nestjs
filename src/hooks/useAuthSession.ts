import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient.ts';
import type { UserProfile } from '../types/user.ts';

export function useAuthSession() {
  const [studentUser, setStudentUser] = useState<UserProfile | null>(null);
  const [adminUser, setAdminUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    async function verifyAuth() {
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
          setStudentUser(null);
          setAdminUser(null);
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
  const isEffectiveAdmin =
    adminUser?.role === 'admin' || studentUser?.role === 'admin';

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
