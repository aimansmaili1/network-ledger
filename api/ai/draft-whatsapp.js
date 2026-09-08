/**
 * Vercel Serverless Function: Generate a short, formal WhatsApp message
 *
 * Endpoint: POST /api/ai/draft-whatsapp
 * Body: { name, company, howMet, lastContact, notes }
 * Response: { message: "..." }
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, company, howMet, lastContact, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Contact name is required" });
    }

    const prompt = `You are writing a short, formal WhatsApp message to reconnect or follow up with a professional contact.

Constraints:
- Maximum 2 sentences, under 80 characters total
- Formal but warm tone
- No emojis, no slang, no excessive punctuation
- Reference something specific about your relationship if available
- Write ONLY the message text, nothing else

Contact details:
- Name: ${name}
- Company: ${company || "(not specified)"}
- How we met: ${howMet || "(not specified)"}
- Last contact: ${lastContact || "(not specified)"}
- Notes: ${notes || "(none)"}

Generate ONE short message only.`;

    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const draftMessage = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    if (!draftMessage) {
      return res.status(500).json({ error: "Failed to generate message" });
    }

    return res.status(200).json({ message: draftMessage });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
