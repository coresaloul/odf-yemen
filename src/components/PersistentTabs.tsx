import type { ComponentProps, ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";
import { usePersistentState } from "@/hooks/usePersistentState";

type PersistentTabsProps = Omit<ComponentProps<typeof Tabs>, "value" | "onValueChange"> & {
  storageKey: string;
  defaultValue: string;
  /** Values the current user is allowed to see; a stored value outside it is ignored. */
  allowed?: string[];
  children: ReactNode;
};

/**
 * Tabs that remember the active tab per route for the current browser session.
 */
export function PersistentTabs({
  storageKey,
  defaultValue,
  allowed,
  children,
  ...props
}: PersistentTabsProps) {
  const [value, setValue] = usePersistentState<string>(`tabs:${storageKey}`, defaultValue, {
    validate: (v) => (allowed ? allowed.includes(v) : true),
  });

  return (
    <Tabs {...props} value={value} onValueChange={setValue}>
      {children}
    </Tabs>
  );
}
