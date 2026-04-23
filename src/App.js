import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

const PASS = '059805';
const API_KEY_STORED = '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';
const FROM_EMAIL = 'jobs@eshaqjob.store';

const LOGO = () => (
  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
    <rect width="38" height="38" rx="10" fill="#1a1a2e"/>
    <text x="7" y="26" fontSize="20" fontFamily="Arial" fontWeight="bold" fill="#e8b923">و</text>
    <rect x="22" y="10" width="10" height="2.5" rx="1.2" fill="#e8b923"/>
    <rect x="22" y="15" width="8" height="2.5" rx="1.2" fill="#e8b923" opacity="0.7"/>
    <rect x="22" y="20" width="10" height="2.5" rx="1.2" fill="#e8b923" opacity="0.5"/>
  </svg>
);

// ────────── LOGIN SCREEN ──────────
function LoginScreen({ onLogin }) {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const handle = () => {
    if (pass !== PASS) { setErr('كلمة المرور غير صحيحة'); return; }
    onLogin();
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo"><LOGO /></div>
        <h1 className="login-title">وظيفتنا</h1>
        <p className="login-sub">مرسل طلبات التوظيف الذكي</p>
        <div className="field-group">
          <label>كلمة المرور</label>
          <input
            type="password"
            placeholder="أدخل كلمة المرور"
            value={pass}
            onChange={e => { setPass(e.target.value); setErr(''); }}
            onKeyDown={e => e.key === 'Enter' && handle()}
            className="inp"
          />
          {err && <p className="err-msg">{err}</p>}
        </div>
        <button className="btn-primary full" onClick={handle}>دخول</button>
      </div>
    </div>
  );
}

