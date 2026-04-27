/* ══════════════════════════════════════════════════════════════
   Code.gs — نواقص المخزن (محدث ليعمل بكفاءة مع الداشبورد المودرن)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   التحديثات:
   - تم إزالة دالة حساب المدة القديمة حيث تعتمد الآن على العمود H مباشرة.
   - تم تحديث الداشبورد ليقرأ المدد من العمود H.
   - تم تحسين كود جلب البيانات للاستجابة بشكل أسرع.
   - الكود يدعم الـ CORS وتصدير ملفات Excel بنجاح.
══════════════════════════════════════════════════════════════ */

const DASHBOARD_URL   = "https://masterpiece2009.github.io/Virginia_Dashboard/"; // قم بتبديل الرابط فور رفع المشروع الجديد
const REPORT_EMAIL    = "mohamedgamalasd3@gmail.com";
const DASHBOARD_SHEET = "DASHBOARD"; // اسم شيت الداشبورد اللي بنتجاهله في API

/* ─────────────────────────────────────────────────────────────
   ON OPEN — إضافة قائمة الداشبورد
───────────────────────────────────────────────────────────── */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📊 Inventory Dashboard")
    .addItem("فتح الداشبورد الحديث", "openDashboardFull")
    .addToUi();
}

/* ─────────────────────────────────────────────────────────────
   OPEN DASHBOARD — فتح الداشبورد في نافذة كبيرة
───────────────────────────────────────────────────────────── */
function openDashboardFull() {
  const html = HtmlService.createHtmlOutput(`
    <html>
      <head>
        <style>
          html, body { height:100%; margin:0; padding:0; overflow:hidden; background:#050b14; font-family:sans-serif; }
          .bar { height:36px; background:#070f1d; color:#6b8ab5; display:flex; align-items:center; justify-content:center; font-size:13px; border-bottom:1px solid rgba(59,130,246,.15); }
          .bar a { color:#3b82f6; text-decoration:none; margin-right:8px; font-weight: 600; }
          iframe { width:100%; height:calc(100% - 36px); border:none; display:block; }
        </style>
      </head>
      <body>
        <div class="bar">
          <a href="${DASHBOARD_URL}" target="_blank">🔗 فتح لوحة التحكم التفاعلية في نافذة جديدة</a>
        </div>
        <iframe src="${DASHBOARD_URL}"></iframe>
      </body>
    </html>
  `)
  .setWidth(1200)
  .setHeight(800);

  SpreadsheetApp.getUi().showModalDialog(html, "لوحة تحكم نواقص المخازن المودرن");
}

/* ─────────────────────────────────────────────────────────────
   ON EDIT — مراقبة التعديلات (إرسال الإيميل فقط وتم إزالة الحساب القديم للمدة)
───────────────────────────────────────────────────────────── */
function onEdit(e) {
  try {
    if (!e || !e.range) return;

    const sheet   = e.source.getActiveSheet();
    const editedA1  = e.range.getA1Notation();

    // لما M2 = "تم" → ابعت الإيميل
    if (editedA1 === "M2") {
      const val = String(e.range.getValue() || "").trim();
      if (val === "تم") sendSelectedRowsAndAttachSheet(sheet);
    }
  } catch (err) {
    console.error("onEdit error:", err);
  }
}

