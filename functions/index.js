const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

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
// Helper to get config from process.env or functions.config()
// =============================================================
function getConfig(key) {
  // First try process.env (for local .env files)
  if (process.env[key]) {
    return process.env[key];
  }
  // Then try functions.config() (for deployed functions)
  const config = functions.config();
  const parts = key.toLowerCase().split('_');
  if (parts.length === 2) {
    const [section, name] = parts;
    return config[section]?.[name];
  }
  return null;
}

// =============================================================
// Email transporter (Strato SMTP with Gmail fallback)
// =============================================================
let transporter = null;
function getTransporter() {
  if (!transporter) {
    // Check if Strato SMTP is configured, otherwise fall back to Gmail
    const smtpHost = getConfig('SMTP_HOST');
    const smtpUser = getConfig('SMTP_USER');
    const useStrato = smtpHost && smtpUser;

    if (useStrato) {
      console.log("Using Strato SMTP:", smtpHost, smtpUser);
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(getConfig('SMTP_PORT') || "587"),
        secure: getConfig('SMTP_SECURE') === "true", // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: getConfig('SMTP_PASS'),
        },
      });
    } else {
      console.log("Using Gmail SMTP (fallback)");
      // Fallback to Gmail
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: getConfig('GMAIL_EMAIL') || process.env.GMAIL_EMAIL,
          pass: getConfig('GMAIL_APP_PASSWORD') || process.env.GMAIL_APP_PASSWORD,
        },
      });
    }
  }
  return transporter;
}

// =============================================================
// Get web app URL from environment or fallback to production
// =============================================================
function getWebAppUrl(path = '') {
  const baseUrl = getConfig('WEBAPP_URL') || process.env.WEBAPP_URL || 'https://super-laura-fb40a.web.app';
  return path ? `${baseUrl}${path}` : baseUrl;
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

        const prompt = `Analyseer deze foto of PDF van een bonnetje, factuur of declaratie. Extract de volgende informatie en geef het terug als JSON:

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
// sendVerificationEmail — Send custom verification email via Gmail
// =============================================================
exports.sendVerificationEmail = functions
  .region("europe-west1")
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
      const userEmail = decodedToken.email;

      try {
        // Generate random verification token
        const token = require("crypto").randomBytes(32).toString("hex");

        // Store token in Firestore with 24h expiry
        await db.collection("email_verifications").doc(userId).set({
          token: token,
          email: userEmail,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
          verified: false,
        });

        // Build verification URL
        const verifyUrl = `https://europe-west1-super-laura-fb40a.cloudfunctions.net/verifyEmail?token=${token}&uid=${userId}`;

        // Send email via Gmail
        const mail = getTransporter();
        await mail.sendMail({
          from: `"${getConfig('FROM_NAME') || 'De Unie Companion App'}" <${getConfig('FROM_EMAIL') || getConfig('GMAIL_EMAIL') || 'corneliskalma@gmail.com'}>`,
          to: userEmail,
          subject: "Bevestig je e-mailadres - De Unie Companion App",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7c3aed;">Bevestig je e-mailadres</h2>
              <p>Welkom bij De Unie Companion App!</p>
              <p>Klik op de knop hieronder om je e-mailadres te bevestigen:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" style="background-color: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                  Bevestig e-mailadres
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">Of kopieer deze link in je browser:</p>
              <p style="color: #666; font-size: 12px; word-break: break-all;">${verifyUrl}</p>
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                Deze link is 24 uur geldig. Als je geen account hebt aangemaakt, kun je deze e-mail negeren.
              </p>
            </div>
          `,
        });

        console.log(`Verification email sent to ${userEmail} for user ${userId}`);

        res.status(200).json({
          success: true,
          message: "Verificatie-e-mail verstuurd",
        });
      } catch (error) {
        console.error("sendVerificationEmail error:", error);
        res.status(500).json({ error: "Kon e-mail niet versturen: " + error.message });
      }
    });
  });

// =============================================================
// verifyEmail — Verify email token and redirect
// =============================================================
exports.verifyEmail = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    const token = req.query.token;
    const uid = req.query.uid;

    if (!token || !uid) {
      res.status(400).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>❌ Ongeldige verificatielink</h2>
            <p>Deze link is niet geldig.</p>
          </body>
        </html>
      `);
      return;
    }

    try {
      // Get verification doc
      const doc = await db.collection("email_verifications").doc(uid).get();

      if (!doc.exists) {
        res.status(404).send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h2>❌ Verificatielink niet gevonden</h2>
              <p>Deze verificatielink bestaat niet.</p>
            </body>
          </html>
        `);
        return;
      }

      const data = doc.data();

      // Check if already verified
      if (data.verified) {
        res.status(200).send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h2>✅ Al geverifieerd</h2>
              <p>Je e-mailadres is al eerder geverifieerd.</p>
              <p><a href="${getWebAppUrl()}" style="color: #7c3aed;">Ga naar de app →</a></p>
            </body>
          </html>
        `);
        return;
      }

      // Check if token matches
      if (data.token !== token) {
        res.status(403).send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h2>❌ Ongeldige token</h2>
              <p>Deze verificatielink is niet geldig.</p>
            </body>
          </html>
        `);
        return;
      }

      // Check if expired
      const now = admin.firestore.Timestamp.now();
      if (now.toMillis() > data.expiresAt.toMillis()) {
        res.status(410).send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h2>⏰ Link verlopen</h2>
              <p>Deze verificatielink is verlopen. Vraag een nieuwe aan in de app.</p>
              <p><a href="${getWebAppUrl('/verify-email')}" style="color: #7c3aed;">Naar verificatiepagina →</a></p>
            </body>
          </html>
        `);
        return;
      }

      // Mark as verified
      await db.collection("email_verifications").doc(uid).update({
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Email verified for user ${uid}`);

      // Success page with redirect
      res.status(200).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2 style="color: #10b981;">✅ E-mail geverifieerd!</h2>
            <p>Je e-mailadres is succesvol bevestigd.</p>
            <p>Je wordt doorgestuurd naar de app...</p>
            <script>
              setTimeout(function() {
                window.location.href = '${getWebAppUrl()}';
              }, 3000);
            </script>
            <p><a href="${getWebAppUrl()}" style="color: #7c3aed;">Klik hier als je niet automatisch wordt doorgestuurd →</a></p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("verifyEmail error:", error);
      res.status(500).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>❌ Fout opgetreden</h2>
            <p>Er ging iets mis bij het verifiëren van je e-mail.</p>
            <p>${error.message}</p>
          </body>
        </html>
      `);
    }
  });

