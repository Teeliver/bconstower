// src/lib/auth.ts
export const checkAdminAuth = () => {
  const token = localStorage.getItem('admin_token');
  const user = localStorage.getItem('admin_user');

  if (!token || !user) {
    window.location.replace('/admin');
    return false;
  }
  return true;
};