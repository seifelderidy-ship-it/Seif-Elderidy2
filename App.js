import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';

const SUPABASE_URL = 'https://dmjaiihobuwwhvirzmkw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtamFpaWhvYnV3d2h2aXJ6bWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjE0OTUsImV4cCI6MjEwNzgzNzQ5NX0.-drWKkSRwXXPCwJEkAyA1pfKD5xp54-K00i1JG0DRGM';

function notify(title, msg) {
  if (Platform.OS === 'web') window.alert(title + ': ' + msg);
  else Alert.alert(title, msg);
}

const errMsg = (d, fallback) =>
  (d && (d.msg || d.error_description || d.message)) || fallback;

async function supaRequest(path, { method = 'POST', body, token, prefer } = {}) {
  try {
    const headers = {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (token || SUPABASE_KEY),
    };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(SUPABASE_URL + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { msg: text }; }
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, data: { msg: 'مفيش اتصال بالسيرفر: ' + e.message } };
  }
}

const SUBJECTS_ADDED = [
  { id: 's1', name: 'العربي' },
  { id: 's2', name: 'الإنجليزي' },
  { id: 's3', name: 'الرياضة' },
  { id: 's4', name: 'العلوم المتكاملة' },
  { id: 's5', name: 'التاريخ' },
  { id: 's6', name: 'الفلسفة' },
];

const SUBJECTS_NOT_ADDED = [
  { id: 's7', name: 'تكنولوجيا المعلومات' },
  { id: 's8', name: 'الدين' },
  { id: 's9', name: 'الفرنساوي' },
];

const CATEGORIES = [
  { id: 'tests', label: 'تقييمات', defaultKind: 'link' },
  { id: 'youtube', label: 'مراجعات يوتيوب', defaultKind: 'video' },
  { id: 'summaries', label: 'ملخصات', defaultKind: 'pdf' },
];