// =============================================================
// submitReceipts — Email bonnetjes with PDF + photos
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
        const { month, year, recipientEmail: reqRecipientEmail, employeeName: reqEmployeeName, bankAccount: reqBankAccount } = req.body;
        if (!month || !year) {
          res.status(400).json({ error: "month and year required" });
          return;
        }

        const recipientEmail = reqRecipientEmail || RECIPIENT_EMAIL;
        const employeeName = reqEmployeeName || EMPLOYEE_NAME;
        const bankAccount = reqBankAccount || BANK_ACCOUNT;

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

        // Generate PDF for receipts using DE UNIE template layout
        const pdfBuffer = await generateReceiptsPdf(receipts, month, year, monthName, employeeName, bankAccount);

        // Download photos/PDFs from Storage
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
              const isPdf = r.file_type === 'pdf' || r.photo_path.endsWith('.pdf');
              const ext = isPdf ? 'pdf' : 'jpg';
              photoAttachments.push({
                filename: `${String(i + 1).padStart(2, "0")}_${store}_${dateStr}.${ext}`,
                content: buffer,
              });
            } catch (err) {
              console.warn(`Could not download file for receipt ${r.id}:`, err.message);
            }
          }
        }

        // Build attachments array
        const attachments = [
          {
            filename: `Bonnetjes_${monthName}_${year}.pdf`,
            content: pdfBuffer,
          },
          ...photoAttachments,
        ];

        const totalAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);

        // Send email
        const mail = getTransporter();
        await mail.sendMail({
          from: `"${getConfig('FROM_NAME') || 'De Unie'}" <${getConfig('FROM_EMAIL') || getConfig('GMAIL_EMAIL') || 'corneliskalma@gmail.com'}>`,
          to: recipientEmail,
          cc: decodedToken.email, // User krijgt altijd een kopie
          subject: `Bonnetjes ${monthName} ${year} - ${employeeName}`,
          html: `
            <h2>Bonnetjes ${monthName} ${year}</h2>
            <p>Hierbij de bonnetjes van ${monthName} ${year}.</p>
            <table style="border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:4px 12px 4px 0;"><strong>Aantal bonnetjes:</strong></td><td>${receipts.length}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>Totaal bedrag:</strong></td><td>€ ${totalAmount.toFixed(2)}</td></tr>
            </table>
            <p>Bijlagen: PDF overzicht + ${photoAttachments.length} bestand(en)</p>
            <p style="color:#888;font-size:12px;">Verstuurd via De Unie Companion App</p>
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
// submitTravel — Email reiskosten with PDF attachment
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
        const { month, year, recipientEmail: reqRecipientEmail, employeeName: reqEmployeeName, bankAccount: reqBankAccount } = req.body;
        if (!month || !year) {
          res.status(400).json({ error: "month and year required" });
          return;
        }

        const recipientEmail = reqRecipientEmail || RECIPIENT_EMAIL;
        const employeeName = reqEmployeeName || EMPLOYEE_NAME;
        const bankAccount = reqBankAccount || BANK_ACCOUNT;

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

        // Generate DE UNIE template PDF
        const pdfBuffer = await generateTravelPdf(expenses, month, year, monthName, employeeName, bankAccount);

        const totalKm = expenses.reduce((sum, e) => sum + (e.kilometers || 0), 0);
        const totalReimbursement = expenses.reduce((sum, e) => sum + (e.total_reimbursement || 0), 0);

        // Send email
        const mail = getTransporter();
        await mail.sendMail({
          from: `"${getConfig('FROM_NAME') || 'De Unie'}" <${getConfig('FROM_EMAIL') || getConfig('GMAIL_EMAIL') || 'corneliskalma@gmail.com'}>`,
          to: recipientEmail,
          cc: decodedToken.email, // User krijgt altijd een kopie
          subject: `Declaratie reiskosten ${monthName} ${year} - ${employeeName}`,
          html: `
            <h2>Declaratie reiskosten ${monthName} ${year}</h2>
            <p>Hierbij de declaratie reiskosten van ${monthName} ${year}.</p>
            <table style="border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:4px 12px 4px 0;"><strong>Aantal declaraties:</strong></td><td>${expenses.length}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>Totaal kilometers:</strong></td><td>${totalKm} km</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>Totale vergoeding:</strong></td><td>€ ${totalReimbursement.toFixed(2)}</td></tr>
            </table>
            <p>Het declaratieformulier (DE UNIE template) is bijgevoegd als PDF-bestand.</p>
            <p style="color:#888;font-size:12px;">Verstuurd via De Unie Companion App</p>
          `,
          attachments: [
            {
              filename: `Declaratie_${monthName}_${year}.pdf`,
              content: pdfBuffer,
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
// generateAvatar — Gemini image generation for superhero avatar
// =============================================================
exports.generateAvatar = functions
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
        const { faceImage, superhero } = req.body;

        if (!faceImage || !superhero) {
          res.status(400).json({ error: "faceImage and superhero are required" });
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          res.status(500).json({ error: "Gemini API key not configured" });
          return;
        }

        console.log(`Generating avatar for user ${userId}, superhero: ${superhero}`);

        // Parse base64 image
        let base64Data = faceImage;
        let mimeType = "image/jpeg";
        if (faceImage.startsWith("data:")) {
          const imgParts = faceImage.split(",");
          base64Data = imgParts[1];
          const mimeMatch = imgParts[0].match(/data:([^;]+)/);
          if (mimeMatch) mimeType = mimeMatch[1];
        }

        // Use new @google/genai SDK for image generation
        const { GoogleGenAI } = require("@google/genai");
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `Create a fun cartoon superhero character portrait in comic-book style.
The character is inspired by ${superhero} — wearing a similar costume, colors, and iconic style elements.
Look at the reference photo to match the person's general appearance traits like hair color, hair style, skin tone, and face shape, then draw the character in a friendly cartoon style.
Requirements:
- Square format, 1:1 aspect ratio
- Head and shoulders portrait only
- Simple solid color or gradient background
- Vibrant colors, bold outlines, comic-book aesthetic
- Friendly, heroic, and approachable expression
- Suitable as a small app icon/avatar (clear at 128x128 pixels)
- Fun and family-friendly`;

        // Helper to attempt generation (with or without face photo)
        async function attemptGeneration(includePhoto) {
          const contents = includePhoto
            ? [
                { text: prompt },
                { inlineData: { mimeType: mimeType, data: base64Data } },
              ]
            : prompt;

          console.log(`Attempting avatar generation ${includePhoto ? "WITH" : "WITHOUT"} face photo`);

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: contents,
            config: {
              responseModalities: ["Text", "Image"],
            },
          });

          // Log response structure for debugging
          console.log("Response keys:", Object.keys(response || {}));
          if (response.candidates) {
            console.log("Candidates count:", response.candidates.length);
            for (let ci = 0; ci < response.candidates.length; ci++) {
              const c = response.candidates[ci];
              console.log(`Candidate[${ci}] finishReason:`, c.finishReason);
              console.log(`Candidate[${ci}] has content:`, !!c.content);
              if (c.safetyRatings) {
                console.log(`Candidate[${ci}] safetyRatings:`, JSON.stringify(c.safetyRatings));
              }
              if (c.content && c.content.parts) {
                console.log(`Candidate[${ci}] parts count:`, c.content.parts.length);
                c.content.parts.forEach((p, pi) => {
                  console.log(`  Part[${pi}]: text=${!!p.text}, inlineData=${p.inlineData ? p.inlineData.mimeType : "none"}`);
                });
              }
            }
          } else {
            console.log("No candidates in response");
            if (response.promptFeedback) {
              console.log("promptFeedback:", JSON.stringify(response.promptFeedback));
            }
          }

          return response;
        }

        // Try with face photo first
        let response = await attemptGeneration(true);

        // Check if we got a valid response with image content
        let imagePart = null;
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];
          if (candidate.content && candidate.content.parts) {
            imagePart = candidate.content.parts.find(
              (p) => p.inlineData && p.inlineData.mimeType && p.inlineData.mimeType.startsWith("image/")
            );
          } else {
            console.warn("Candidate has no content/parts (possible safety block). finishReason:", candidate.finishReason);
          }
        }

        // FALLBACK: If no image from first attempt, try without face photo
        if (!imagePart) {
          console.log("First attempt failed to produce image. Trying fallback without face photo...");
          response = await attemptGeneration(false);

          if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts) {
              imagePart = candidate.content.parts.find(
                (p) => p.inlineData && p.inlineData.mimeType && p.inlineData.mimeType.startsWith("image/")
              );
            }
          }
        }

        if (!imagePart) {
          console.error("Both attempts failed to produce an image");
          res.status(500).json({ error: "Avatar generatie mislukt - Gemini kon geen afbeelding genereren. Probeer het later opnieuw." });
          return;
        }

        console.log(`Avatar generated, mimeType: ${imagePart.inlineData.mimeType}, data length: ${imagePart.inlineData.data.length} chars`);

        // Upload to Firebase Storage
        const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
        const bucket = storage.bucket();
        const avatarFile = bucket.file(`avatars/${userId}.png`);

        await avatarFile.save(imageBuffer, {
          metadata: {
            contentType: imagePart.inlineData.mimeType || "image/png",
            metadata: {
              superhero: superhero,
              generatedAt: new Date().toISOString(),
            },
          },
        });

        // Make the file publicly readable
        await avatarFile.makePublic();

        // Get public URL (add cache-buster to avoid stale cache)
        const avatarUrl = `https://storage.googleapis.com/${bucket.name}/avatars/${userId}.png?t=${Date.now()}`;

        // Save avatar URL in user settings
        await db.collection("users").doc(userId).collection("settings").doc("profile").set(
          { avatarUrl: avatarUrl },
          { merge: true }
        );

        console.log(`Avatar saved for user ${userId}: ${avatarUrl}`);

        res.status(200).json({
          success: true,
          avatarUrl: avatarUrl,
        });
      } catch (error) {
        console.error("generateAvatar error:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ error: "Avatar generatie mislukt: " + error.message });
      }
    });
  });

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
// Helper: Format number as Dutch euro string "€ 1.234,56"
// =============================================================
function formatEuro(amount) {
  return `\u20AC ${amount.toFixed(2).replace(".", ",")}`;
}

