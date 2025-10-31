import { GoogleGenAI, Type } from "@google/genai";
import type { DaySchedule } from '../types';

// NOTE: This check is for a local dev environment.
// In a real application, the API key should be securely managed.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scheduleSchema = {
  type: Type.OBJECT,
  properties: {
    schedule: {
      type: Type.ARRAY,
      description: "An array containing the schedule for each of the 7 days of the week for Appiani, starting from Monday. The array must contain exactly 7 items.",
      items: {
        type: Type.OBJECT,
        properties: {
          date: {
            type: Type.STRING,
            description: "The full date of the day in YYYY-MM-DD format, as determined from the image header. This is crucial and must be accurate.",
          },
          type: {
            type: Type.STRING,
            description: "The type of day for Appiani. Can be 'work', 'rest', or 'empty'. 'empty' means no information is available.",
            enum: ['work', 'rest', 'empty'],
          },
          shifts: {
            type: Type.ARRAY,
            description: "An array of Appiani's work shifts for the day. Should be empty if the type is 'rest' or 'empty'. A cell can contain multiple shifts.",
            items: {
              type: Type.OBJECT,
              properties: {
                start: {
                  type: Type.STRING,
                  description: "The start time of the shift in HH:mm format (24-hour clock)."
                },
                end: {
                  type: Type.STRING,
                  description: "The end time of the shift in HH:mm format (24-hour clock)."
                }
              },
              required: ["start", "end"],
            }
          },
          isUncertain: {
            type: Type.BOOLEAN,
            description: "Set this to true if you were uncertain about the data for this day. For example, if the handwriting was illegible, the image was blurry in that section, or the entry was ambiguous. Otherwise, omit this field.",
          },
        },
        required: ["date", "type", "shifts"],
      }
    },
    summary: {
      type: Type.STRING,
      description: "A brief, friendly summary in Italian of Appiani's work week, mentioning the total number of work days and any notable patterns."
    }
  },
  required: ["schedule", "summary"],
};

export const analyzeScheduleImage = async (
  base64Image: string,
  mimeType: string
): Promise<{ schedule: DaySchedule[], summary: string }> => {
  try {
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType,
      },
    };

    const textPart = {
        text: `Analyze the attached image, which is a weekly work schedule. Your task is to extract the schedule *only for the user named "APPIANI"*.

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
5.  **Summary:** Provide a brief, friendly, and confidential summary in Italian addressed directly to the user, whose name is Ilaria. Do not mention the name "Appiani" in the summary. For example, start with "Ciao Ilaria, ecco un riepilogo della tua settimana..." or a similar direct and personal tone.
`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: scheduleSchema,
      },
    });

    const jsonText = response.text.trim();
    const parsedResponse = JSON.parse(jsonText);

    if (!parsedResponse.schedule || parsedResponse.schedule.length !== 7) {
        throw new Error("Invalid schedule format received from AI. The AI did not return data for exactly 7 days.");
    }

    return {
        schedule: parsedResponse.schedule,
        summary: parsedResponse.summary,
    };

  } catch (error) {
    console.error('Error analyzing schedule image with Gemini:', error);
    if (error instanceof Error) {
        throw new Error(`Failed to analyze schedule: ${error.message}`);
    }
    throw new Error('An unknown error occurred during schedule analysis.');
  }
};