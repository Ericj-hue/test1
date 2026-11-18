import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHabits } from '@/lib/habits';

const palettes = {
  light: {
    bg: '#F4F3F0',
    card: '#FFFFFF',
    text: '#17171A',
    muted: '#6B6B73',
    border: '#E2E0DB',
    accent: '#C8102E',
    accentText: '#FFFFFF',
    track: '#E2E0DB',
  },
  dark: {
    bg: '#0F0F11',
    card: '#1B1B1F',
    text: '#F2F2F4',
    muted: '#9A9AA3',
    border: '#2A2A30',
    accent: '#E5243F',
    accentText: '#FFFFFF',
    track: '#2A2A30',
  },
};

function buzz() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
}

export default function HabitsScreen() {
  const c = palettes[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const { loaded, habits, done, toggle, add, remove } = useHabits();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  const total = habits.length;
  const count = done.size;
  const allDone = total > 0 && count === total;
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const submit = () => {
    if (!draft.trim()) return;
    add(draft);
    setDraft('');
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={loaded ? habits : []}
          keyExtractor={(h) => h.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.date, { color: c.muted }]}>{dateLabel}</Text>
                  <Text style={[styles.title, { color: c.text }]}>Lift Habits</Text>
                </View>
                <Pressable
                  onPress={() => setEditing((e) => !e)}
                  hitSlop={10}
                  accessibilityRole="button"
                  style={[styles.editBtn, { borderColor: c.border }]}
                >
                  <Text style={[styles.editText, { color: c.text }]}>{editing ? 'Done' : 'Edit'}</Text>
                </Pressable>
              </View>

              <View style={[styles.counter, { backgroundColor: allDone ? c.accent : c.card, borderColor: c.border }]}>
                <Text
                  style={[styles.count, { color: allDone ? c.accentText : c.text }]}
                  accessibilityLabel={`${count} of ${total} done today`}
                >
                  {count}
                  <Text style={[styles.countTotal, { color: allDone ? c.accentText : c.muted }]}> / {total}</Text>
                </Text>
                <Text style={[styles.countLabel, { color: allDone ? c.accentText : c.muted }]}>
                  {allDone ? 'All done today. Strong work.' : 'done today'}
                </Text>
                <View style={[styles.track, { backgroundColor: allDone ? 'rgba(255,255,255,0.3)' : c.track }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${total ? (count / total) * 100 : 0}%`,
                        backgroundColor: allDone ? c.accentText : c.accent,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const checked = done.has(item.id);
            return (
              <Pressable
                onPress={() => {
                  if (editing) return;
                  buzz();
                  toggle(item.id);
                }}
                role="checkbox"
                aria-checked={checked}
                aria-label={item.name}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: c.card, borderColor: c.border, opacity: pressed && !editing ? 0.7 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.box,
                    { borderColor: checked ? c.accent : c.muted, backgroundColor: checked ? c.accent : 'transparent' },
                  ]}
                >
                  {checked && <Text style={[styles.tick, { color: c.accentText }]}>✓</Text>}
                </View>
                <Text
                  style={[
                    styles.name,
                    { color: checked ? c.muted : c.text, textDecorationLine: checked ? 'line-through' : 'none' },
                  ]}
                >
                  {item.name}
                </Text>
                {editing && (
                  <Pressable
                    onPress={() => remove(item.id)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.name}`}
                    style={styles.remove}
                  >
                    <Text style={[styles.removeText, { color: c.accent }]}>Remove</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            loaded ? (
              <Text style={[styles.empty, { color: c.muted }]}>No habits yet. Add one below.</Text>
            ) : undefined
          }
          ListFooterComponent={
            editing ? (
              <View style={[styles.addRow, { backgroundColor: c.card, borderColor: c.border }]}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={submit}
                  placeholder="New habit, e.g. Accessory work"
                  placeholderTextColor={c.muted}
                  returnKeyType="done"
                  maxLength={60}
                  style={[styles.input, { color: c.text }]}
                />
                <Pressable
                  onPress={submit}
                  accessibilityRole="button"
                  style={[styles.addBtn, { backgroundColor: c.accent, opacity: draft.trim() ? 1 : 0.4 }]}
                >
                  <Text style={[styles.addText, { color: c.accentText }]}>Add</Text>
                </Pressable>
              </View>
            ) : undefined
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: 16, paddingBottom: 32, gap: 10, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { gap: 16, marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 8 },
  date: { fontSize: 14, fontWeight: '500' },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  editBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  editText: { fontSize: 15, fontWeight: '600' },
  counter: { borderWidth: 1, borderRadius: 18, padding: 20, gap: 4 },
  count: { fontSize: 52, fontWeight: '800', fontVariant: ['tabular-nums'] },
  countTotal: { fontSize: 28, fontWeight: '700' },
  countLabel: { fontSize: 16, fontWeight: '600' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', borderRadius: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { fontSize: 18, fontWeight: '800', lineHeight: 20 },
  name: { flex: 1, fontSize: 17, fontWeight: '500', paddingVertical: 16 },
  remove: { paddingVertical: 8 },
  removeText: { fontSize: 15, fontWeight: '600' },
  empty: { textAlign: 'center', fontSize: 16, paddingVertical: 24 },
  addRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 8, gap: 8 },
  input: { flex: 1, fontSize: 17, paddingHorizontal: 8, paddingVertical: 10 },
  addBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  addText: { fontSize: 16, fontWeight: '700' },
});
