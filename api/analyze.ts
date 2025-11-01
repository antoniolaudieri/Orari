import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from '@google/genai';
import { addHistory } from './lib/db';
import formidable, { File } from 'formidable';
import fs from 'fs';

// Disabilita il body parser di Vercel per gestire il multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

// Funzione per parsare il form
const parseForm = (req: VercelRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  return new Promise((resolve, reject) => {
    const form = formidable();
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
};


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const model = 'gemini-2.5-flash';
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const jsonSchema = {
    type: Type.OBJECT,
    properties: {
        dateRange: { type: Type.STRING, description: "L'intervallo di date della settimana, es. '27 Maggio - 02 Giugno 2024'." },
        schedule: {
            type: Type.ARRAY,
            description: "Un array di 7 oggetti, uno per ogni giorno da Lunedì a Domenica.",
            items: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: "La data del giorno in formato YYYY-MM-DD." },
                    type: { type: Type.STRING, description: "Tipo di giornata: 'work' per lavoro, 'rest' per riposo, o 'empty' se non specificato." },
                    shifts: {
                        type: Type.ARRAY,
                        description: "Un array di turni per la giornata. Vuoto se è riposo o non specificato.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                start: { type: Type.STRING, description: "Orario di inizio turno in formato HH:MM (24h)." },
                                end: { type: Type.STRING, description: "Orario di fine turno in formato HH:MM (24h)." },
                            }
                        }
                    },
                    isUncertain: { type: Type.BOOLEAN, description: "True se l'IA non è sicura dell'interpretazione di questo giorno, altrimenti false." }
                }
            }
        },
        summary: { type: Type.STRING, description: "Un breve riassunto testuale dell'orario, es. 'Settimana con 5 giorni lavorativi e 2 di riposo, con un totale di X ore.'" },
    }
};

const systemInstruction = `Sei un assistente specializzato nell'analizzare immagini di orari di lavoro settimanali, nello specifico per l'azienda "Appiani". Il tuo compito è estrarre con la massima precisione le informazioni e restituirle in formato JSON.

Regole di Analisi:
1.  **Formato Input**: Riceverai un'immagine contenente un orario settimanale. L'orario va da Lunedì a Domenica.
2.  **Identifica le Date**: Trova l'intervallo di date della settimana. Determina la data esatta (YYYY-MM-DD) per ogni giorno da Lunedì a Domenica. L'anno corrente è ${new Date().getFullYear()}.
3.  **Analisi Giornaliera**: Per ogni giorno, estrai i turni di lavoro. Un giorno può avere uno o più turni. Ogni turno ha un orario di inizio e uno di fine in formato HH:MM (24 ore).
4.  **Tipi di Giornata**:
    *   'work': Se ci sono turni di lavoro.
    *   'rest': Se è indicato esplicitamente "RIPOSO" o una dicitura simile.
    *   'empty': Se la casella del giorno è vuota o non interpretabile.
5.  **Incertezza**: Se non riesci a leggere chiaramente un orario o un giorno, imposta \`isUncertain\` a \`true\` per quel giorno e fai una stima plausibile. Non lasciare mai un turno parziale (es. solo inizio o solo fine).
6.  **Output**: Restituisci SEMPRE un oggetto JSON strutturato secondo lo schema fornito, con 7 elementi nell'array \`schedule\`, uno per ogni giorno da Lunedì a Domenica in ordine.
7.  **Riepilogo (Summary)**: Crea un breve riassunto testuale dell'orario, menzionando i giorni lavorativi, i riposi e una nota generale.
8.  **Gestione Errori**: Se l'immagine è illeggibile o non contiene un orario, restituisci un JSON con un messaggio di errore nel campo 'summary'.`;


export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const userId = 'ilaria-user-id'; // Static user ID, authentication removed.

    try {
        const { files } = await parseForm(req);
        const imageFiles = files.image;

        if (!imageFiles) {
             return res.status(400).json({ error: 'Nessuna immagine fornita.' });
        }

        const imageFile = Array.isArray(imageFiles) ? imageFiles[0] : imageFiles;
        
        if (!imageFile) {
            return res.status(400).json({ error: 'Nessuna immagine valida trovata.' });
        }
        
        const filePath = imageFile.filepath;
        const mimeType = imageFile.mimetype || 'image/jpeg';
        
        const fileContent = await fs.promises.readFile(filePath);
        const imageData = fileContent.toString('base64');
        
        const imagePart = {
            inlineData: {
                data: imageData,
                mimeType,
            },
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart] },
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: jsonSchema,
                safetySettings,
            },
        });
        
        const jsonString = response.text?.trim();
        if (!jsonString) {
            throw new Error("L'analisi IA non ha restituito un testo valido.");
        }
        const analysisResult = JSON.parse(jsonString);

        const historyEntry = {
            dateRange: analysisResult.dateRange,
            schedule: analysisResult.schedule,
            summary: analysisResult.summary,
            imageData: imageData,
            mimeType: mimeType,
        };

        const newEntry = await addHistory(userId, historyEntry);

        res.status(200).json(newEntry);
    } catch (error: any) {
        console.error('Error during analysis:', error);
        res.status(500).json({ error: 'Errore interno del server durante l\'analisi.', details: error.message });
    }
}