const KINDS = [
  { id: 'pdf', label: 'PDF' },
  { id: 'video', label: 'فيديو' },
  { id: 'book', label: 'كتاب' },
  { id: 'link', label: 'رابط' },
];
const kindLabel = (k) => (KINDS.find((x) => x.id === k) || {}).label || k;

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState(null);
  const [category, setCategory] = useState(null);
  const [items, setItems] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newKind, setNewKind] = useState('pdf');

  const cleanName = () => username.trim().toLowerCase();
  const validName = (n) => /^[a-z0-9_]{3,20}$/.test(n);

  async function handleSignup() {
    const name = cleanName();
    if (!validName(name) || password.length < 6) {
      notify('خطأ', 'الاسم إنجليزي وأرقام بس (3 حروف على الأقل)، والباسورد 6 على الأقل');
      return;
    }
    setLoading(true);
    const r = await supaRequest('/auth/v1/signup', {
      body: { email: name + '@app.local', password },
    });
    setLoading(false);
    if (!r.ok) {
      notify('خطأ في إنشاء الحساب', errMsg(r.data, 'حصل خطأ'));
      return;
    }
    notify('تم', 'الحساب اتعمل، ادخل دلوقتي');
  }

  async function handleLogin() {
    const name = cleanName();
    if (name === '' || password === '') {
      notify('خطأ', 'اكتب اسم المستخدم والباسورد');
      return;
    }
    setLoading(true);
    const r = await supaRequest('/auth/v1/token?grant_type=password', {
      body: { email: name + '@app.local', password },
    });
    if (!r.ok) {
      setLoading(false);
      notify('خطأ في الدخول', errMsg(r.data, 'اسم المستخدم أو الباسورد غلط'));
      return;
    }
    const token = r.data.access_token;
    const userId = r.data.user.id;
    const p = await supaRequest('/rest/v1/profiles?select=is_admin&id=eq.' + userId, {
      method: 'GET',
      token,
    });
    setLoading(false);
    setIsAdmin(p.ok && Array.isArray(p.data) && p.data.length > 0 && p.data[0].is_admin === true);
    setSession({ token, userId, name });
  }

  function handleLogout() {
    setSession(null);
    setIsAdmin(false);
    setSubject(null);
    setCategory(null);
    setItems([]);
    setUsername('');
    setPassword('');
  }

  async function loadItems(subj, cat) {
    setItems([]);
    setLoading(true);
    const r = await supaRequest(
      '/rest/v1/content?select=*&order=created_at.desc&subject_id=eq.' +
        subj.id +
        '&category=eq.' +
        cat.id,
      { method: 'GET', token: session.token }
    );
    setLoading(false);
    if (r.ok && Array.isArray(r.data)) setItems(r.data);
    else notify('خطأ', errMsg(r.data, 'مقدرناش نجيب المحتوى'));
  }

  function openSubject(s) {
    setSubject(s);
    setCategory(null);
    setItems([]);
  }

  function openCategory(c) {
    setCategory(c);
    setNewKind(c.defaultKind);
    setNewTitle('');
    setNewUrl('');
    loadItems(subject, c);
  }

  async function handleAdd() {
    if (newTitle.trim() === '' || !/^https?:\/\//.test(newUrl.trim())) {
      notify('خطأ', 'اكتب عنوان ورابط يبدأ بـ http');
      return;
    }
    setLoading(true);
    const r = await supaRequest('/rest/v1/content', {
      token: session.token,
      prefer: 'return=minimal',
      body: {
        subject_id: subject.id,
        category: category.id,
        title: newTitle.trim(),
        kind: newKind,
        url: newUrl.trim(),
      },
    });
    setLoading(false);
    if (!r.ok) {
      notify('خطأ', errMsg(r.data, 'مش مسموحلك تضيف'));
      return;
    }
    setNewTitle('');
    setNewUrl('');
    loadItems(subject, category);
  }

  if (session && subject && category) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          onPress={() => {
            setCategory(null);
            setItems([]);
          }}
        >
          <Text style={styles.back}>رجوع</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { marginBottom: 4 }]}>{subject.name}</Text>
        <Text style={styles.subtitle}>{category.label}</Text>
        {loading && <ActivityIndicator style={{ marginBottom: 12 }} />}
        {!loading && items.length === 0 && (
          <Text style={styles.empty}>مفيش محتوى لسه</Text>
        )}
        {items.map((it) => (
          <TouchableOpacity
            key={it.id}
            style={styles.subjectCard}
            onPress={() => Linking.openURL(it.url)}
          >
            <Text style={styles.subjectText}>{it.title}</Text>
            <Text style={styles.kindText}>{kindLabel(it.kind)}</Text>
          </TouchableOpacity>
        ))}

        {isAdmin && (
          <View style={styles.adminBox}>
            <Text style={styles.sectionTitle}>{'إضافة في ' + category.label + ' (للأدمن)'}</Text>
            <TextInput
              style={styles.input}
              placeholder="العنوان"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="الرابط (https://...)"
              value={newUrl}
              onChangeText={setNewUrl}
              autoCapitalize="none"
            />
            <View style={styles.kindRow}>
              {KINDS.map((k) => (
                <TouchableOpacity
                  key={k.id}
                  style={[styles.chip, newKind === k.id && styles.chipActive]}
                  onPress={() => setNewKind(k.id)}
                >
                  <Text style={[styles.chipText, newKind === k.id && styles.chipTextActive]}>
                    {k.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.button} onPress={handleAdd} disabled={loading}>
              <Text style={styles.buttonText}>إضافة</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  }

  if (session && subject) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => setSubject(null)}>
          <Text style={styles.back}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{subject.name}</Text>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c.id} style={styles.categoryCard} onPress={() => openCategory(c)}>
            <Text style={styles.categoryText}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  if (session) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>أهلاً {session.name}</Text>

        <Text style={styles.sectionTitle}>المواد المضافة للمجموع</Text>
        {SUBJECTS_ADDED.map((s) => (
          <TouchableOpacity key={s.id} style={styles.subjectCard} onPress={() => openSubject(s)}>
            <Text style={styles.subjectText}>{s.name}</Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>المواد غير المضافة للمجموع</Text>
        {SUBJECTS_NOT_ADDED.map((s) => (
          <TouchableOpacity key={s.id} style={styles.subjectCard} onPress={() => openSubject(s)}>
            <Text style={styles.subjectText}>{s.name}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>خروج</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.loginScroll}>
      <Text style={[styles.title, { marginBottom: 8 }]}>{'أهلاً بك في تطبيق لخص لي شكراً'}</Text>
      <Text style={styles.subtitle}>تصميم الطالب سيف محمد صلاح</Text>
      <TextInput
        style={styles.input}
        placeholder="اسم المستخدم (إنجليزي)"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="كلمة السر"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {loading && <ActivityIndicator style={{ marginBottom: 12 }} />}
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <TouchableOpacity
          style={[styles.secondaryButton, { flex: 1, marginTop: 0, marginRight: 8 }]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>حساب جديد</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { flex: 1, marginTop: 0 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>دخول</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loginScroll: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f2f4f7' },
  scroll: { padding: 24, paddingTop: 48, backgroundColor: '#f2f4f7', minHeight: '100%' },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 24, color: '#1a1a2e' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24, color: '#555' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginTop: 16, marginBottom: 8, color: '#333' },
  subjectCard: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#ccd' },
  subjectText: { fontSize: 17, textAlign: 'right', color: '#1a1a2e' },
  categoryCard: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 24, marginBottom: 14, borderWidth: 1, borderColor: '#2563eb', alignItems: 'center' },
  categoryText: { fontSize: 20, fontWeight: 'bold', color: '#2563eb' },
  kindText: { fontSize: 13, textAlign: 'right', color: '#2563eb', marginTop: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, textAlign: 'right' },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  secondaryButton: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#2563eb' },
  secondaryButtonText: { color: '#2563eb', fontSize: 16, fontWeight: 'bold' },
  back: { fontSize: 16, color: '#2563eb', textAlign: 'right', marginBottom: 8 },
  empty: { textAlign: 'center', color: '#667', marginVertical: 16 },
  adminBox: { marginTop: 24, paddingTop: 8, borderTopWidth: 1, borderColor: '#ccd' },
  kindRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: '#2563eb', marginLeft: 8 },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#2563eb', fontWeight: 'bold' },
  chipTextActive: { color: '#fff' },
});
