import Anthropic from "@anthropic-ai/sdk";

export type ParsedReport = {
  productName: string;
  category: string | null;
  quantity: number;
};

const SYSTEM_PROMPT =
  'Zamieniasz wypowiedź pracownika sklepu o produkcie, którego szukał klient, ' +
  "na ustrukturyzowany rekord do rejestru utraconej sprzedaży. " +
  "Odpowiedz WYŁĄCZNIE poprawnym JSON, bez żadnego dodatkowego tekstu, w formacie: " +
  '{"productName": string, "category": string, "quantity": number}. ' +
  '"productName" — znormalizowana nazwa produktu (zachowaj markę i model, jeśli podane). ' +
  '"category" — krótka, ogólna kategoria po polsku, małymi literami (np. "elektronarzędzia", "hydraulika", "kable"). ' +
  '"quantity" — liczba sztuk; jeśli nie podano wprost, użyj 1.';

function fallbackFor(rawText: string): ParsedReport {
  return { productName: rawText.trim(), category: null, quantity: 1 };
}

export async function parseLostSaleText(rawText: string): Promise<ParsedReport> {
  const fallback = fallbackFor(rawText);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: rawText }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return fallback;

    const parsed = JSON.parse(textBlock.text) as Partial<ParsedReport>;

    const productName =
      typeof parsed.productName === "string" && parsed.productName.trim()
        ? parsed.productName.trim()
        : fallback.productName;
    const category =
      typeof parsed.category === "string" && parsed.category.trim()
        ? parsed.category.trim().toLowerCase()
        : null;
    const quantity =
      typeof parsed.quantity === "number" &&
      Number.isFinite(parsed.quantity) &&
      parsed.quantity > 0
        ? Math.round(parsed.quantity)
        : 1;

    return { productName, category, quantity };
  } catch {
    // AI niedostępne albo zwróciło coś, czego nie da się sparsować —
    // zgłoszenie i tak ma się zapisać, tylko bez kategoryzacji.
    return fallback;
  }
}
