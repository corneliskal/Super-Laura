const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const nodemailer = require("nodemailer");
const XLSX = require("xlsx");
const path = require("path");

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// Manual CORS handler — more reliable than cors npm package with Cloud Functions
function handleCors(req, res, handler) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  return handler(req, res);
}

// Verify Firebase Auth token from Authorization header
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  try {
    const token = authHeader.split("Bearer ")[1];
    return await admin.auth().verifyIdToken(token);
  } catch (err) {
    console.warn("Auth token verification failed:", err.message);
    return null;
  }
}

// =============================================================
// Gmail transporter (reused across function invocations)
// =============================================================
let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

// =============================================================
// Constants
// =============================================================
const RECIPIENT_EMAIL = "corneliskalma@gmail.com";
const EMPLOYEE_NAME = "Laura Favata";
const BANK_ACCOUNT = "NL55 RABO 0120787539";
const COMPANY_NAME = "DE UNIE ARCHITECTEN";
const KM_RATE = 0.23;
const DUTCH_MONTHS = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

// =============================================================
// analyzeReceipt — Gemini OCR (existing)
// =============================================================
exports.analyzeReceipt = functions
  .region("europe-west1")
  .https.onRequest((req, res) => {
    handleCors(req, res, async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      try {
        const { image } = req.body;

        if (!image) {
          res.status(400).json({ error: "No image provided" });
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          console.error("Gemini API key not configured. Add GEMINI_API_KEY to functions/.env");
          res.status(500).json({ error: "OCR not configured" });
          return;
        }

        let base64Data = image;
        let mimeType = "image/jpeg";

        if (image.startsWith("data:")) {
          const parts = image.split(",");
          base64Data = parts[1];
          const mimeMatch = parts[0].match(/data:([^;]+)/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `Analyseer deze foto van een bonnetje of factuur. Extract de volgende informatie en geef het terug als JSON:

{
  "store_name": "naam van de winkel of leverancier",
  "amount": "totaal bedrag als nummer (bijv. 12.50)",
  "vat_amount": "BTW bedrag als nummer of null",
  "date": "datum in YYYY-MM-DD formaat",
  "description": "korte omschrijving van de aankoop",
  "category": "een van: Boodschappen, Transport, Kantoorbenodigdheden, Maaltijden, Abonnementen, Overig",
  "raw_text": "alle leesbare tekst op het bonnetje"
}

Regels:
- Bedragen zijn in EUR tenzij anders aangegeven
- Nederlandse datumnotatie (DD-MM-YYYY) omzetten naar YYYY-MM-DD
- Als je iets niet kunt lezen, gebruik null
- Het bedrag moet het TOTAAL bedrag zijn (niet individuele items)
- Kies de meest passende categorie
- Geef ALLEEN de JSON terug, geen andere tekst`;

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
        ]);

        const responseText = result.response.text();
        console.log("Gemini response:", responseText);

        let parsed;
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            parsed = JSON.parse(responseText);
          }
        } catch (parseErr) {
          console.error("Failed to parse Gemini response as JSON:", parseErr);
          res.status(200).json({
            raw_text: responseText,
            confidence: 0.5,
            parsed: null,
          });
          return;
        }

        const normalizedParsed = {
          store_name: parsed.store_name || null,
          amount: parsed.amount ? String(parsed.amount) : null,
          vat_amount: parsed.vat_amount ? String(parsed.vat_amount) : null,
          date: parsed.date || null,
          description: parsed.description || null,
          category: parsed.category || "Overig",
        };

        res.status(200).json({
          raw_text: parsed.raw_text || responseText,
          confidence: 0.9,
          parsed: normalizedParsed,
        });
      } catch (error) {
        console.error("analyzeReceipt error:", error);
        res.status(500).json({
          error: "Processing failed",
          raw_text: "",
          confidence: 0,
          parsed: null,
        });
      }
    });
  });