// ────────── MAIN APP ──────────
const TABS = ['الفلتر', 'الرسالة', 'الإرسال', 'التقارير'];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Excel / contacts
  const [sheets, setSheets] = useState({});       // { sheetName: [rows] }
  const [selectedCity, setSelectedCity] = useState('');
  const [qtyMode, setQtyMode] = useState('all');   // all | preset | custom
  const [qtyPreset, setQtyPreset] = useState(100);
  const [qtyCustom, setQtyCustom] = useState('');
  const [excelFileName, setExcelFileName] = useState('');

  // CV
  const [cvFile, setCvFile] = useState(null);
  const [cvB64, setCvB64] = useState(null);

  // Message
  const [subject, setSubject] = useState('طلب توظيف — {{CompanyName}}');
  const [body, setBody] = useState(
    'السادة المسؤولين في {{CompanyName}}،\n\nأتقدم بطلبي للانضمام إلى فريقكم وأرفق سيرتي الذاتية للاطلاع عليها.\n\nشكراً لكم،\nفريق وظيفتنا'
  );

  // Send state
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [sendLog, setSendLog] = useState([]);
  const [sendIdx, setSendIdx] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const pauseRef = useRef(false);
  const stopRef = useRef(false);
  const timerRef = useRef(null);

  // ─── derive target list ───
  const getTargetList = useCallback(() => {
    const cityRows = selectedCity && sheets[selectedCity] ? sheets[selectedCity] : Object.values(sheets).flat();
    // find email column
    const withEmail = cityRows.filter(r => {
      const e = r.Email || r.email || r['الإيميل'] || r['البريد'] || r['البريد الإلكتروني'] || '';
      return e.trim();
    });
    if (qtyMode === 'all') return withEmail;
    if (qtyMode === 'preset') return withEmail.slice(0, qtyPreset);
    const n = parseInt(qtyCustom);
    return withEmail.slice(0, isNaN(n) ? withEmail.length : n);
  }, [sheets, selectedCity, qtyMode, qtyPreset, qtyCustom]);

  const targetList = getTargetList();

  // ─── elapsed timer ───
  useEffect(() => {
    if (sending && !paused) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [sending, paused]);

  // ─── Excel upload ───
  const handleExcel = e => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const result = {};
      wb.SheetNames.forEach(name => {
        result[name] = XLSX.utils.sheet_to_json(wb.Sheets[name]);
      });
      setSheets(result);
      setSelectedCity('');
    };
    reader.readAsArrayBuffer(file);
  };

  // ─── CV upload ───
  const handleCV = e => {
    const file = e.target.files[0];
    if (!file) return;
    setCvFile(file);
    const reader = new FileReader();
    reader.onload = ev => setCvB64(ev.target.result.split(',')[1]);
    reader.readAsDataURL(file);
  };

  // ─── fill template ───
  const fill = (tpl, row) => tpl
    .replace(/{{CompanyName}}/g, row.CompanyName || row.Company || row['اسم الشركة'] || row['الشركة'] || 'الشركة')
    .replace(/{{ContactName}}/g, row.ContactName || row.Name || row.name || row['الاسم'] || 'مسؤول التوظيف')
    .replace(/{{City}}/g, row.City || row['المدينة'] || '');

  // ─── get email from row ───
  const getEmail = row => (row.Email || row.email || row['الإيميل'] || row['البريد'] || row['البريد الإلكتروني'] || '').trim();

  // ─── SEND ───
  const startSend = async () => {
    if (!Object.keys(sheets).length) { alert('ارفع ملف Excel أولاً'); return; }
    if (!targetList.length) { alert('لا يوجد إيميلات في القائمة المختارة'); return; }
    if (!body.trim()) { alert('اكتب نص الرسالة أولاً'); return; }

    setSending(true);
    setPaused(false);
    setStopped(false);
    setSendLog([]);
    setSendIdx(0);
    setElapsed(0);
    setStartTime(Date.now());
    pauseRef.current = false;
    stopRef.current = false;

    for (let i = 0; i < targetList.length; i++) {
      if (stopRef.current) break;

      while (pauseRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }
      if (stopRef.current) break;

      setSendIdx(i + 1);
      const row = targetList[i];
      const to = getEmail(row);
      if (!to) continue;

      const filledSubject = fill(subject, row);
      const filledBody = fill(body, row);

      try {
        const payload = {
          sender: { name: 'فريق وظيفتنا', email: FROM_EMAIL },
          to: [{ email: to }],
          subject: filledSubject,
          htmlContent: filledBody.replace(/\n/g, '<br>'),
          textContent: filledBody,
        };
        if (cvB64 && cvFile) {
          payload.attachment = [{ content: cvB64, name: cvFile.name }];
        }

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': API_KEY_STORED,
          },
          body: JSON.stringify(payload),
        });

        const ok = res.ok;
        const data = await res.json().catch(() => ({}));
        setSendLog(prev => [...prev, {
          email: to,
          company: row.CompanyName || row.Company || row['الشركة'] || '—',
          status: ok ? 'sent' : 'failed',
          msgId: data.messageId || '',
          time: new Date().toLocaleTimeString('ar-SA'),
        }]);
      } catch (e) {
        setSendLog(prev => [...prev, { email: to, company: row['الشركة'] || '—', status: 'failed', time: new Date().toLocaleTimeString('ar-SA') }]);
      }

      if (i < targetList.length - 1 && !stopRef.current) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setSending(false);
    setPaused(false);
  };

  const pauseSend = () => {
    pauseRef.current = true;
    setPaused(true);
  };

  const resumeSend = () => {
    pauseRef.current = false;
    setPaused(false);
  };

  const stopSend = () => {
    stopRef.current = true;
    pauseRef.current = false;
    setSending(false);
    setPaused(false);
    setStopped(true);
  };

  // ─── export Excel ───
  const exportExcel = () => {
    const rows = sendLog.map(l => ({
      'الإيميل': l.email,
      'الشركة': l.company,
      'الحالة': l.status === 'sent' ? 'تم الإرسال' : 'فشل',
      'الوقت': l.time,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نتائج الإرسال');
    XLSX.writeFile(wb, `وظيفتنا-نتائج-${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.xlsx`);
  };

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const sent = sendLog.filter(l => l.status === 'sent').length;
  const failed = sendLog.filter(l => l.status === 'failed').length;

  return !loggedIn
    ? <LoginScreen onLogin={() => setLoggedIn(true)} />
    : (
      <div className="app" dir="rtl">
        {/* ── HEADER ── */}
        <header className="header">
          <div className="header-left">
            <LOGO />
            <div>
              <span className="header-title">وظيفتنا</span>
              <span className="header-sub">مرسل طلبات التوظيف</span>
            </div>
          </div>
          <button className="btn-ghost logout" onClick={() => setLoggedIn(false)}>خروج</button>
        </header>

        {/* ── TABS ── */}
        <nav className="tabs">
          {TABS.map((t, i) => (
            <button key={i} className={`tab ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>{t}</button>
          ))}
        </nav>

        <main className="main">

          {/* ══ TAB 0 — الفلتر ══ */}
          {activeTab === 0 && (
            <div className="tab-content">
              {/* Excel upload */}
              <div className="card">
                <h3 className="card-title">رفع ملف الإيميلات</h3>
                <label className="upload-box">
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcel} hidden />
                  <span className="upload-icon">📂</span>
                  <span className="upload-text">{excelFileName || 'اضغط لرفع ملف Excel'}</span>
                  {excelFileName && <span className="upload-count">{Object.values(sheets).flat().length} سجل</span>}
                </label>
              </div>

              {/* City selection */}
              {Object.keys(sheets).length > 0 && (
                <div className="card">
                  <h3 className="card-title">اختر المدينة</h3>
                  <div className="city-grid">
                    <button
                      className={`city-btn ${selectedCity === '' ? 'active' : ''}`}
                      onClick={() => setSelectedCity('')}
                    >
                      الكل <span className="city-count">{Object.values(sheets).flat().length}</span>
                    </button>
                    {Object.keys(sheets).map(city => (
                      <button
                        key={city}
                        className={`city-btn ${selectedCity === city ? 'active' : ''}`}
                        onClick={() => setSelectedCity(city)}
                      >
                        {city} <span className="city-count">{sheets[city].length}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity selection */}
              {Object.keys(sheets).length > 0 && (
                <div className="card">
                  <h3 className="card-title">كمية الإرسال</h3>
                  <div className="qty-grid">
                    <button className={`qty-btn ${qtyMode === 'all' ? 'active' : ''}`} onClick={() => setQtyMode('all')}>
                      الكل <span className="qty-sub">({Object.values(sheets).flat().length})</span>
                    </button>
                    {[100, 200, 300, 400, 500, 600, 700, 800, 900].map(n => (
                      <button
                        key={n}
                        className={`qty-btn ${qtyMode === 'preset' && qtyPreset === n ? 'active' : ''}`}
                        onClick={() => { setQtyMode('preset'); setQtyPreset(n); }}
                      >
                        {n}
                      </button>
                    ))}
                    <button className={`qty-btn ${qtyMode === 'custom' ? 'active' : ''}`} onClick={() => setQtyMode('custom')}>
                      تحديد يدوي
                    </button>
                  </div>
                  {qtyMode === 'custom' && (
                    <input
                      type="number"
                      className="inp"
                      placeholder="أدخل العدد"
                      value={qtyCustom}
                      onChange={e => setQtyCustom(e.target.value)}
                      style={{ marginTop: 12, maxWidth: 180 }}
                    />
                  )}
                  <p className="count-summary">
                    سيتم الإرسال لـ <strong>{targetList.length}</strong> إيميل
                    {selectedCity ? ` من ${selectedCity}` : ' من جميع المدن'}
                  </p>
                </div>
              )}

              {/* CV upload */}
              <div className="card">
                <h3 className="card-title">رفع السيرة الذاتية (PDF)</h3>
                <label className="upload-box">
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleCV} hidden />
                  <span className="upload-icon">📄</span>
                  <span className="upload-text">{cvFile ? cvFile.name : 'اضغط لرفع السيرة الذاتية'}</span>
                </label>
              </div>
            </div>
          )}

          {/* ══ TAB 1 — الرسالة ══ */}
          {activeTab === 1 && (
            <div className="tab-content">
              <div className="card">
                <h3 className="card-title">عنوان الرسالة</h3>
                <input className="inp" value={subject} onChange={e => setSubject(e.target.value)} placeholder="عنوان الإيميل" />
                <p className="hint">يمكنك استخدام {'{{CompanyName}}'} لإدراج اسم الشركة</p>
              </div>
              <div className="card">
                <h3 className="card-title">نص الرسالة</h3>
                <div className="vars-row">
                  {['{{CompanyName}}', '{{ContactName}}', '{{City}}'].map(v => (
                    <button key={v} className="var-chip" onClick={() => setBody(b => b + v)}>{v}</button>
                  ))}
                </div>
                <textarea
                  className="textarea"
                  rows={10}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                />
              </div>
              {/* Preview */}
              {targetList.length > 0 && (
                <div className="card">
                  <h3 className="card-title">معاينة (أول إيميل)</h3>
                  <div className="preview-box">
                    <p className="preview-subject"><strong>العنوان:</strong> {fill(subject, targetList[0])}</p>
                    <hr />
                    <pre className="preview-body">{fill(body, targetList[0])}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB 2 — الإرسال ══ */}
          {activeTab === 2 && (
            <div className="tab-content">
              {/* Status cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">المستهدف</span>
                  <span className="stat-val">{targetList.length}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">تم الإرسال</span>
                  <span className="stat-val green">{sent}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">فشل</span>
                  <span className="stat-val red">{failed}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">الوقت المنقضي</span>
                  <span className="stat-val">{fmt(elapsed)}</span>
                </div>
              </div>

              {/* Progress bar */}
              {(sending || stopped || sendLog.length > 0) && (
                <div className="card">
                  <div className="progress-header">
                    <span>{sendIdx} / {targetList.length}</span>
                    <span className={`status-badge ${sending && !paused ? 'running' : paused ? 'paused' : stopped ? 'stopped' : 'done'}`}>
                      {sending && !paused ? 'جارٍ الإرسال' : paused ? 'متوقف مؤقتاً' : stopped ? 'تم الإيقاف' : 'اكتمل'}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${targetList.length ? (sendIdx / targetList.length) * 100 : 0}%` }} />
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="controls-row">
                {!sending ? (
                  <button className="btn-primary" onClick={startSend} disabled={!targetList.length}>
                    ابدأ الإرسال
                  </button>
                ) : (
                  <>
                    {!paused
                      ? <button className="btn-pause" onClick={pauseSend}>⏸ إيقاف مؤقت</button>
                      : <button className="btn-resume" onClick={resumeSend}>▶ استكمال</button>
                    }
                    <button className="btn-stop" onClick={stopSend}>⏹ إيقاف نهائي</button>
                  </>
                )}
                {sendLog.length > 0 && (
                  <button className="btn-export" onClick={exportExcel}>⬇ تصدير Excel</button>
                )}
              </div>

              {/* Log */}
              {sendLog.length > 0 && (
                <div className="card">
                  <h3 className="card-title">سجل الإرسال</h3>
                  <div className="log-list">
                    {[...sendLog].reverse().map((l, i) => (
                      <div key={i} className={`log-item ${l.status}`}>
                        <span className={`dot dot-${l.status}`} />
                        <span className="log-email">{l.email}</span>
                        <span className="log-company">{l.company}</span>
                        <span className="log-time">{l.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB 3 — التقارير ══ */}
          {activeTab === 3 && (
            <div className="tab-content">
              <div className="card">
                <h3 className="card-title">ملخص الجلسة</h3>
                <div className="report-grid">
                  <div className="report-item">
                    <span className="report-icon">📨</span>
                    <span className="report-num">{sendLog.length}</span>
                    <span className="report-lbl">إجمالي المحاولات</span>
                  </div>
                  <div className="report-item">
                    <span className="report-icon">✅</span>
                    <span className="report-num green">{sent}</span>
                    <span className="report-lbl">تم الإرسال</span>
                  </div>
                  <div className="report-item">
                    <span className="report-icon">❌</span>
                    <span className="report-num red">{failed}</span>
                    <span className="report-lbl">فشل الإرسال</span>
                  </div>
                  <div className="report-item">
                    <span className="report-icon">⏱</span>
                    <span className="report-num">{fmt(elapsed)}</span>
                    <span className="report-lbl">وقت الجلسة</span>
                  </div>
                  <div className="report-item">
                    <span className="report-icon">📊</span>
                    <span className="report-num">{sent ? Math.round((sent / sendLog.length) * 100) : 0}%</span>
                    <span className="report-lbl">معدل النجاح</span>
                  </div>
                  <div className="report-item">
                    <span className="report-icon">🏙</span>
                    <span className="report-num" style={{ fontSize: 18 }}>{selectedCity || 'الكل'}</span>
                    <span className="report-lbl">المدينة المحددة</span>
                  </div>
                </div>
                {sendLog.length > 0 && (
                  <button className="btn-export full" onClick={exportExcel} style={{ marginTop: 20 }}>
                    ⬇ تصدير تقرير Excel كامل
                  </button>
                )}
                {!sendLog.length && (
                  <p className="empty-msg">لا يوجد بيانات بعد — ابدأ الإرسال أولاً</p>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    );
}
