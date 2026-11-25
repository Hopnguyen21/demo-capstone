import React, { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { AuthProvider } from '@/app/providers/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Modal, Button } from './components/ui/BaseUI';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const GlobalAlertDialog: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const nativeAlert = window.alert;
    window.alert = (value?: any) => setMessage(String(value ?? ''));
    return () => { window.alert = nativeAlert; };
  }, []);

  return (
    <Modal isOpen={message !== null} onClose={() => setMessage(null)} title="Thông báo">
      <div className="space-y-4">
        <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">{message}</p>
        <div className="flex justify-end">
          <Button type="button" onClick={() => setMessage(null)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Đã hiểu
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <GlobalAlertDialog />
      </AuthProvider>
    </QueryClientProvider>
  );
};
