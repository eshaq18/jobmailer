import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';

const TABS = [
  { id: 'setup', label: 'الإعداد', icon: '⚙️' },
  { id: 'compose', label: 'الرسالة', icon: '✍️' },
  { id: 'filter', label: 'الفلترة', icon: '🔍' },
  { id: 'send', label: 'الإرسال', icon: '🚀' },
  { id: 'stats', label: 'الإحصائيات', icon: '📊' },
];

const DEFAULT_SUBJECT = 'طلب توظيف – {{CompanyName}}';
const DEFAULT_BODY = `السادة في شركة {{CompanyName}} المحترمين،

أتقدم بطلب الانضمام إلى فريقكم المتميز.
مرفق السيرة الذاتية للاطلاع عليها، وأتمنى أن تجدوا في مؤهلاتي ما يتناسب مع متطلباتكم.

مع التقدير،
إسحاق`;

function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="10" fill="url(#grad)"/>
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5b6af0"/>
          <stop offset="1" stopColor="#a78bfa"/>
        </linearGradient>
      </defs>
      <path d="M8 13a2 2 0 012-2h16a2 2 0 012 2v1.5L18 20 8 14.5V13z" fill="white" opacity="0.9"/>
      <path d="M8 16.5l10 5.8 10-5.8V23a2 2 0 01-2 2H10a2 2 0 01-2-2v-6.5z" fill="white" opacity="0.7"/>
      <circle cx="26" cy="10" r="4" fill="#10b981"/>
      <path d="M24 10l1.5 1.5L28 8.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function LoginModal({ onLogin }) {
  const [key, setKey] = useState('');
  const [email, setEmail] = useState('jobs@eshaqjob.store');
  const [name, setName] = useState('إسحاق');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');

  const handle = () => {
    if (!key || !email) { setErr('أدخل API Key والإيميل'); return; }
    if (pass !== '059805') { setErr('كلمة المرور غير صحيحة'); return; }
    onLogin({ apiKey: key, fromEmail: email, fromName: name });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Logo />
          <div style={{ marginTop: 12, fontWeight: 800, fontSize: 22 }}>وظيفتنا</div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>مرسل طلبات التوظيف الذكي</div>
        </div>
        {err && <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <div className="field">
          <label className="label">Brevo API Key</label>
          <input className="input" type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="xkeysib-..." dir="ltr"/>
        </div>
        <div className="field">
          <label className="label">اسم المرسل</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="إسحاق"/>
        </div>
        <div className="field">
          <label className="label">إيميل المرسل</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jobs@eshaqjob.store" dir="ltr"/>
        </div>
        <div className="field">
          <label className="label">كلمة المرور</label>
          <div style={{ position: 'relative' }}>
            <input className="input" type={show ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" dir="ltr"/>
            <button onClick={() => setShow(!show)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>{show ? '🙈' : '👁'}</button>
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', padding: 14, fontSize: 15, marginTop: 8 }} onClick={handle}>
          دخول ← 
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [creds, setCreds] = useState(null);
  const [tab, setTab] = useState('setup');

  // Setup
  const [delay, setDelay] = useState(30);
  const [contacts, setContacts] = useState([]);
  const [allContacts, setAllContacts] = useState([]);
  const [sheets, setSheets] = useState({});
  const [sheetNames, setSheetNames] = useState([]);
  const [cvFile, setCvFile] = useState(null);
  const [cvData, setCvData] = useState(null);
  const [excelCols, setExcelCols] = useState([]);

  // Compose
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);

  // Filter
  const [cityCol, setCityCol] = useState('');
  const [selectedCity, setSelectedCity] = useState('الكل');
  const [sendCount, setSendCount] = useState('الكل');
  const [customCount, setCustomCount] = useState(50);

  // Send
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [results, setResults] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const stopRef = useRef(false);
  const pauseRef = useRef(false);
  const timerRef = useRef(null);

  // Timer
  useEffect(() => {
    if (sending && !paused) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [sending, paused]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
  };

  const estimateTime = () => {
    const remaining = filteredContacts.length - results.length;
    return formatTime(remaining * delay);
  };

  const handleExcel = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      // Read all sheets — each sheet name = city
      const sheetData = {};
      wb.SheetNames.forEach(name => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name]);
        sheetData[name] = rows;
      });
      setSheets(sheetData);
      setSheetNames(wb.SheetNames);
      setSelectedCity(wb.SheetNames[0]);
      const allRows = Object.values(sheetData).flat();
      setAllContacts(allRows);
      if (allRows.length > 0) setExcelCols(Object.keys(allRows[0]));
      setResults([]);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleCV = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCvData({ content: ev.target.result.split(',')[1], name: file.name });
    reader.readAsDataURL(file);
  }, []);

  // Apply filters — use sheet directly
  const filteredContacts = (() => {
    if (!sheetNames.length) return [];
    if (selectedCity === 'الكل') return allContacts;
    return sheets[selectedCity] || [];
  })();

  const fillTemplate = (template, contact) =>
    template
      .replace(/{{CompanyName}}/g, contact.CompanyName || contact.Company || contact.company || 'الشركة')
      .replace(/{{ContactName}}/g, contact.ContactName || contact.Name || contact.name || 'مسؤول التوظيف')
      .replace(/{{City}}/g, contact.City || contact.city || '');

  const sendAll = async () => {
    if (!filteredContacts.length) return alert('لا توجد جهات مطابقة');
    if (!creds?.apiKey) return alert('أدخل API Key أولاً');
    setSending(true);
    setPaused(false);
    stopRef.current = false;
    pauseRef.current = false;
    setResults([]);
    setElapsed(0);
    setStartTime(Date.now());

    const attachments = cvData ? [cvData] : [];

    for (let i = 0; i < filteredContacts.length; i++) {
      if (stopRef.current) break;
      while (pauseRef.current) await new Promise(r => setTimeout(r, 500));
      if (stopRef.current) break;

      const contact = filteredContacts[i];
      const email = contact.Email || contact.email;
      if (!email) { setResults(r => [...r, { ...contact, email: '—', status: 'failed', error: 'لا يوجد إيميل', time: new Date().toLocaleTimeString('ar') }]); continue; }

      try {
        const res = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email, toName: contact.ContactName || contact.Name || '',
            subject: fillTemplate(subject, contact),
            body: fillTemplate(body, contact),
            fromName: creds.fromName, fromEmail: creds.fromEmail,
            apiKey: creds.apiKey, attachments,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setResults(r => [...r, { ...contact, email, status: 'sent', time: new Date().toLocaleTimeString('ar') }]);
        } else {
          setResults(r => [...r, { ...contact, email, status: 'failed', error: data.error || 'خطأ', time: new Date().toLocaleTimeString('ar') }]);
        }
      } catch (err) {
        setResults(r => [...r, { ...contact, email, status: 'failed', error: err.message, time: new Date().toLocaleTimeString('ar') }]);
      }

      if (i < filteredContacts.length - 1 && !stopRef.current) await new Promise(r => setTimeout(r, delay * 1000));
    }
    setSending(false);
    setPaused(false);
  };

  const togglePause = () => {
    setPaused(p => { pauseRef.current = !p; return !p; });
  };

  const stopAll = () => { stopRef.current = true; pauseRef.current = false; setPaused(false); setSending(false); };

  const exportExcel = () => {
    if (!results.length) return;
    const data = results.map(r => ({
      'الشركة': r.CompanyName || r.Company || '—',
      'الإيميل': r.email,
      'المدينة': r[cityCol] || '—',
      'الحالة': r.status === 'sent' ? 'تم الإرسال' : 'فشل',
      'الخطأ': r.error || '—',
      'وقت الإرسال': r.time || '—',
      'مدة الجلسة': formatTime(elapsed),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نتائج الإرسال');
    XLSX.writeFile(wb, `وظيفتنا_${new Date().toLocaleDateString('ar')}.xlsx`);
  };

  const sent = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const progress = filteredContacts.length > 0 ? Math.round((results.length / filteredContacts.length) * 100) : 0;

  if (!creds) return <LoginModal onLogin={setCreds} />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo />
          <div>
            <div style={{ fontWeight: 900, fontSize: 17, background: 'linear-gradient(135deg, var(--accent3), var(--accent2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>وظيفتنا</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: -2 }}>مرسل طلبات التوظيف</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {filteredContacts.length > 0 && <span className="badge badge-blue">🎯 {filteredContacts.length} جهة مختارة</span>}
          {cvFile && <span className="badge badge-green">📎 {cvFile.name}</span>}
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setCreds(null)}>خروج</button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', padding: '0 24px', gap: 2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            padding: '14px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            color: tab === t.id ? 'var(--accent3)' : 'var(--text3)', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      <main style={{ flex: 1, padding: '24px', maxWidth: 860, margin: '0 auto', width: '100%' }}>

        {/* SETUP */}
        {tab === 'setup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: 'var(--accent3)' }}>⚙️ إعدادات الإرسال</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="label">اسم المرسل</label>
                  <input className="input" value={creds.fromName} onChange={e => setCreds(c => ({...c, fromName: e.target.value}))}/>
                </div>
                <div className="field">
                  <label className="label">إيميل المرسل</label>
                  <input className="input" value={creds.fromEmail} onChange={e => setCreds(c => ({...c, fromEmail: e.target.value}))} dir="ltr"/>
                </div>
              </div>
              <div className="field">
                <label className="label">التأخير بين كل إيميل (ثانية)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" type="range" min="5" max="120" value={delay} onChange={e => setDelay(+e.target.value)} style={{ flex: 1 }}/>
                  <span style={{ fontWeight: 800, color: 'var(--accent2)', minWidth: 40, textAlign: 'center' }}>{delay}ث</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>⚡ الوقت المقدر: {formatTime(filteredContacts.length * delay)} لـ {filteredContacts.length} إيميل</div>
              </div>
            </div>

            <div className="card">
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: 'var(--accent3)' }}>📂 قائمة الشركات</div>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '28px', border: `2px dashed ${allContacts.length ? 'var(--green)' : 'var(--border2)'}`,
                borderRadius: 'var(--r-sm)', cursor: 'pointer',
                background: allContacts.length ? 'var(--green-bg)' : 'transparent', transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: 32 }}>{allContacts.length ? '✅' : '📊'}</span>
                <span style={{ fontWeight: 700, color: allContacts.length ? 'var(--green)' : 'var(--text2)' }}>
                  {allContacts.length ? `${allContacts.length} شركة محملة` : 'رفع ملف Excel'}
                </span>
                {!allContacts.length && <span style={{ fontSize: 12, color: 'var(--text3)' }}>أعمدة مقترحة: Email, CompanyName, City</span>}
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcel} style={{ display: 'none' }}/>
              </label>
              {allContacts.length > 0 && (
                <div style={{ marginTop: 12, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
                        {excelCols.slice(0,4).map(col => <th key={col} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{col}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {allContacts.slice(0,5).map((c,i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          {excelCols.slice(0,4).map(col => <td key={col} style={{ padding: '6px 8px', color: 'var(--text2)' }}>{c[col] || '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {allContacts.length > 5 && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>و {allContacts.length - 5} شركة أخرى...</div>}
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: 'var(--accent3)' }}>📎 السيرة الذاتية</div>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px',
                border: `2px dashed ${cvFile ? 'var(--green)' : 'var(--border2)'}`,
                borderRadius: 'var(--r-sm)', cursor: 'pointer',
                background: cvFile ? 'var(--green-bg)' : 'transparent',
              }}>
                <span style={{ fontSize: 28 }}>{cvFile ? '✅' : '📄'}</span>
                <span style={{ fontWeight: 700, color: cvFile ? 'var(--green)' : 'var(--text2)' }}>{cvFile ? cvFile.name : 'رفع CV (PDF/Word)'}</span>
                <input type="file" accept=".pdf,.doc,.docx" onChange={handleCV} style={{ display: 'none' }}/>
              </label>
            </div>
          </div>
        )}

        {/* COMPOSE */}
        {tab === 'compose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, color: 'var(--accent3)' }}>✍️ محتوى الرسالة</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                المتغيرات المتاحة:&nbsp;
                {['{{CompanyName}}','{{ContactName}}','{{City}}'].map(v => (
                  <code key={v} style={{ background: 'var(--accent-glow)', color: 'var(--accent3)', padding: '1px 6px', borderRadius: 4, marginLeft: 4, fontSize: 11 }}>{v}</code>
                ))}
              </div>
              <div className="field">
                <label className="label">عنوان الإيميل</label>
                <input className="input" value={subject} onChange={e => setSubject(e.target.value)}/>
              </div>
              <div className="field">
                <label className="label">نص الرسالة</label>
                <textarea className="input" value={body} onChange={e => setBody(e.target.value)} rows={10}/>
              </div>
            </div>
            {allContacts.length > 0 && (
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>معاينة — {allContacts[0].CompanyName || allContacts[0].Company || 'الشركة'}</div>
                <div style={{ background: 'var(--surface2)', borderRadius: 'var(--r-sm)', padding: 16, fontSize: 13, lineHeight: 1.9 }}>
                  <div style={{ color: 'var(--text3)', marginBottom: 8 }}><strong>الموضوع:</strong> {fillTemplate(subject, allContacts[0])}</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{fillTemplate(body, allContacts[0])}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FILTER */}
        {tab === 'filter' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: 'var(--accent3)' }}>🔍 اختر المدينة</div>

              {!sheetNames.length ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                  <div>ارفع ملف Excel أولاً من تبويب الإعداد</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                    <button onClick={() => setSelectedCity('الكل')} style={{
                      padding: '10px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      background: selectedCity === 'الكل' ? 'var(--accent)' : 'var(--surface2)',
                      color: selectedCity === 'الكل' ? 'white' : 'var(--text2)',
                      fontWeight: 700, fontSize: 14, fontFamily: 'inherit', transition: 'all 0.2s',
                    }}>
                      الكل ({allContacts.length})
                    </button>
                    {sheetNames.map(name => (
                      <button key={name} onClick={() => setSelectedCity(name)} style={{
                        padding: '10px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
                        background: selectedCity === name ? 'var(--accent)' : 'var(--surface2)',
                        color: selectedCity === name ? 'white' : 'var(--text2)',
                        fontWeight: 700, fontSize: 14, fontFamily: 'inherit', transition: 'all 0.2s',
                      }}>
                        {name} ({(sheets[name] || []).length})
                      </button>
                    ))}
                  </div>

                  <div style={{ background: 'var(--accent-glow)', borderRadius: 'var(--r-sm)', padding: '16px 18px' }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent3)' }}>🎯 {filteredContacts.length} جهة ستُرسل إليها</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>المدينة: {selectedCity} · الوقت المتوقع: {formatTime(filteredContacts.length * delay)}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* SEND */}
        {tab === 'send' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'إجمالي الجهات', value: filteredContacts.length, color: 'var(--accent3)' },
                { label: 'تم الإرسال', value: sent, color: 'var(--green)' },
                { label: 'فشل', value: failed, color: 'var(--red)' },
                { label: 'الوقت', value: formatTime(elapsed), color: 'var(--amber)' },
              ].map((s,i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '16px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Progress */}
            {(sending || results.length > 0) && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700 }}>التقدم — {progress}%</span>
                  <span style={{ color: 'var(--text3)', fontSize: 13 }}>{results.length} / {filteredContacts.length}</span>
                </div>
                <div style={{ background: 'var(--surface2)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent3))', borderRadius: 999, transition: 'width 0.4s' }}/>
                </div>
                {sending && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>
                    {paused ? '⏸ متوقف مؤقتاً' : `⟳ جارٍ الإرسال... الوقت المتبقي: ${estimateTime()}`}
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            <div style={{ display: 'flex', gap: 10 }}>
              {!sending ? (
                <button className="btn btn-primary" onClick={sendAll} disabled={!filteredContacts.length || !creds?.apiKey}
                  style={{ flex: 1, padding: 14, fontSize: 15 }}>
                  🚀 ابدأ الإرسال لـ {filteredContacts.length} جهة
                </button>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={togglePause} style={{ flex: 1, padding: 14 }}>
                    {paused ? '▶ استكمال' : '⏸ إيقاف مؤقت'}
                  </button>
                  <button className="btn btn-danger" onClick={stopAll} style={{ flex: 1, padding: 14 }}>
                    ⏹ إيقاف نهائي
                  </button>
                </>
              )}
              {results.length > 0 && (
                <button className="btn btn-success" onClick={exportExcel} style={{ padding: '14px 20px' }}>
                  📥 تصدير Excel
                </button>
              )}
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 12 }}>النتائج ({results.length})</div>
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {[...results].reverse().map((r,i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
                    }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{r.CompanyName || r.Company || r.email}</div>
                        <div style={{ color: 'var(--text3)', fontSize: 11, direction: 'ltr' }}>{r.email} · {r.time}</div>
                      </div>
                      <span className={`badge ${r.status === 'sent' ? 'badge-green' : 'badge-red'}`}>
                        {r.status === 'sent' ? '✓ أُرسل' : `✗ ${r.error || 'فشل'}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STATS */}
        {tab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'إجمالي المرسلة', value: sent, icon: '✉️', color: 'var(--accent3)' },
                { label: 'نسبة النجاح', value: results.length ? `${Math.round((sent/results.length)*100)}%` : '—', icon: '📈', color: 'var(--green)' },
                { label: 'فشل الإرسال', value: failed, icon: '❌', color: 'var(--red)' },
                { label: 'وقت الجلسة', value: formatTime(elapsed), icon: '⏱', color: 'var(--amber)' },
              ].map((s,i) => (
                <div key={i} className="card" style={{ textAlign: 'center', padding: '28px 16px' }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 34, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {results.length > 0 && (
              <button className="btn btn-success" onClick={exportExcel} style={{ width: '100%', padding: 14, fontSize: 15 }}>
                📥 تصدير تقرير Excel الكامل
              </button>
            )}
            {!results.length && (
              <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text3)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <div>ابدأ الإرسال لتظهر الإحصائيات</div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
