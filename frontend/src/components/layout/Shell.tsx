import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/app/providers/AuthContext';
import { getAccessToken } from '../../services';

export const Shell: React.FC = () => {
  const { user } = useAuth();
  const token = getAccessToken();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Topbar
        onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        isMobileMenuOpen={isMobileMenuOpen}
      />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 overflow-y-auto max-h-[calc(100vh-4rem)] bg-slate-50/50">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
