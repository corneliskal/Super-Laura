const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const nodemailer = require("nodemailer");
const XLSX = require("xlsx");

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

      try {
        const { month, year } = req.body;
        if (!month || !year) {
          res.status(400).json({ error: "month and year required" });
          return;
        }

        const monthName = DUTCH_MONTHS[month - 1];
        console.log(`Submitting receipts for ${monthName} ${year}`);

        // Fetch unsubmitted receipts for this month
        const receiptsSnap = await db.collection("receipts")
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

        // Generate Excel for receipts
        const excelBuffer = generateReceiptsExcel(receipts, month, year, monthName);

        // Download photos from Storage
        const photoAttachments = [];
        for (let i = 0; i < receipts.length; i++) {
          const r = receipts[i];
          if (r.photo_path) {
            try {
              const bucket = storage.bucket();
              const file = bucket.file(r.photo_path);
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
          to: RECIPIENT_EMAIL,
          subject: `Bonnetjes ${monthName} ${year} - Laura`,
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

      try {
        const { month, year } = req.body;
        if (!month || !year) {
          res.status(400).json({ error: "month and year required" });
          return;
        }

        const monthName = DUTCH_MONTHS[month - 1];
        console.log(`Submitting travel expenses for ${monthName} ${year}`);

        // Fetch unsubmitted travel expenses for this month
        const expensesSnap = await db.collection("travel_expenses")
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
        const excelBuffer = generateTravelExcel(expenses, month, year, monthName);

        const totalKm = expenses.reduce((sum, e) => sum + (e.kilometers || 0), 0);
        const totalReimbursement = expenses.reduce((sum, e) => sum + (e.total_reimbursement || 0), 0);

        // Send email
        const mail = getTransporter();
        await mail.sendMail({
          from: `"Super Laura" <${process.env.GMAIL_EMAIL}>`,
          to: RECIPIENT_EMAIL,
          subject: `Declaratie reiskosten ${monthName} ${year} - ${EMPLOYEE_NAME}`,
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
// Helper: Generate receipts Excel (server-side)
// =============================================================
function generateReceiptsExcel(receipts, month, year, monthName) {
  const sorted = [...receipts].sort(
    (a, b) => new Date(a.receipt_date).getTime() - new Date(b.receipt_date).getTime()
  );

  const wsData = [
    ["Bonnetjes overzicht", monthName, year],
    [],
    ["Datum", "Winkel", "Omschrijving", "Categorie", "Bedrag", "BTW"],
  ];

  for (const r of sorted) {
    wsData.push([
      r.receipt_date || "",
      r.store_name || "",
      r.description || "",
      r.category || "",
      r.amount || 0,
      r.vat_amount || 0,
    ]);
  }

  wsData.push([]);
  const total = sorted.reduce((sum, r) => sum + (r.amount || 0), 0);
  wsData.push([null, null, null, "TOTAAL", total]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Bonnetjes ${monthName} ${year}`);
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

// =============================================================
// Helper: Generate DE UNIE travel Excel (server-side)
// =============================================================
function generateTravelExcel(expenses, month, year, monthName) {
  const sorted = [...expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const totalKm = sorted.reduce((sum, e) => sum + (e.kilometers || 0), 0);
  const totalKmReimbursement = sorted.reduce((sum, e) => sum + (e.km_reimbursement || 0), 0);
  const totalTravelCost = sorted.reduce((sum, e) => sum + (e.travel_cost || 0), 0);
  const totalReimbursement = sorted.reduce((sum, e) => sum + (e.total_reimbursement || 0), 0);

  const wsData = [];

  // Title
  wsData.push([`${COMPANY_NAME} declaratieformulier`, null, null, null, null, null, null, null, null]);
  wsData.push([]);

  // Employee info
  wsData.push(["medewerker:", EMPLOYEE_NAME]);
  wsData.push(["bank/giro nummer:", BANK_ACCOUNT]);
  wsData.push(["datum:", `${new Date().getDate()} ${monthName.toLowerCase()} ${year}`]);
  wsData.push([]);

  // Column headers
  wsData.push([
    "datum", "projectnr.", "projectnaam", "omschrijving",
    "reiskosten\nOV", null, "km's",
    `km vergoeding\nbelastingvrij\nx € ${KM_RATE.toFixed(2)}`,
    "overige\nonkosten", null, "totale\nvergoeding",
  ]);
  wsData.push([]);

  // Data rows
  for (const e of sorted) {
    const dateParts = (e.date || "").split("-");
    let dateFormatted = e.date || "";
    if (dateParts.length === 3) {
      const m = parseInt(dateParts[1]) - 1;
      dateFormatted = `${parseInt(dateParts[2])} ${DUTCH_MONTHS[m].toLowerCase()}`;
    }

    wsData.push([
      dateFormatted,
      e.project_code || "",
      e.project_name || "",
      e.description || "",
      e.travel_cost || null,
      null,
      e.kilometers || null,
      e.km_reimbursement || null,
      null,
      null,
      e.total_reimbursement || 0,
    ]);
  }

  wsData.push([]);

  // Subtotals
  wsData.push([
    null, null, null, "Subtotalen",
    totalTravelCost || null, "€", totalKm,
    `€ ${totalKmReimbursement.toFixed(2)}`,
    null, "€", totalReimbursement,
  ]);
  wsData.push([null, null, null, "Af: evt. voorschot", null, null, null, null, null, "€", null]);
  wsData.push([null, null, null, "TOTAAL", null, null, null, null, null, "€", totalReimbursement]);

  wsData.push([]);
  wsData.push([]);

  // Signature
  wsData.push(["handtekening werknemer:", null, null, null, null, "handtekening werkgever:"]);
  wsData.push([]);
  wsData.push([]);
  wsData.push([]);

  // Toelichting
  wsData.push(["Toelichting"]);
  wsData.push(["Interne declaratie voor vergoeding van reiskosten gemaakt in opdracht en tijdens werktijd en overige declaraties. Declaraties kunnen worden ingeleverd bij de directie"]);
  wsData.push(["De vergoedingen worden op basis van de declaraties met het salaris uitbetaald."]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 24 },
    { wch: 12 }, { wch: 3 }, { wch: 8 }, { wch: 14 },
    { wch: 10 }, { wch: 3 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Declaratie ${monthName} ${year}`);
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}
