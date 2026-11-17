/**
 * Renders content above everything else in the app (sheets, dialogs, toasts).
 *
 * These overlays are ordinary views rather than native modal windows. That
 * keeps them identical on Android, iOS and the web, and lets a dialog open on
 * top of a sheet - something stacked native modals do not do reliably.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface PortalApi {
  mount(key: number, node: ReactNode): void;
  unmount(key: number): void;
}

interface Entry {
  key: number;
  node: ReactNode;
}

const PortalContext = createContext<PortalApi | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);

  const api = useMemo<PortalApi>(
    () => ({
      mount(key, node) {
        setEntries((list) => {
          const index = list.findIndex((entry) => entry.key === key);
          if (index === -1) return [...list, { key, node }];
          const copy = list.slice();
          copy[index] = { key, node };
          return copy;
        });
      },
      unmount(key) {
        setEntries((list) => list.filter((entry) => entry.key !== key));
      },
    }),
    [],
  );

  return (
    <PortalContext.Provider value={api}>
      {children}
      {entries.map((entry) => (
        <View key={entry.key} style={styles.layer}>
          {entry.node}
        </View>
      ))}
    </PortalContext.Provider>
  );
}

let nextKey = 1;

export function Portal({ children }: { children: ReactNode }) {
  const api = useContext(PortalContext);
  const [key] = useState(() => nextKey++);

  // Push the latest content to the host after every render of the owner.
  useEffect(() => {
    api?.mount(key, children);
  });

  useEffect(() => () => api?.unmount(key), [api, key]);

  return null;
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, pointerEvents: 'box-none' },
});