// =============================================================
// Helper: Collect PDF stream into a Buffer (returns a Promise)
// =============================================================
function pdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

// =============================================================
// Helper: Draw a horizontal line across the page
// =============================================================
function drawLine(doc, y, x1, x2) {
  doc.moveTo(x1, y).lineTo(x2, y).lineWidth(0.5).stroke("#999999");
}

// =============================================================
// Helper: Generate receipts PDF matching DE UNIE template
// =============================================================
async function generateReceiptsPdf(receipts, month, year, monthName, employeeName, bankAccount) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const bufferPromise = pdfToBuffer(doc);

  const LEFT = 50;
  const RIGHT = 545;
  const COL_DATE = LEFT;
  const COL_DESC = 170;
  const COL_AMOUNT = 440;

  const now = new Date();
  const todayStr = `${now.getDate()} ${DUTCH_MONTHS[now.getMonth()].toLowerCase()} ${now.getFullYear()}`;

  // Title
  doc.fontSize(16).font("Helvetica-Bold")
    .text(`${COMPANY_NAME} declaratieformulier`, LEFT, 50);

  // Employee info
  let y = 85;
  doc.fontSize(10).font("Helvetica");
  doc.text(`medewerker: ${employeeName}`, LEFT, y);
  y += 16;
  doc.text(`bank/giro nummer: Priv\u00E9 rekening- ${bankAccount}`, LEFT, y);
  y += 16;
  doc.text(`datum: ${todayStr}`, LEFT, y);
  y += 30;

  // Column headers
  drawLine(doc, y, LEFT, RIGHT);
  y += 6;
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("datum", COL_DATE, y, { width: 110 });
  doc.text("omschrijving", COL_DESC, y, { width: 260 });
  doc.text("totale", COL_AMOUNT, y, { width: 95, align: "right" });
  y += 13;
  doc.text("", COL_DATE, y);
  doc.text("", COL_DESC, y);
  doc.text("vergoeding", COL_AMOUNT, y, { width: 95, align: "right" });
  y += 15;
  drawLine(doc, y, LEFT, RIGHT);
  y += 8;

  // Sort by date
  const sorted = [...receipts].sort(
    (a, b) => new Date(a.receipt_date).getTime() - new Date(b.receipt_date).getTime()
  );

  // Data rows
  doc.font("Helvetica").fontSize(9);
  let totalAmount = 0;
  for (const r of sorted) {
    if (y > 680) {
      doc.addPage();
      y = 50;
    }
    const dateFormatted = formatDateDutch(r.receipt_date);
    const description = [r.store_name, r.description].filter(Boolean).join(" - ");
    const amount = r.amount || 0;
    totalAmount += amount;

    doc.text(dateFormatted, COL_DATE, y, { width: 110 });
    doc.text(description, COL_DESC, y, { width: 260 });
    doc.text(formatEuro(amount), COL_AMOUNT, y, { width: 95, align: "right" });
    y += 18;
  }

  // Spacing before totals
  y = Math.max(y, 500);
  drawLine(doc, y, LEFT, RIGHT);
  y += 8;

  // Subtotalen
  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("Subtotalen", COL_DESC, y, { width: 260 });
  doc.text(formatEuro(totalAmount), COL_AMOUNT, y, { width: 95, align: "right" });
  y += 18;

  // Af: evt. voorschot
  doc.font("Helvetica").fontSize(9);
  doc.text("Af: evt. voorschot", COL_DESC, y, { width: 260 });
  doc.text(formatEuro(0), COL_AMOUNT, y, { width: 95, align: "right" });
  y += 18;

  // TOTAAL
  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("TOTAAL", COL_DESC, y, { width: 260 });
  doc.text(formatEuro(totalAmount), COL_AMOUNT, y, { width: 95, align: "right" });
  y += 8;
  drawLine(doc, y, LEFT, RIGHT);
  y += 25;

  // Handtekening
  doc.font("Helvetica").fontSize(9);
  doc.text("handtekening werknemer:", LEFT, y);
  y += 60;

  // Toelichting
  drawLine(doc, y, LEFT, RIGHT);
  y += 8;
  doc.font("Helvetica-Bold").fontSize(8);
  doc.text("Toelichting", LEFT, y);
  y += 14;
  doc.font("Helvetica").fontSize(7);
  doc.text(
    "Interne declaratie voor vergoeding van reiskosten gemaakt in opdracht en tijdens werktijd en overige declaraties. Declaraties kunnen worden ingeleverd bij de directie",
    LEFT, y, { width: RIGHT - LEFT }
  );
  y += 12;
  doc.text(
    "De vergoedingen worden op basis van de declaraties met het salaris uitbetaald.",
    LEFT, y, { width: RIGHT - LEFT }
  );

  doc.end();
  return bufferPromise;
}