/* ─────────────────────────────────────────────────────────────
   SEND EMAIL — إرسال الإيميل + التقرير Excel المرفق
───────────────────────────────────────────────────────────── */
function sendSelectedRowsAndAttachSheet(sheet) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 3) return;

  const data = sheet.getRange(3, 1, lastRow - 2, lastCol).getValues();

  // فلترة الصفوف اللي عندها حالة الطلب (العمود P - اندكس 15)
  const rowsToSend = data
    .map((row, idx) => ({ row: idx + 3, values: row }))
    .filter(({ values }) => values[15] !== "" && values[15] != null);

  if (rowsToSend.length === 0) {
    clearTriggerCellAndNotify(sheet, "⚠️ لا يوجد صفوف لإرسالها بناءً على حالة الطلب.");
    return;
  }

  // عناوين الأعمدة للإيميل
  const HEADERS = [
    "الباركود", "اسم الصنف", "آخر كمية تم توريدها", "تاريخ آخر توريد",
    "الكمية المطلوبة / طلب", "مدة التوريد", "التصنيف", "التوافر", "رصيد السيستم", "حالة الطلب", "ملاحظات"
  ];

  const htmlBody = `
    <html dir="rtl">
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f9fafb; direction: rtl; }
          h2 { color: #1e40af; margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; }
          th { background: #1e3a5f; color: #fff; padding: 10px; font-size: 13px; text-align: right; }
          td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 13px; color: #334155; }
        </style>
      </head>
      <body>
        <h2>📦 التقرير اليومي لنواقص المخازن — ${sheet.getName()}</h2>
        <table>
          <tr>${HEADERS.map(h => `<th>${h}</th>`).join("")}</tr>
          ${rowsToSend.map(r => {
             const code = r.values[0];   // A
             const name = r.values[1];   // B
             const lastQt = r.values[2]; // C
             const lastDt = r.values[3]; // D
             const reqQt = r.values[4];  // E
             const days = r.values[7];   // H
             const cat = r.values[12];   // M (12 index)
             const avail = r.values[13]; // N (13 index)
             const bal = r.values[14];   // O (14 index)
             const stat = r.values[15];  // P (15 index)
             const notes = r.values[16]; // Q (16 index)
             
             return `<tr><td>${formatCellValue(code)}</td><td>${formatCellValue(name)}</td><td>${formatCellValue(lastQt)}</td><td>${formatCellValue(lastDt)}</td><td>${formatCellValue(reqQt)}</td><td>${formatCellValue(days)}</td><td>${formatCellValue(cat)}</td><td>${formatCellValue(avail)}</td><td>${formatCellValue(bal)}</td><td>${formatCellValue(stat)}</td><td>${formatCellValue(notes)}</td></tr>`;
          }).join("")}
        </table>
      </body>
    </html>`;

  const excelBlob = exportSheetAsExcel(ss, sheet);

  MailApp.sendEmail({
    to:          REPORT_EMAIL,
    subject:     "تنبيه نواقص — " + sheet.getName(),
    htmlBody:    htmlBody,
    attachments: [excelBlob]
  });

  // مسح حالة الطلب بعد الإرسال إن لزم (هنا يمسح عمود 16 / P)
  rowsToSend.forEach(r => sheet.getRange(r.row, 16).clearContent());
  clearTriggerCellAndNotify(sheet, "✅ تم إرسال الإيميل بنجاح.");
}

function exportSheetAsExcel(ss, sheet) {
  const url   = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=xlsx&gid=${sheet.getSheetId()}`;
  const token = ScriptApp.getOAuthToken();
  const res   = UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + token } });
  return res.getBlob().setName(sheet.getName() + ".xlsx");
}

function formatCellValue(v) {
  if (v instanceof Date) return `${v.getFullYear()}/${v.getMonth() + 1}/${v.getDate()}`;
  return v ?? "";
}

function clearTriggerCellAndNotify(sheet, msg) {
  sheet.getRange("M2").clearContent();
  SpreadsheetApp.getActive().toast(msg, "الداشبورد", 5);
}

/* ─────────────────────────────────────────────────────────────
   doGet — API للداشبورد (يرجع JSON بكفاءة عالية)
───────────────────────────────────────────────────────────── */
function doGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheets = ss.getSheets().filter(s => s.getName() !== DASHBOARD_SHEET);

    if (dataSheets.length === 0) {
      return jsonResponse({ error: "No data sheets found" });
    }

    // آخر شيت هو التقرير الفعال الفعلي (اليوم)
    const sheet   = dataSheets[dataSheets.length - 1];
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 3) {
      return jsonResponse({ sheetName: sheet.getName(), rows: [] });
    }

    const headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
    const values  = sheet.getRange(3, 1, lastRow - 2, lastCol).getValues();

    const rows = values
      .filter(r => r.some(c => c !== "" && c !== null))
      .map(r => {
        const obj = {};
        headers.forEach((h, i) => {
          if (!h || h === "#NUM!") return;
          obj[h.toString().trim()] = normalizeValue(r[i]);
        });
        return obj;
      });

    return jsonResponse({
      sheetName:   sheet.getName(),
      generatedAt: new Date().toISOString(),
      rowCount:    rows.length,
      rows
    });

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeValue(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, "Africa/Cairo", "yyyy-MM-dd");
  }
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    if (cleaned !== "" && !isNaN(cleaned)) return Number(cleaned);
    return cleaned;
  }
  return v;
}
