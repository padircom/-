import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncListState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * بارگذاری یک فهرست با امکان بازخوانی. هنگام بازخوانی داده‌های قبلی روی صفحه می‌مانند
 * تا جدول نپرد؛ پاسخ‌های قدیمی (پس از تغییر کاربر/سایت) نادیده گرفته می‌شوند.
 */
export function useAsyncList<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  describeError: (error: unknown) => string,
): AsyncListState<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const describeRef = useRef(describeError);
  describeRef.current = describeError;

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    loaderRef.current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: describeRef.current(error) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { ...state, reload };
}
