import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "mudeer:";

function storageKey(name: string) {
  const path = typeof window === "undefined" ? "" : window.location.pathname;
  return `${PREFIX}${path}:${name}`;
}

function readValue<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw == null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/**
 * useState replacement that remembers the value in sessionStorage, scoped to the
 * current route. Restores after hydration so SSR markup stays stable.
 */
export function usePersistentState<T>(
  name: string,
  initialValue: T,
  options?: { validate?: (value: T) => boolean },
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const keyRef = useRef<string | null>(null);
  const validate = options?.validate;
  const validateRef = useRef(validate);
  validateRef.current = validate;

  useEffect(() => {
    const key = storageKey(name);
    keyRef.current = key;
    const stored = readValue<T>(key);
    if (stored !== undefined && (!validateRef.current || validateRef.current(stored))) {
      setValue(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        const key = keyRef.current ?? storageKey(name);
        keyRef.current = key;
        try {
          window.sessionStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* storage unavailable — keep in-memory state only */
        }
        return resolved;
      });
    },
    [name],
  );

  return [value, update];
}

export function clearPersistentState() {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