// =============================================================
// Helper: Generate DE UNIE travel PDF matching their template
// =============================================================
async function generateTravelPdf(expenses, month, year, monthName, employeeName = EMPLOYEE_NAME, bankAccount = BANK_ACCOUNT) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
  const bufferPromise = pdfToBuffer(doc);

  const LEFT = 40;
  const RIGHT = 802;

  // Column positions for landscape A4
  const cols = {
    datum: LEFT,
    projnr: 115,
    projnaam: 195,
    omschr: 310,
    ov: 440,
    km: 510,
    kmverg: 560,
    overig: 650,
    totaal: 720,
  };
  const colWidths = {
    datum: 70,
    projnr: 75,
    projnaam: 110,
    omschr: 125,
    ov: 65,
    km: 45,
    kmverg: 85,
    overig: 65,
    totaal: 80,
  };

  const now = new Date();
  const todayStr = `${now.getDate()} ${DUTCH_MONTHS[now.getMonth()].toLowerCase()} ${now.getFullYear()}`;

  // Title
  doc.fontSize(14).font("Helvetica-Bold")
    .text(`${COMPANY_NAME} declaratieformulier`, LEFT, 40);

  // Employee info
  let y = 72;
  doc.fontSize(9).font("Helvetica");
  doc.text("medewerker:", LEFT, y, { continued: false });
  doc.text(employeeName, 130, y);
  y += 14;
  doc.text("bank/giro nummer:", LEFT, y);
  doc.text(bankAccount, 130, y);
  y += 14;
  doc.text("datum:", LEFT, y);
  doc.text(todayStr, 130, y);
  y += 22;

  // Column headers
  drawLine(doc, y, LEFT, RIGHT);
  y += 5;
  doc.fontSize(7.5).font("Helvetica-Bold");
  doc.text("datum", cols.datum, y, { width: colWidths.datum });
  doc.text("projectnr.", cols.projnr, y, { width: colWidths.projnr });
  doc.text("projectnaam", cols.projnaam, y, { width: colWidths.projnaam });
  doc.text("omschrijving", cols.omschr, y, { width: colWidths.omschr });
  doc.text("reiskosten", cols.ov, y, { width: colWidths.ov, align: "right" });
  doc.text("", cols.km, y, { width: colWidths.km, align: "right" });
  doc.text("km vergoeding", cols.kmverg, y, { width: colWidths.kmverg, align: "right" });
  doc.text("overige", cols.overig, y, { width: colWidths.overig, align: "right" });
  doc.text("totale", cols.totaal, y, { width: colWidths.totaal, align: "right" });
  y += 11;
  doc.text("", cols.datum, y);
  doc.text("", cols.projnr, y);
  doc.text("", cols.projnaam, y);
  doc.text("", cols.omschr, y);
  doc.text("OV", cols.ov, y, { width: colWidths.ov, align: "right" });
  doc.text("km's", cols.km, y, { width: colWidths.km, align: "right" });
  doc.text(`belastingvrij`, cols.kmverg, y, { width: colWidths.kmverg, align: "right" });
  doc.text("onkosten", cols.overig, y, { width: colWidths.overig, align: "right" });
  doc.text("vergoeding", cols.totaal, y, { width: colWidths.totaal, align: "right" });
  y += 11;
  doc.font("Helvetica").fontSize(6.5);
  doc.text("", cols.ov, y, { width: colWidths.ov, align: "right" });
  doc.text("", cols.km, y, { width: colWidths.km, align: "right" });
  doc.text(`x \u20AC ${KM_RATE.toFixed(2)}`, cols.kmverg, y, { width: colWidths.kmverg, align: "right" });
  y += 12;
  drawLine(doc, y, LEFT, RIGHT);
  y += 6;

  // Sort by date
  const sorted = [...expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Compute totals
  let totalOv = 0, totalKm = 0, totalKmVerg = 0, totalOverig = 0, totalVerg = 0;

  // Data rows
  doc.font("Helvetica").fontSize(8);
  for (const e of sorted) {
    if (y > 480) {
      doc.addPage();
      y = 40;
    }
    const dateFormatted = formatDateDutch(e.date);
    const kmVerg = (e.kilometers || 0) * KM_RATE;
    const total = (e.travel_cost || 0) + kmVerg;

    totalOv += e.travel_cost || 0;
    totalKm += e.kilometers || 0;
    totalKmVerg += kmVerg;
    totalVerg += total;

    doc.text(dateFormatted, cols.datum, y, { width: colWidths.datum });
    doc.text(e.project_code || "", cols.projnr, y, { width: colWidths.projnr });
    doc.text(e.project_name || "", cols.projnaam, y, { width: colWidths.projnaam });
    doc.text(e.description || "", cols.omschr, y, { width: colWidths.omschr });
    if (e.travel_cost) doc.text(formatEuro(e.travel_cost), cols.ov, y, { width: colWidths.ov, align: "right" });
    if (e.kilometers) doc.text(String(e.kilometers), cols.km, y, { width: colWidths.km, align: "right" });
    if (kmVerg) doc.text(formatEuro(kmVerg), cols.kmverg, y, { width: colWidths.kmverg, align: "right" });
    doc.text(formatEuro(total), cols.totaal, y, { width: colWidths.totaal, align: "right" });
    y += 16;
  }

  // Spacing before totals
  y += 8;
  drawLine(doc, y, LEFT, RIGHT);
  y += 6;

  // Subtotalen
  doc.font("Helvetica-Bold").fontSize(8);
  doc.text("Subtotalen", cols.omschr, y, { width: colWidths.omschr });
  if (totalOv) doc.text(formatEuro(totalOv), cols.ov, y, { width: colWidths.ov, align: "right" });
  doc.text(String(totalKm), cols.km, y, { width: colWidths.km, align: "right" });
  doc.text(formatEuro(totalKmVerg), cols.kmverg, y, { width: colWidths.kmverg, align: "right" });
  if (totalOverig) doc.text(formatEuro(totalOverig), cols.overig, y, { width: colWidths.overig, align: "right" });
  doc.text(formatEuro(totalVerg), cols.totaal, y, { width: colWidths.totaal, align: "right" });
  y += 16;

  // Af: evt. voorschot
  doc.font("Helvetica").fontSize(8);
  doc.text("Af: evt. voorschot", cols.omschr, y, { width: colWidths.omschr });
  doc.text(formatEuro(0), cols.totaal, y, { width: colWidths.totaal, align: "right" });
  y += 16;

  // TOTAAL
  doc.font("Helvetica-Bold").fontSize(8);
  doc.text("TOTAAL", cols.omschr, y, { width: colWidths.omschr });
  doc.text(formatEuro(totalVerg), cols.totaal, y, { width: colWidths.totaal, align: "right" });
  y += 6;
  drawLine(doc, y, LEFT, RIGHT);
  y += 25;

  // Handtekening
  doc.font("Helvetica").fontSize(8);
  doc.text("handtekening werknemer:", LEFT, y);
  doc.text("handtekening werkgever:", 420, y);
  y += 60;

  // Toelichting
  drawLine(doc, y, LEFT, RIGHT);
  y += 6;
  doc.font("Helvetica-Bold").fontSize(7);
  doc.text("Toelichting", LEFT, y);
  y += 12;
  doc.font("Helvetica").fontSize(6.5);
  doc.text(
    "Interne declaratie voor vergoeding van reiskosten gemaakt in opdracht en tijdens werktijd en overige declaraties. Declaraties kunnen worden ingeleverd bij de directie",
    LEFT, y, { width: RIGHT - LEFT }
  );
  y += 10;
  doc.text(
    "De vergoedingen worden op basis van de declaraties met het salaris uitbetaald.",
    LEFT, y, { width: RIGHT - LEFT }
  );

  doc.end();
  return bufferPromise;
}