// =============================================================
// submitReceipts — Email bonnetjes with Excel + photos
// =============================================================
exports.submitReceipts = functions
  .region("europe-west1")
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .https.onRequest((req, res) => {
    handleCors(req, res, async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Verify auth
      const decodedToken = await verifyAuth(req);
      if (!decodedToken) {
        res.status(401).json({ error: "Niet ingelogd" });
        return;
      }
      const userId = decodedToken.uid;

      try {
        const { month, year, recipientEmail: reqRecipientEmail, employeeName: reqEmployeeName } = req.body;
        if (!month || !year) {
          res.status(400).json({ error: "month and year required" });
          return;
        }

        const recipientEmail = reqRecipientEmail || RECIPIENT_EMAIL;
        const employeeName = reqEmployeeName || EMPLOYEE_NAME;

        const monthName = DUTCH_MONTHS[month - 1];
        console.log(`Submitting receipts for ${monthName} ${year}, user: ${userId}, to: ${recipientEmail}`);

        // Fetch unsubmitted receipts for this month, filtered by user
        const receiptsSnap = await db.collection("receipts")
          .where("userId", "==", userId)
          .where("is_submitted", "==", false)
          .get();

        // Filter client-side by month/year (same as frontend does)
        const receipts = [];
        receiptsSnap.forEach((doc) => {
          const data = doc.data();
          const date = new Date(data.receipt_date);
          if (date.getMonth() + 1 === month && date.getFullYear() === year) {
            receipts.push({ id: doc.id, ...data });
          }
        });

        if (receipts.length === 0) {
          res.status(200).json({ success: true, message: "No receipts to submit", count: 0 });
          return;
        }

        // Generate Excel for receipts using official template
        const excelBuffer = generateReceiptsExcel(receipts, month, year, monthName, employeeName, BANK_ACCOUNT);

        // Download photos from Storage
        const photoAttachments = [];
        for (let i = 0; i < receipts.length; i++) {
          const r = receipts[i];
          if (r.photo_path) {
            try {
              const bucket = storage.bucket();
              const file = bucket.file(`receipt-photos/${r.photo_path}`);
              const [buffer] = await file.download();
              const dateStr = (r.receipt_date || "").replace(/-/g, "");
              const store = (r.store_name || "onbekend").replace(/[^a-zA-Z0-9]/g, "_");
              photoAttachments.push({
                filename: `${String(i + 1).padStart(2, "0")}_${store}_${dateStr}.jpg`,
                content: buffer,
              });
            } catch (err) {
              console.warn(`Could not download photo for receipt ${r.id}:`, err.message);
            }
          }
        }

        // Build attachments array
        const attachments = [
          {
            filename: `Bonnetjes_${monthName}_${year}.xlsx`,
            content: Buffer.from(excelBuffer),
          },
          ...photoAttachments,
        ];

        const totalAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);

        // Send email
        const mail = getTransporter();
        await mail.sendMail({
          from: `"Super Laura" <${process.env.GMAIL_EMAIL}>`,
          to: recipientEmail,
          subject: `Bonnetjes ${monthName} ${year} - ${employeeName}`,
          html: `
            <h2>Bonnetjes ${monthName} ${year}</h2>
            <p>Hierbij de bonnetjes van ${monthName} ${year}.</p>
            <table style="border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:4px 12px 4px 0;"><strong>Aantal bonnetjes:</strong></td><td>${receipts.length}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>Totaal bedrag:</strong></td><td>€ ${totalAmount.toFixed(2)}</td></tr>
            </table>
            <p>Bijlagen: Excel overzicht + ${photoAttachments.length} foto('s)</p>
            <p style="color:#888;font-size:12px;">Verstuurd via Super Laura Companion App</p>
          `,
          attachments,
        });

        console.log(`Email sent with ${receipts.length} receipts, ${photoAttachments.length} photos`);

        // Mark receipts as submitted
        const submission = await db.collection("submissions").add({
          userId,
          month,
          year,
          total_amount: totalAmount,
          receipt_count: receipts.length,
          submitted_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        const batch = db.batch();
        for (const r of receipts) {
          batch.update(db.collection("receipts").doc(r.id), {
            is_submitted: true,
            submission_id: submission.id,
          });
        }
        await batch.commit();

        res.status(200).json({
          success: true,
          message: `E-mail verstuurd met ${receipts.length} bonnetjes`,
          count: receipts.length,
          total: totalAmount,
        });
      } catch (error) {
        console.error("submitReceipts error:", error);
        res.status(500).json({ error: "Verzenden mislukt: " + error.message });
      }
    });
  });

