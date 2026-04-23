import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';

const TABS = [
  { id: 'setup', label: 'الإعداد', icon: '⚙️' },
  { id: 'compose', label: 'الرسالة', icon: '✍️' },
  { id: 'send', label: 'الإرسال', icon: '🚀' },
  { id: 'stats', label: 'الإحصائيات', icon: '📊' },
];

const DEFAULT_SUBJECT = 'طلب توظيف - {{CompanyName}}';
const DEFAULT_BODY = `السادة في شركة {{CompanyName}} المحترمين،

أتقدم بطلب الانضمام إلى فريقكم المتميز، مرفق السيرة الذاتية للاطلاع عليها.

أتمنى أن تجدوا في مؤهلاتي ما يتناسب مع متطلباتكم.

مع التقدير،
إسحاق`;

export default function App() {
  const [tab, setTab] = useState('setup');

  // Setup
  const [apiKey, setApiKey] = useState('');
  const [fromName, setFromName] = useState('إسحاق');
  const [fromEmail, setFromEmail] = useState('hr@eshaqjob.store');
  const [delay, setDelay] = useState(30);
  const [contacts, setContacts] = useState([]);
  const [cvFile, setCvFile] = useState(null);
  const [cvData, setCvData] = useState(null);

  // Compose
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);

  // Send
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const stopRef = useRef(false);

  // Stats
  const sent = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;

  const handleExcel = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      setContacts(rows);
      setResults([]);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleCV = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1];
      setCvData({ content: base64, name: file.name });
    };
    reader.readAsDataURL(file);
  }, []);

  const fillTemplate = (template, contact) => {
    return template
      .replace(/{{CompanyName}}/g, contact.CompanyName || contact.Company || contact.company || 'الشركة')
      .replace(/{{ContactName}}/g, contact.ContactName || contact.Name || contact.name || 'مسؤول التوظيف')
      .replace(/{{Email}}/g, contact.Email || contact.email || '');
  };

  const sendAll = async () => {
    if (!contacts.length) return alert('أضف قائمة الشركات أولاً');
    if (!apiKey) return alert('أدخل API Key أولاً');

    setSending(true);
    stopRef.current = false;
    setResults([]);
    setCurrentIdx(0);

    const attachments = cvData ? [cvData] : [];

    for (let i = 0; i < contacts.length; i++) {
      if (stopRef.current) break;
      const contact = contacts[i];
      const email = contact.Email || contact.email;
      if (!email) {
        setResults(r => [...r, { ...contact, status: 'failed', error: 'لا يوجد إيميل' }]);
        continue;
      }

      setCurrentIdx(i + 1);

      try {
        const res = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            toName: contact.ContactName || contact.Name || '',
            subject: fillTemplate(subject, contact),
            body: fillTemplate(body, contact),
            fromName,
            fromEmail,
            apiKey,
            attachments,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setResults(r => [...r, { ...contact, email, status: 'sent' }]);
        } else {
          setResults(r => [...r, { ...contact, email, status: 'failed', error: data.error || 'خطأ' }]);
        }
      } catch (err) {
        setResults(r => [...r, { ...contact, email, status: 'failed', error: err.message }]);
      }

      if (i < contacts.length - 1 && !stopRef.current) {
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
      }
    }

    setSending(false);
  };

  const progress = contacts.length > 0 ? Math.round((results.length / contacts.length) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: 'var(--accent)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>✉</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>JobMailer</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>مرسل طلبات التوظيف</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {contacts.length > 0 && (
            <span className="badge badge-purple">{contacts.length} جهة</span>
          )}
          {cvFile && (
            <span className="badge badge-green">📎 {cvFile.name}</span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        padding: '0 24px',
        gap: 4,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none',
            border: 'none',
            padding: '14px 16px',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            color: tab === t.id ? 'var(--accent2)' : 'var(--text2)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'inherit',
          }}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ flex: 1, padding: '24px', maxWidth: 800, margin: '0 auto', width: '100%' }}>

        {/* SETUP TAB */}
        {tab === 'setup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔑</span> إعدادات Brevo
              </div>
              <div className="field">
                <label className="label">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="xkeysib-..."
                  dir="ltr"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="label">اسم المرسل</label>
                  <input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="إسحاق" />
                </div>
                <div className="field">
                  <label className="label">إيميل المرسل</label>
                  <input value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="hr@eshaqjob.store" dir="ltr" />
                </div>
              </div>
              <div className="field">
                <label className="label">التأخير بين كل إيميل (ثانية)</label>
                <input type="number" min="5" max="120" value={delay} onChange={e => setDelay(+e.target.value)} />
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  يُنصح بـ 30 ثانية للحماية من الحظر
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📂</span> قائمة الشركات (Excel)
              </div>
              <label style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '32px 20px',
                border: '2px dashed var(--border2)',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: contacts.length ? 'var(--green-bg)' : 'transparent',
              }}>
                <span style={{ fontSize: 32 }}>{contacts.length ? '✅' : '📊'}</span>
                <span style={{ fontWeight: 600, color: contacts.length ? 'var(--green)' : 'var(--text2)' }}>
                  {contacts.length ? `${contacts.length} شركة محملة` : 'اضغط لرفع ملف Excel'}
                </span>
                {!contacts.length && (
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                    الأعمدة المطلوبة: Email, CompanyName (اختياري: ContactName)
                  </span>
                )}
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcel} style={{ display: 'none' }} />
              </label>
              {contacts.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 200, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>الإيميل</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>الشركة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.slice(0, 8).map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--text2)', direction: 'ltr', textAlign: 'left' }}>{c.Email || c.email}</td>
                          <td style={{ padding: '6px 8px' }}>{c.CompanyName || c.Company || '—'}</td>
                        </tr>
                      ))}
                      {contacts.length > 8 && (
                        <tr><td colSpan={2} style={{ padding: '8px', color: 'var(--text3)', textAlign: 'center', fontSize: 12 }}>
                          و {contacts.length - 8} شركة أخرى...
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📎</span> السيرة الذاتية (PDF)
              </div>
              <label style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '28px 20px',
                border: '2px dashed var(--border2)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: cvFile ? 'var(--green-bg)' : 'transparent',
              }}>
                <span style={{ fontSize: 28 }}>{cvFile ? '✅' : '📄'}</span>
                <span style={{ fontWeight: 600, color: cvFile ? 'var(--green)' : 'var(--text2)' }}>
                  {cvFile ? cvFile.name : 'اضغط لرفع CV'}
                </span>
                <input type="file" accept=".pdf,.doc,.docx" onChange={handleCV} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        )}

        {/* COMPOSE TAB */}
        {tab === 'compose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✍️</span> محتوى الرسالة
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
                استخدم <code style={{ background: 'var(--accent-bg)', color: 'var(--accent2)', padding: '1px 6px', borderRadius: 4 }}>{'{{CompanyName}}'}</code> و <code style={{ background: 'var(--accent-bg)', color: 'var(--accent2)', padding: '1px 6px', borderRadius: 4 }}>{'{{ContactName}}'}</code> للتخصيص التلقائي
              </div>
              <div className="field">
                <label className="label">عنوان الإيميل</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">نص الرسالة</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={12}
                />
              </div>
            </div>

            {/* Preview */}
            {contacts.length > 0 && (
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text2)' }}>
                  معاينة — {contacts[0].CompanyName || contacts[0].Company || 'الشركة'}
                </div>
                <div style={{
                  background: 'var(--surface2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 16,
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: 'var(--text)',
                }}>
                  <div style={{ color: 'var(--text3)', marginBottom: 8 }}>
                    <strong>الموضوع:</strong> {fillTemplate(subject, contacts[0])}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{fillTemplate(body, contacts[0])}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SEND TAB */}
        {tab === 'send' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>ملخص الإرسال</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'إجمالي الشركات', value: contacts.length, color: 'var(--accent2)' },
                  { label: 'مع سيرة ذاتية', value: cvFile ? 'نعم ✅' : 'لا ❌', color: cvFile ? 'var(--green)' : 'var(--red)' },
                  { label: 'التأخير', value: `${delay} ث`, color: 'var(--amber)' },
                ].map((s, i) => (
                  <div key={i} style={{
                    background: 'var(--surface2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress */}
            {(sending || results.length > 0) && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>التقدم</span>
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>{results.length} / {contacts.length}</span>
                </div>
                <div style={{ background: 'var(--surface2)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
                    borderRadius: 999,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <span className="badge badge-green">✓ {sent} تم الإرسال</span>
                  {failed > 0 && <span className="badge badge-red">✗ {failed} فشل</span>}
                  {sending && <span className="badge badge-amber">⟳ جارٍ الإرسال...</span>}
                </div>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 12 }}>النتائج</div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {results.map((r, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 13,
                    }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.CompanyName || r.Company || r.email}</div>
                        <div style={{ color: 'var(--text3)', fontSize: 12, direction: 'ltr' }}>{r.email}</div>
                      </div>
                      <span className={`badge ${r.status === 'sent' ? 'badge-green' : 'badge-red'}`}>
                        {r.status === 'sent' ? '✓ أُرسل' : `✗ ${r.error || 'فشل'}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              {!sending ? (
                <button className="btn btn-primary" onClick={sendAll} disabled={!contacts.length || !apiKey}
                  style={{ flex: 1, justifyContent: 'center', padding: '14px', fontSize: 15 }}>
                  🚀 ابدأ الإرسال لـ {contacts.length} شركة
                </button>
              ) : (
                <button className="btn btn-ghost" onClick={() => { stopRef.current = true; setSending(false); }}
                  style={{ flex: 1, justifyContent: 'center', padding: '14px' }}>
                  ⏹ إيقاف
                </button>
              )}
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {tab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {[
                { label: 'إجمالي المرسلة', value: sent, icon: '✉️', color: 'var(--accent2)' },
                { label: 'نسبة النجاح', value: results.length ? `${Math.round((sent / results.length) * 100)}%` : '—', icon: '📈', color: 'var(--green)' },
                { label: 'فشل الإرسال', value: failed, icon: '❌', color: 'var(--red)' },
                { label: 'المتبقي', value: contacts.length - results.length, icon: '⏳', color: 'var(--amber)' },
              ].map((s, i) => (
                <div key={i} className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {results.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text3)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <div>لا توجد بيانات بعد — ابدأ الإرسال أولاً</div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );

  function fillTemplate(template, contact) {
    return template
      .replace(/{{CompanyName}}/g, contact.CompanyName || contact.Company || contact.company || 'الشركة')
      .replace(/{{ContactName}}/g, contact.ContactName || contact.Name || contact.name || 'مسؤول التوظيف')
      .replace(/{{Email}}/g, contact.Email || contact.email || '');
  }
}