// =============================================================
// submitCardPayment — Send a single card payment receipt via email immediately
// =============================================================
exports.submitCardPayment = functions
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
        const { receiptId } = req.body;
        if (!receiptId) {
          res.status(400).json({ error: "receiptId is required" });
          return;
        }

        // Load the card payment document
        const receiptDoc = await db.collection("card_payments").doc(receiptId).get();
        if (!receiptDoc.exists) {
          res.status(404).json({ error: "Bonnetje niet gevonden" });
          return;
        }

        const receipt = receiptDoc.data();
        if (receipt.userId !== userId) {
          res.status(403).json({ error: "Geen toegang" });
          return;
        }

        // Load user settings for recipient email and employee name
        const settingsDoc = await db.collection("users").doc(userId)
          .collection("settings").doc("profile").get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};
        const recipientEmail = settings.recipientEmail || RECIPIENT_EMAIL;
        const employeeName = settings.employeeName || EMPLOYEE_NAME;

        // Format the receipt date in Dutch
        const receiptDateFormatted = formatDateDutch(receipt.receipt_date);
        const amount = receipt.amount || 0;

        console.log(`Sending card payment receipt ${receiptId} for user ${userId} to ${recipientEmail}`);

        // Download receipt photo/PDF from Storage
        const attachments = [];
        if (receipt.photo_path) {
          try {
            const bucket = storage.bucket();
            const file = bucket.file(`receipt-photos/${receipt.photo_path}`);
            const [buffer] = await file.download();
            const isPdf = receipt.file_type === "pdf" || receipt.photo_path.endsWith(".pdf");
            const ext = isPdf ? "pdf" : "jpg";
            const store = (receipt.store_name || "onbekend").replace(/[^a-zA-Z0-9]/g, "_");
            attachments.push({
              filename: `Bonnetje_${store}_${(receipt.receipt_date || "").replace(/-/g, "")}.${ext}`,
              content: buffer,
            });
          } catch (err) {
            console.warn(`Could not download file for receipt ${receiptId}:`, err.message);
          }
        }

        // Build email
        const subject = `Bonnetje Kaartbetaling De Unie pas - ${receiptDateFormatted} - ${employeeName}`;
        const storeName = receipt.store_name || "Onbekend";
        const description = receipt.description || "-";

        const mail = getTransporter();
        await mail.sendMail({
          from: `"${getConfig("FROM_NAME") || "De Unie"}" <${getConfig("FROM_EMAIL") || getConfig("GMAIL_EMAIL") || "corneliskalma@gmail.com"}>`,
          to: recipientEmail,
          cc: decodedToken.email,
          subject: subject,
          html: `
            <h2>Bonnetje Kaartbetaling De Unie pas</h2>
            <table style="border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:4px 12px 4px 0;"><strong>Wat:</strong></td><td>${storeName} - ${description}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>Waar:</strong></td><td>${storeName}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>Wanneer:</strong></td><td>${receiptDateFormatted}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>Bedrag:</strong></td><td>${formatEuro(amount)}</td></tr>
            </table>
            ${receipt.notes ? `<p><strong>Notities:</strong> ${receipt.notes}</p>` : ""}
            <p>Het bonnetje is bijgevoegd.</p>
            <p style="color:#888;font-size:12px;">Verstuurd via Unie Forms App</p>
          `,
          attachments,
        });

        console.log(`Card payment email sent for receipt ${receiptId}`);

        res.status(200).json({
          success: true,
          message: `Bonnetje verstuurd naar ${recipientEmail}`,
        });
      } catch (error) {
        console.error("submitCardPayment error:", error);
        res.status(500).json({ error: "Verzenden mislukt: " + error.message });
      }
    });
  });

