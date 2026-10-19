import React from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();

  let errorMessage = 'Đã xảy ra sự cố trong quá trình kết xuất giao diện.';
  let statusCode = 500;

  if (isRouteErrorResponse(error)) {
    statusCode = error.status;
    errorMessage = error.statusText || error.data?.message || errorMessage;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-5">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
          <AlertTriangle size={28} />
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900">Có lỗi xảy ra ({statusCode})</h2>
          <p className="text-xs text-slate-500 mt-2 font-mono bg-slate-50 p-3 rounded-lg border border-slate-100 break-words">
            {errorMessage}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={14} /> Tải lại trang
          </button>
          <Link
            to="/"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#119653] hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 transition-colors font-bold shadow-xs"
          >
            <Home size={14} /> Trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
};
