"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-8 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">出错了</h1>
        </div>

        <div className="space-y-2">
          <p className="text-gray-600">
            应用程序遇到了一个意外错误。我们已经记录了这个问题。
          </p>
          {error.digest && (
            <p className="text-sm text-gray-500">错误ID: {error.digest}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            重试
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            返回首页
          </button>
        </div>

        {process.env.NODE_ENV === "development" && error.message && (
          <details className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              技术细节 (仅开发模式)
            </summary>
            <pre className="mt-2 overflow-auto text-xs text-gray-600">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