// =============================================================
// analyzeInvoiceTemplate — Extract fields from a sample invoice PDF using Gemini
// =============================================================
exports.analyzeInvoiceTemplate = functions
  .region("europe-west1")
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .https.onRequest((req, res) => {
    handleCors(req, res, async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const decodedToken = await verifyAuth(req);
      if (!decodedToken) {
        res.status(401).json({ error: "Niet ingelogd" });
        return;
      }

      try {
        const { fileBase64, mimeType } = req.body;
        if (!fileBase64) {
          res.status(400).json({ error: "fileBase64 is required" });
          return;
        }

        const apiKey = getConfig("GEMINI_API_KEY");
        if (!apiKey) {
          res.status(500).json({ error: "Gemini API key not configured" });
          return;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `Analyseer deze factuur en extraheer ALLE gegevens in het volgende JSON-formaat.
Let op: dit is een Nederlandse factuur. Zoek naar alle velden, ook in de footer/voettekst.

{
  "companyName": "naam van het bedrijf dat de factuur stuurt (afzender)",
  "companyAddress": "volledig adres van afzender (straat + nummer, postcode + plaats)",
  "companyPhone": "telefoonnummer afzender",
  "companyIban": "IBAN van afzender",
  "companyKvk": "KvK-nummer",
  "companyBtwNr": "BTW-nummer",
  "companyBicCode": "BIC code",
  "companyFooterName": "bedrijfsnaam zoals in de footer staat (kan afwijken van kop)",
  "recipientName": "naam van de ontvanger",
  "recipientAttention": "t.a.v. regel (indien aanwezig)",
  "recipientAddress": "volledig adres ontvanger",
  "descriptionPattern": "de omschrijving/beschrijving op de factuur, maar vervang de maandnaam door {month} en het jaar door {year}",
  "btwPercentage": 21,
  "amount": 7500.00
}

BELANGRIJK:
- Geef ALLEEN geldige JSON terug, geen uitleg of markdown
- Als een veld niet gevonden wordt, gebruik een lege string ""
- btwPercentage moet een nummer zijn
- amount moet een nummer zijn (het netto bedrag exclusief BTW)
- Bij descriptionPattern: vervang de specifieke maand door {month} en het jaar door {year}`;

        const result = await model.generateContent([
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType || "application/pdf",
              data: fileBase64,
            },
          },
        ]);

        const responseText = result.response.text();
        console.log("Gemini invoice analysis raw:", responseText.substring(0, 500));

        // Parse JSON from response
        let parsed;
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON found in response");
          }
        } catch (parseErr) {
          console.error("JSON parse error:", parseErr.message);
          res.status(500).json({ error: "Kon factuur niet analyseren", raw: responseText });
          return;
        }

        res.status(200).json({ success: true, data: parsed });
      } catch (error) {
        console.error("analyzeInvoiceTemplate error:", error);
        res.status(500).json({ error: "Analyse mislukt: " + error.message });
      }
    });
  });