// =============================================================
// submitTravel — Email reiskosten with Excel attachment
// =============================================================
exports.submitTravel = functions
  .region("europe-west1")
  .runWith({ timeoutSeconds: 60, memory: "256MB" })
  .https.onRequest((req, res) => {
    handleCors(req, res, async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Verify auth
      const decodedToken = await verifyAuth(req);
      if (!decodedToken) {
        res.status(401).json({ error: "Niet ingelogd" });
        return;
      }
      const userId = decodedToken.uid;

      try {
        const { month, year, recipientEmail: reqRecipientEmail, employeeName: reqEmployeeName } = req.body;
        if (!month || !year) {
          res.status(400).json({ error: "month and year required" });
          return;
        }

        const recipientEmail = reqRecipientEmail || RECIPIENT_EMAIL;
        const employeeName = reqEmployeeName || EMPLOYEE_NAME;

        const monthName = DUTCH_MONTHS[month - 1];
        console.log(`Submitting travel expenses for ${monthName} ${year}, user: ${userId}, to: ${recipientEmail}`);

        // Fetch unsubmitted travel expenses for this month, filtered by user
        const expensesSnap = await db.collection("travel_expenses")
          .where("userId", "==", userId)
          .where("is_submitted", "==", false)
          .get();

        const expenses = [];
        expensesSnap.forEach((doc) => {
          const data = doc.data();
          const date = new Date(data.date);
          if (date.getMonth() + 1 === month && date.getFullYear() === year) {
            expenses.push({ id: doc.id, ...data });
          }
        });

        if (expenses.length === 0) {
          res.status(200).json({ success: true, message: "No travel expenses to submit", count: 0 });
          return;
        }

        // Generate DE UNIE template Excel
        const excelBuffer = generateTravelExcel(expenses, month, year, monthName, employeeName);

        const totalKm = expenses.reduce((sum, e) => sum + (e.kilometers || 0), 0);
        const totalReimbursement = expenses.reduce((sum, e) => sum + (e.total_reimbursement || 0), 0);

        // Send email
        const mail = getTransporter();
        await mail.sendMail({
          from: `"Super Laura" <${process.env.GMAIL_EMAIL}>`,
          to: recipientEmail,
          subject: `Declaratie reiskosten ${monthName} ${year} - ${employeeName}`,
          html: `
            <h2>Declaratie reiskosten ${monthName} ${year}</h2>
            <p>Hierbij de declaratie reiskosten van ${monthName} ${year}.</p>
            <table style="border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:4px 12px 4px 0;"><strong>Aantal declaraties:</strong></td><td>${expenses.length}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>Totaal kilometers:</strong></td><td>${totalKm} km</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>Totale vergoeding:</strong></td><td>€ ${totalReimbursement.toFixed(2)}</td></tr>
            </table>
            <p>Het declaratieformulier (DE UNIE template) is bijgevoegd als Excel-bestand.</p>
            <p style="color:#888;font-size:12px;">Verstuurd via Super Laura Companion App</p>
          `,
          attachments: [
            {
              filename: `Declaratie_${monthName}_${year}.xlsx`,
              content: Buffer.from(excelBuffer),
            },
          ],
        });

        console.log(`Travel email sent: ${expenses.length} expenses, ${totalKm} km, €${totalReimbursement.toFixed(2)}`);

        // Mark as submitted
        const submission = await db.collection("travel_submissions").add({
          userId,
          month,
          year,
          total_amount: totalReimbursement,
          expense_count: expenses.length,
          total_km: totalKm,
          submitted_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        const batch = db.batch();
        for (const e of expenses) {
          batch.update(db.collection("travel_expenses").doc(e.id), {
            is_submitted: true,
            submission_id: submission.id,
          });
        }
        await batch.commit();

        res.status(200).json({
          success: true,
          message: `E-mail verstuurd met ${expenses.length} reisdeclaraties`,
          count: expenses.length,
          totalKm,
          totalReimbursement,
        });
      } catch (error) {
        console.error("submitTravel error:", error);
        res.status(500).json({ error: "Verzenden mislukt: " + error.message });
      }
    });
  });

// =============================================================
// Helper: Shift cells down in a worksheet by a number of rows
// Moves all cells from startRow onwards down by shiftAmount rows
// =============================================================
function shiftRowsDown(ws, startRow, shiftAmount, maxCol) {
  if (shiftAmount <= 0) return;

  // Find the actual last row in the sheet
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const lastRow = range.e.r;

  // Work from bottom up to avoid overwriting
  for (let r = lastRow; r >= startRow; r--) {
    for (let c = 0; c <= maxCol; c++) {
      const srcAddr = XLSX.utils.encode_cell({ r, c });
      const dstAddr = XLSX.utils.encode_cell({ r: r + shiftAmount, c });
      if (ws[srcAddr]) {
        ws[dstAddr] = ws[srcAddr];
        delete ws[srcAddr];
      }
    }
  }

  // Update merges
  if (ws["!merges"]) {
    ws["!merges"] = ws["!merges"].map((merge) => {
      if (merge.s.r >= startRow) {
        return {
          s: { r: merge.s.r + shiftAmount, c: merge.s.c },
          e: { r: merge.e.r + shiftAmount, c: merge.e.c },
        };
      }
      return merge;
    });
  }

  // Update sheet range
  range.e.r = Math.max(range.e.r, lastRow + shiftAmount);
  ws["!ref"] = XLSX.utils.encode_range(range);
}

// =============================================================
// Helper: Format a date string "YYYY-MM-DD" as "D maand"
// =============================================================
function formatDateDutch(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const monthIdx = parseInt(parts[1]) - 1;
  return `${parseInt(parts[2])} ${DUTCH_MONTHS[monthIdx].toLowerCase()}`;
}

// =============================================================
// Helper: Generate receipts Excel using official template
// =============================================================
function generateReceiptsExcel(receipts, month, year, monthName, employeeName, bankAccount) {
  const templatePath = path.join(__dirname, "templates", "bonnetjes-template.xlsx");
  const wb = XLSX.readFile(templatePath);
  const ws = wb.Sheets["Blad1"];

  const sorted = [...receipts].sort(
    (a, b) => new Date(a.receipt_date).getTime() - new Date(b.receipt_date).getTime()
  );

  // Template layout:
  // Row 3 (idx 2): medewerker info (cell A3)
  // Row 4 (idx 3): bank info (cell A4)
  // Row 5 (idx 4): datum (cell A5)
  // Rows 7-8: column headers (datum | omschrijving | totale vergoeding)
  // Row 11-38 (idx 10-37): data rows (28 slots)
  // Row 40 (idx 39): Subtotalen with SUM formula in C40
  // Row 41 (idx 40): Af: evt. voorschot
  // Row 42 (idx 41): TOTAAL
  // Row 44+: handtekening, toelichting

  const DATA_START_ROW = 10;   // 0-indexed row 10 = Excel row 11
  const TEMPLATE_DATA_SLOTS = 28;  // rows 11-38
  const SUMMARY_START_ROW = 39; // 0-indexed row 39 = Excel row 40

  // Calculate extra rows needed
  const extraRows = Math.max(0, sorted.length - TEMPLATE_DATA_SLOTS);

  // If we need more rows, shift the summary/footer section down
  if (extraRows > 0) {
    shiftRowsDown(ws, SUMMARY_START_ROW, extraRows, 9); // maxCol = J (index 9)
  }

  const now = new Date();
  const todayStr = `${now.getDate()} ${DUTCH_MONTHS[now.getMonth()].toLowerCase()} ${now.getFullYear()}`;

  // Fill header info
  ws["A3"] = { t: "s", v: `medewerker: ${employeeName}` };
  ws["A4"] = { t: "s", v: `bank/giro nummer: Privé rekening- ${bankAccount}` };
  ws["A5"] = { t: "s", v: `datum: ${todayStr}` };

  // Fill data rows
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const row = DATA_START_ROW + i; // 0-indexed

    const dateFormatted = formatDateDutch(r.receipt_date);
    const description = [r.store_name, r.description].filter(Boolean).join(" - ");

    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { t: "s", v: dateFormatted };
    ws[XLSX.utils.encode_cell({ r: row, c: 1 })] = { t: "s", v: description };
    ws[XLSX.utils.encode_cell({ r: row, c: 2 })] = { t: "n", v: r.amount || 0 };
  }

  // Update summary formulas (they may have shifted)
  const summaryRow = SUMMARY_START_ROW + extraRows; // 0-indexed
  const lastDataRow = DATA_START_ROW + Math.max(sorted.length, TEMPLATE_DATA_SLOTS); // end of data range
  const sumRange = `C10:C${lastDataRow}`; // 1-indexed in formula

  const sAddr = XLSX.utils.encode_cell({ r: summaryRow, c: 2 }); // C column
  ws[sAddr] = { t: "n", v: 0, f: `SUM(${sumRange})` };

  // "Af: evt. voorschot" row
  const advAddr = XLSX.utils.encode_cell({ r: summaryRow + 1, c: 2 });
  ws[advAddr] = { t: "n", v: 0 };

  // TOTAAL row
  const totRow = summaryRow + 2;
  const subtotalCell = XLSX.utils.encode_cell({ r: summaryRow, c: 2 });
  const advanceCell = XLSX.utils.encode_cell({ r: summaryRow + 1, c: 2 });
  const totAddr = XLSX.utils.encode_cell({ r: totRow, c: 2 });
  // Formula references using cell names (1-indexed)
  const subtotalRef = `C${summaryRow + 1}`;
  const advanceRef = `C${summaryRow + 2}`;
  ws[totAddr] = { t: "n", v: 0, f: `${subtotalRef}-${advanceRef}` };

  // Update sheet range to cover all data
  const ref = XLSX.utils.decode_range(ws["!ref"]);
  ref.e.r = Math.max(ref.e.r, totRow + 20); // ensure footer rows are included
  ws["!ref"] = XLSX.utils.encode_range(ref);

  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

// =============================================================
// Helper: Generate DE UNIE travel Excel using official template
// =============================================================
function generateTravelExcel(expenses, month, year, monthName, employeeName = EMPLOYEE_NAME) {
  const templatePath = path.join(__dirname, "templates", "reiskosten-template.xlsx");
  const wb = XLSX.readFile(templatePath);
  const ws = wb.Sheets["Blad1"];

  const sorted = [...expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Template layout (0-indexed):
  // Row 1 (idx 0): DE UNIE declaratieformulier (merged A1:I1)
  // Row 3 (idx 2): medewerker: | [B3 = name]
  // Row 4 (idx 3): bank/giro nummer: | [B4 = bank]
  // Row 5 (idx 4): datum: | [B5 = date]
  // Rows 7-9 (idx 6-8): column headers
  // Rows 11-14 (idx 10-13): data rows (4 template slots)
  // Row 16 (idx 15): Subtotalen with SUM formulas
  // Row 17 (idx 16): Af: evt. voorschot
  // Row 18 (idx 17): TOTAAL
  // Row 20 (idx 19): handtekening
  // Row 26+ (idx 25+): Toelichting

  const DATA_START_ROW = 10;   // 0-indexed row 10 = Excel row 11
  const TEMPLATE_DATA_SLOTS = 4;   // rows 11-14
  const SUMMARY_START_ROW = 15; // 0-indexed row 15 = Excel row 16

  // Calculate extra rows needed
  const extraRows = Math.max(0, sorted.length - TEMPLATE_DATA_SLOTS);

  // If we need more rows, shift the summary/footer section down
  if (extraRows > 0) {
    shiftRowsDown(ws, SUMMARY_START_ROW, extraRows, 15); // maxCol = P (index 15)
  }

  const now = new Date();
  const todayStr = `${now.getDate()} ${DUTCH_MONTHS[now.getMonth()].toLowerCase()} ${now.getFullYear()}`;

  // Fill header info
  ws["B3"] = { t: "s", v: employeeName };
  ws["B4"] = { t: "s", v: BANK_ACCOUNT };
  ws["B5"] = { t: "s", v: todayStr };

  // Fill data rows
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const row = DATA_START_ROW + i; // 0-indexed

    const dateFormatted = formatDateDutch(e.date);

    // A = datum
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { t: "s", v: dateFormatted };
    // B = projectnr.
    if (e.project_code) ws[XLSX.utils.encode_cell({ r: row, c: 1 })] = { t: "s", v: e.project_code };
    // C = projectnaam
    if (e.project_name) ws[XLSX.utils.encode_cell({ r: row, c: 2 })] = { t: "s", v: e.project_name };
    // D = omschrijving (kan leeg zijn)
    if (e.description) ws[XLSX.utils.encode_cell({ r: row, c: 3 })] = { t: "s", v: e.description };
    // E = reiskosten OV
    if (e.travel_cost) ws[XLSX.utils.encode_cell({ r: row, c: 4 })] = { t: "n", v: e.travel_cost };
    // F = km's
    if (e.kilometers) ws[XLSX.utils.encode_cell({ r: row, c: 5 })] = { t: "n", v: e.kilometers };
    // G = km vergoeding (formula: F*0.23)
    const excelRow = row + 1; // 1-indexed for formulas
    ws[XLSX.utils.encode_cell({ r: row, c: 6 })] = { t: "n", v: (e.kilometers || 0) * KM_RATE, f: `F${excelRow}*0.23` };
    // H = overige onkosten (leeg)
    // I = totale vergoeding (formula: SUM(E,G,H))
    ws[XLSX.utils.encode_cell({ r: row, c: 8 })] = {
      t: "n",
      v: (e.travel_cost || 0) + ((e.kilometers || 0) * KM_RATE),
      f: `SUM(E${excelRow},G${excelRow},H${excelRow})`,
    };
  }

  // Update summary formulas (shifted by extraRows)
  const summaryRow = SUMMARY_START_ROW + extraRows; // 0-indexed
  const lastDataExcelRow = DATA_START_ROW + Math.max(sorted.length, TEMPLATE_DATA_SLOTS); // 0-indexed end
  const lastDataRef = lastDataExcelRow; // for formula range (1-indexed = lastDataExcelRow + 1, but we use the max slot)
  const dataEndRef = DATA_START_ROW + Math.max(sorted.length - 1, TEMPLATE_DATA_SLOTS - 1) + 1; // 1-indexed last data row

  // Subtotalen row formulas
  const sumRowRef = summaryRow + 1; // 1-indexed
  // E = SUM of OV costs
  ws[XLSX.utils.encode_cell({ r: summaryRow, c: 4 })] = { t: "n", v: 0, f: `SUM(E11:E${dataEndRef})` };
  // F = SUM of km's
  ws[XLSX.utils.encode_cell({ r: summaryRow, c: 5 })] = { t: "n", v: 0, f: `SUM(F11:F${dataEndRef})` };
  // G = SUM of km vergoeding
  ws[XLSX.utils.encode_cell({ r: summaryRow, c: 6 })] = { t: "n", v: 0, f: `SUM(G11:G${dataEndRef})` };
  // H = SUM of overige onkosten
  ws[XLSX.utils.encode_cell({ r: summaryRow, c: 7 })] = { t: "n", v: 0, f: `SUM(H11:H${dataEndRef})` };
  // I = SUM of totale vergoeding
  ws[XLSX.utils.encode_cell({ r: summaryRow, c: 8 })] = { t: "n", v: 0, f: `SUM(I11:I${dataEndRef})` };

  // "Af: evt. voorschot" row
  const advRow = summaryRow + 1;
  ws[XLSX.utils.encode_cell({ r: advRow, c: 8 })] = { t: "n", v: 0 };

  // TOTAAL row
  const totRow = summaryRow + 2;
  ws[XLSX.utils.encode_cell({ r: totRow, c: 8 })] = {
    t: "n", v: 0,
    f: `I${summaryRow + 1}-I${advRow + 1}`,
  };

  // Update sheet range
  const ref = XLSX.utils.decode_range(ws["!ref"]);
  ref.e.r = Math.max(ref.e.r, totRow + 20);
  ws["!ref"] = XLSX.utils.encode_range(ref);

  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}
