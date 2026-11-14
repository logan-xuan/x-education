import { useCallback, useEffect, useRef, useState } from 'react';
import { api, message } from './api';

export function useResource<T>(url: string | null, keepPreviousData = false) {
  const lastUrl = useRef(url);
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string }>({
    data: null,
    loading: Boolean(url),
    error: '',
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: '' });
      return;
    }
    const controller = new AbortController();
    const preserve = keepPreviousData && lastUrl.current === url;
    lastUrl.current = url;
    setState((previous) => ({ data: preserve ? previous.data : null, loading: true, error: '' }));
    api<T>(url, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            data: preserve ? previous.data : null,
            loading: false,
            error: message(error),
          }));
      });
    return () => controller.abort();
  }, [url, version, keepPreviousData]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
export function useDebounce<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