// =============================================================
// submitManagementFee — Generate invoice PDF and send via email
// =============================================================
exports.submitManagementFee = functions
  .region("europe-west1")
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .https.onRequest((req, res) => {
    handleCors(req, res, async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const decodedToken = await verifyAuth(req);
      if (!decodedToken) {
        res.status(401).json({ error: "Niet ingelogd" });
        return;
      }
      const userId = decodedToken.uid;

      try {
        const { month, year, amount } = req.body;
        if (!month || !year || amount === undefined) {
          res.status(400).json({ error: "month, year, and amount are required" });
          return;
        }

        // Load template from user settings
        const templateDoc = await db.collection("users").doc(userId)
          .collection("settings").doc("managementfee").get();

        if (!templateDoc.exists) {
          res.status(400).json({ error: "Management fee template niet geconfigureerd" });
          return;
        }

        const template = templateDoc.data();
        const monthName = DUTCH_MONTHS[month - 1];
        const invoiceNumber = `${year}-${String(month).padStart(2, "0")}`;
        const btwAmount = amount * (template.btwPercentage / 100);
        const totalAmount = amount + btwAmount;

        // Build description from pattern
        const description = (template.descriptionPattern || "Management fee {month} {year}")
          .replace(/\{month\}/g, monthName.toLowerCase())
          .replace(/\{year\}/g, String(year));

        // Invoice date: 25th of the month (or today if current month)
        const now = new Date();
        let invoiceDate;
        if (month === now.getMonth() + 1 && year === now.getFullYear()) {
          invoiceDate = now;
        } else {
          invoiceDate = new Date(year, month - 1, 25);
        }

        const invoiceData = {
          month,
          year,
          monthName,
          amount,
          btwPercentage: template.btwPercentage,
          btwAmount,
          totalAmount,
          invoiceNumber,
          description,
          invoiceDate,
        };

        console.log(`Generating management fee invoice ${invoiceNumber} for user ${userId}, amount: ${amount}`);

        // Generate PDF
        const pdfBuffer = await generateManagementFeePdf(template, invoiceData);

        // Build filename from template
        const fileTitle = template.fileTitle || "Factuur management fee";
        const filename = `${fileTitle} ${monthName.toLowerCase()} ${year}.pdf`;

        // Send email
        const mail = getTransporter();
        await mail.sendMail({
          from: `"${getConfig('FROM_NAME') || 'De Unie'}" <${getConfig('FROM_EMAIL') || getConfig('GMAIL_EMAIL') || 'corneliskalma@gmail.com'}>`,
          to: template.recipientEmail,
          cc: decodedToken.email,
          subject: `${fileTitle} ${monthName.toLowerCase()} ${year}`,
          html: `
            <h2>${fileTitle}</h2>
            <p>Hierbij de factuur voor ${monthName.toLowerCase()} ${year}.</p>
            <table style="border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:4px 12px 4px 0;"><strong>Factuurnummer:</strong></td><td>${invoiceNumber}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>Bedrag excl. BTW:</strong></td><td>${formatEuroInvoice(amount)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>BTW ${template.btwPercentage}%:</strong></td><td>${formatEuroInvoice(btwAmount)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;"><strong>Totaal:</strong></td><td>${formatEuroInvoice(totalAmount)}</td></tr>
            </table>
            <p style="color:#888;font-size:12px;">Verstuurd via De Unie Companion App</p>
          `,
          attachments: [
            {
              filename,
              content: pdfBuffer,
            },
          ],
        });

        console.log(`Management fee email sent to ${template.recipientEmail} for ${monthName} ${year}`);

        // Save invoice record
        await db.collection("management_fee_invoices").add({
          userId,
          month,
          year,
          amount,
          btwPercentage: template.btwPercentage,
          btwAmount,
          totalAmount,
          invoiceNumber,
          status: "sent",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(200).json({
          success: true,
          message: `Factuur ${invoiceNumber} verstuurd naar ${template.recipientEmail}`,
          invoiceNumber,
          totalAmount,
        });
      } catch (error) {
        console.error("submitManagementFee error:", error);
        res.status(500).json({ error: "Verzenden mislukt: " + error.message });
      }
    });
  });

// =============================================================
// Helper: Generate management fee invoice PDF
// =============================================================
async function generateManagementFeePdf(template, invoiceData) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });
  const bufferPromise = pdfToBuffer(doc);

  const PAGE_WIDTH = 595.28;
  const LEFT = 50;
  const RIGHT = PAGE_WIDTH - 50;

  // --- Company header (right-aligned, top) ---
  doc.font("Helvetica-Bold").fontSize(14);
  doc.text(template.companyName || "", LEFT, 50, { width: RIGHT - LEFT, align: "right" });

  doc.font("Helvetica").fontSize(9);
  let headerY = 72;
  if (template.companyAddress) {
    // Split address into lines by comma or newline
    const addressLines = template.companyAddress.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    for (const line of addressLines) {
      doc.text(line, LEFT, headerY, { width: RIGHT - LEFT, align: "right" });
      headerY += 14;
    }
  }
  if (template.companyPhone) {
    headerY += 2;
    doc.text(template.companyPhone, LEFT, headerY, { width: RIGHT - LEFT, align: "right" });
    headerY += 14;
  }

  // --- Recipient (left-aligned) ---
  let y = 130;
  doc.font("Helvetica").fontSize(10);
  if (template.recipientName) {
    doc.text(template.recipientName, LEFT, y);
    y += 15;
  }
  if (template.recipientAttention) {
    const tav = template.recipientAttention.toLowerCase().startsWith("t.a.v")
      ? template.recipientAttention
      : `t.a.v. ${template.recipientAttention}`;
    doc.text(tav, LEFT, y);
    y += 15;
  }
  if (template.recipientAddress) {
    const addrLines = template.recipientAddress.split(",").map(s => s.trim());
    for (const line of addrLines) {
      doc.text(line, LEFT, y);
      y += 15;
    }
  }

  // --- Date and invoice number ---
  y += 20;
  const dateStr = formatDutchDate(invoiceData.invoiceDate);
  doc.font("Helvetica").fontSize(10);
  doc.text(dateStr, LEFT, y);
  y += 15;
  doc.text(`Factuurnummer ${invoiceData.invoiceNumber}`, LEFT, y);

  // --- Description ---
  y += 30;
  doc.font("Helvetica").fontSize(10);
  doc.text(invoiceData.description, LEFT, y, { width: RIGHT - LEFT });

  // --- Amount table ---
  y += 40;
  const amountCol = 400;

  // Net amount
  doc.font("Helvetica").fontSize(10);
  const descLabel = (template.descriptionPattern || "Management fee")
    .replace(/\{month\}.*$/i, "").replace(/maand\s*$/i, "").trim() || "Management fee";
  doc.text(descLabel, LEFT, y);
  doc.text(formatEuroInvoice(invoiceData.amount), amountCol, y, { width: RIGHT - amountCol, align: "right" });
  y += 18;

  // BTW
  doc.text(`BTW ${invoiceData.btwPercentage}%`, LEFT, y);
  doc.text(formatEuroInvoice(invoiceData.btwAmount), amountCol, y, { width: RIGHT - amountCol, align: "right" });
  y += 5;

  // Separator line
  doc.moveTo(LEFT, y + 8).lineTo(RIGHT, y + 8).lineWidth(0.5).stroke();
  y += 18;

  // Total
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Totaal", LEFT, y);
  doc.text(formatEuroInvoice(invoiceData.totalAmount), amountCol, y, { width: RIGHT - amountCol, align: "right" });

  // --- Company footer info ---
  y += 50;
  doc.font("Helvetica").fontSize(9);
  if (template.companyFooterName) {
    doc.text(template.companyFooterName, LEFT, y);
    y += 14;
  }
  if (template.companyIban) {
    doc.text(template.companyIban, LEFT, y);
    y += 20;
  }

  // --- Bottom footer bar ---
  const footerY = 770;
  doc.moveTo(LEFT, footerY).lineTo(RIGHT, footerY).lineWidth(1).stroke();
  doc.font("Helvetica").fontSize(7);
  const footerParts = [];
  if (template.companyIban) footerParts.push(template.companyIban);
  if (template.companyKvk) footerParts.push(`KvK ${template.companyKvk}`);
  if (template.companyBtwNr) footerParts.push(`BTW ${template.companyBtwNr}`);
  if (template.companyBicCode) footerParts.push(`BIC ${template.companyBicCode}`);
  doc.text(footerParts.join("   |   "), LEFT, footerY + 6, { width: RIGHT - LEFT, align: "center" });

  doc.end();
  return bufferPromise;
}

// Format euro for invoices: € 7.500,00 (Dutch format with thousands separator)
function formatEuroInvoice(amount) {
  const parts = amount.toFixed(2).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `\u20AC ${intPart},${parts[1]}`;
}

// Format a date in Dutch: "25 januari 2026"
function formatDutchDate(date) {
  const d = new Date(date);
  const day = d.getDate();
  const monthName = DUTCH_MONTHS[d.getMonth()].toLowerCase();
  const year = d.getFullYear();
  return `${day} ${monthName} ${year}`;
}
