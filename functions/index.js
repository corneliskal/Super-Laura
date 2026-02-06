const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors")({ origin: true });

admin.initializeApp();

/**
 * analyzeReceipt - Cloud Function that uses Gemini to extract data from receipt photos.
 *
 * Expects: { image: "base64 encoded image or data URL" }
 * Returns: { raw_text, confidence, parsed: { store_name, amount, vat_amount, date, description, category } }
 *
 * Deploy: firebase deploy --only functions
 * Set API key: Add GEMINI_API_KEY to functions/.env
 */
exports.analyzeReceipt = functions
  .region("europe-west1")
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      // Only allow POST
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

        // Get Gemini API key from environment variable
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          console.error("Gemini API key not configured. Add GEMINI_API_KEY to functions/.env");
          res.status(500).json({ error: "OCR not configured" });
          return;
        }

        // Extract base64 data and mime type
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

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Create prompt for receipt analysis
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

        // Send to Gemini
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

        // Parse JSON from response
        let parsed;
        try {
          // Extract JSON from response (may be wrapped in markdown code blocks)
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            parsed = JSON.parse(responseText);
          }
        } catch (parseErr) {
          console.error("Failed to parse Gemini response as JSON:", parseErr);
          // Return raw text for client-side parsing
          res.status(200).json({
            raw_text: responseText,
            confidence: 0.5,
            parsed: null,
          });
          return;
        }

        // Normalize the parsed data
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
