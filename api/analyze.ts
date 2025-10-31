import { GoogleGenAI, Type } from "@google/genai";
import { getSessionId, createSessionCookie } from '../lib/session';
import { addHistory } from '../lib/db';
import type { DaySchedule } from '../types';

export const config = {
  runtime: 'edge',
};

// Lo schema e il prompt per l'IA, ora sicuri sul backend.
const scheduleSchema = {
  type: Type.OBJECT,
  properties: {
    schedule: {
      type: Type.ARRAY,
      description: "An array containing the schedule for each of the 7 days of the week for Appiani, starting from Monday. The array must contain exactly 7 items.",
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "The full date of the day in YYYY-MM-DD format, as determined from the image header. This is crucial and must be accurate." },
          type: { type: Type.STRING, description: "The type of day for Appiani. Can be 'work', 'rest', or 'empty'. 'empty' means no information is available.", enum: ['work', 'rest', 'empty'] },
          shifts: {
            type: Type.ARRAY,
            description: "An array of Appiani's work shifts for the day. Should be empty if the type is 'rest' or 'empty'. A cell can contain multiple shifts.",
            items: {
              type: Type.OBJECT,
              properties: {
                start: { type: Type.STRING, description: "The start time of the shift in HH:mm format (24-hour clock)." },
                end: { type: Type.STRING, description: "The end time of the shift in HH:mm format (24-hour clock)." }
              },
              required: ["start", "end"],
            }
          },
          isUncertain: { type: Type.BOOLEAN, description: "Set this to true if you were uncertain about the data for this day. For example, if the handwriting was illegible, the image was blurry in that section, or the entry was ambiguous. Otherwise, omit this field." },
        },
        required: ["date", "type", "shifts"],
      }
    },
    summary: { type: Type.STRING, description: "A brief, friendly summary in Italian of Appiani's work week, mentioning the total number of work days and any notable patterns." }
  },
  required: ["schedule", "summary"],
};

const promptText = `Analyze the attached image, which is a weekly work schedule. Your task is to extract the schedule *only for the user named "APPIANI"*.

The image is a table. Follow these steps carefully:
1.  **Locate the Target Row:** Find the row that starts with the name "APPIANI". All subsequent analysis must be on this row only.
2.  **Determine the Dates:** Look at the table header. The top row has the days of the week (LUNEDI' to DOMENICA). The row directly below it usually contains the numeric day of the month. There might also be a month indicator (like "SETT OTT" for October) at the top. Use this information to construct the full date for each day in 'YYYY-MM-DD' format. If the year isn't specified, assume the current year. It is critical that you find the correct dates from the image.
3.  **Extract Daily Information for "APPIANI":** For each day from Monday to Sunday in the "APPIANI" row:
    *   **Work Day:** If the cell contains time ranges (e.g., '15-20', '7:30-14'), the day type is 'work'.
        *   **Time Precision:** You MUST extract times in a strict 'HH:mm' 24-hour format. If you see '13-21', you must interpret and output it as '13:00' and '21:00'. If you see '7:30', output '07:30'.
        *   **Overnight Shifts:** Pay close attention to shifts that cross midnight (e.g., a shift from '22:00' to '06:00'). This is a valid shift. The entire shift's duration belongs to the day on which it started.
    *   **Rest Day:** If the cell contains 'R' (for Riposo), a dash '-', is completely blank, or has a line drawn through it, the day type is 'rest'. There are no shifts.
    *   **Flagging Uncertainty:** If you are not confident about the data for a specific day (e.g., the image is blurry, the handwriting is hard to read, a time is ambiguous), you MUST set the 'isUncertain' flag to true for that day's object. This is crucial for user feedback.
4.  **Format the Output:** Return a JSON object that strictly adheres to the provided schema. The 'schedule' array must contain exactly 7 day objects, corresponding to the week found in the image, ordered from Monday to Sunday. The 'date' for each object must be the full 'YYYY-MM-DD' date you determined in step 2.
5.  **Summary:** Provide a brief, friendly, and confidential summary in Italian addressed directly to the user.`;

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ message: 'La chiave API per Gemini non è configurata sul server.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    let sessionId = getSessionId(req);
    const headers = new Headers({ 'Content-Type': 'application/json' });

    if (!sessionId) {
        const [newSessionId, sessionCookie] = createSessionCookie();
        sessionId = newSessionId;
        headers.set('Set-Cookie', sessionCookie);
    }

    try {
        const { base64Image, mimeType } = await req.json();
        if (!base64Image || !mimeType) {
            return new Response(JSON.stringify({ message: 'Dati dell\'immagine mancanti.' }), { status: 400, headers });
        }

        const ai = new GoogleGenAI({ apiKey });
        
        const imagePart = { inlineData: { data: base64Image, mimeType } };
        const textPart = { text: promptText };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [imagePart, textPart] },
            config: { responseMimeType: "application/json", responseSchema: scheduleSchema }
        });
        
        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr) as { schedule: DaySchedule[], summary: string };

        if (!result || !result.schedule || !result.summary) {
            throw new Error("L'IA ha restituito dati in un formato inaspettato.");
        }
        
        const firstDay = new Date(result.schedule[0].date + 'T12:00:00Z');
        const dateRange = `Settimana del ${firstDay.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;

        const newEntryData = { dateRange, ...result, imageData: base64Image, mimeType };
        const savedEntry = await addHistory(sessionId, newEntryData);
        
        return new Response(JSON.stringify(savedEntry), { status: 200, headers });

    } catch (err) {
        console.error("Errore durante l'analisi con Gemini:", err);
        const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
        return new Response(JSON.stringify({ message: `Analisi fallita: ${errorMessage}` }), { status: 500, headers });
    }
}
