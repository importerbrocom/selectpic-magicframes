import { useCallback, useRef, useState } from 'react';

export interface ToastApi {
  message: string | null;
  showToast: (msg: string) => void;
}

/** Transient bottom-right toast that auto-dismisses after 3 seconds. */
export function useToast(): ToastApi {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3000);
  }, []);

  return { message, showToast };
}
