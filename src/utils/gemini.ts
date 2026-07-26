import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.1-flash-lite";

let client: GoogleGenAI | null = null;

const getClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
};

/**
 * Sends a prompt to Gemini and returns the raw text response.
 * `system` is prepended as instruction context.
 */
export const generateDietPlanText = async (system: string, prompt: string): Promise<string> => {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: system,
      temperature: 0.4,
      // Ask the model for pure JSON so we can parse it reliably.
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini");
  }
  return text;
};

/**
 * Best-effort parse of a JSON object from an LLM response.
 * Strips markdown code fences and grabs the outermost { ... } if needed.
 */
export const parseJsonFromModel = (raw: string): any => {
  let cleaned = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences if present.
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract the first {...} block.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Could not parse a valid diet plan from the AI response");
  }
};
