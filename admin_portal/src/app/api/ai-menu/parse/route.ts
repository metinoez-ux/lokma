import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Route segment config
export const maxDuration = 300; // 5 minutes for large AI processing
export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════
// Server-side API Keys — NEVER exposed to the client
// ═══════════════════════════════════════════════════════════════════
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `Du bist ein Experte für digitale Restaurant-Menüs. Analysiere das hochgeladene Menü und extrahiere ALLE Produkte mit Kategorien.

WICHTIG:
- Erkenne Kategorien automatisch (z.B. "Döner", "Pizza", "Getränke")
- Erkenne Preise exakt (achte auf Komma vs. Punkt als Dezimaltrenner)
- Erkenne Produktbeschreibungen wenn vorhanden
- Erkenne Varianten/Größen als optionGroups (z.B. Klein/Groß, Normal/Jumbo)
- Gib IMMER ein icon-Emoji für jede Kategorie
- unit ist standardmäßig "adet" (Stück)
- Preise in EUR (als Zahl, z.B. 12.90 nicht "12,90€")

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt im folgenden Format (keine Kommentare, kein Markdown):
{
  "categories": [
    { "name": "Döner", "icon": "🥙" }
  ],
  "products": [
    {
      "name": "Döner Teller",
      "category": "Döner",
      "price": 12.90,
      "description": "Mit Reis und Salat",
      "unit": "adet",
      "optionGroups": [
        {
          "name": "Größe",
          "type": "radio",
          "required": true,
          "options": [
            { "name": "Normal", "priceModifier": 0 },
            { "name": "Groß", "priceModifier": 2.00 }
          ]
        }
      ]
    }
  ]
}`;

// ═══════════════════════════════════════════════════════════════════
// Claude API call (PRIMARY — powerful vision + structured output)
// ═══════════════════════════════════════════════════════════════════
async function callClaude(
    fileList: { data: string; mimeType: string }[],
    textContent?: string,
    modelId?: string
): Promise<string> {
    const selectedModel = modelId || DEFAULT_MODEL;
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // Build content blocks for Claude
    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

    // Add images
    for (const f of fileList) {
        const mediaType = f.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        content.push({
            type: 'image',
            source: {
                type: 'base64',
                media_type: mediaType,
                data: f.data,
            },
        });
    }

    // Add text instruction
    if (fileList.length > 0) {
        const instruction = fileList.length > 1
            ? `Es wurden ${fileList.length} Dateien hochgeladen. Bitte analysiere ALLE Dateien zusammen und erstelle eine einheitliche Menü-Struktur.`
            : 'Bitte analysiere dieses Menü und extrahiere alle Produkte.';
        content.push({ type: 'text', text: instruction });
    } else if (textContent) {
        content.push({ type: 'text', text: `Hier sind die Menü-Daten als Text:\n\n${textContent}` });
    }

    console.log(`[AI Menu] Calling Claude ${selectedModel}...`);
    const response = await anthropic.messages.create({
        model: selectedModel,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
    });

    console.log('[AI Menu] Claude response received');

    // Extract text from response
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
        throw new Error('Claude yanıtında metin bulunamadı.');
    }
    return textBlock.text;
}

// ═══════════════════════════════════════════════════════════════════
// Gemini API call
// ═══════════════════════════════════════════════════════════════════
const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

async function callGemini(
    fileList: { data: string; mimeType: string }[],
    textContent?: string,
    modelId?: string
): Promise<string> {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const parts: any[] = [{ text: SYSTEM_PROMPT }];

    if (fileList.length > 0) {
        for (const f of fileList) {
            parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
        }
        if (fileList.length > 1) {
            parts.push({ text: `Es wurden ${fileList.length} Dateien hochgeladen. Bitte analysiere ALLE Dateien zusammen und erstelle eine einheitliche Menü-Struktur.` });
        }
    } else if (textContent) {
        parts.push({ text: `Hier sind die Menü-Daten als Text:\n\n${textContent}` });
    }

    // If a specific model was requested, try it first
    const modelsToTry = modelId ? [modelId, ...GEMINI_FALLBACK_MODELS.filter(m => m !== modelId)] : GEMINI_FALLBACK_MODELS;

    let lastError: any = null;
    for (const modelName of modelsToTry) {
        try {
            console.log(`[AI Menu] Trying Gemini ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(parts);
            console.log(`[AI Menu] Success with ${modelName}`);
            return result.response.text();
        } catch (err: any) {
            lastError = err;
            console.error(`[AI Menu] Gemini ${modelName} failed: ${err.message}`);
        }
    }
    throw lastError || new Error('Tüm Gemini modelleri başarısız oldu.');
}

// ═══════════════════════════════════════════════════════════════════
// POST handler — Claude primary, Gemini fallback
// ═══════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
    try {
        if (!ANTHROPIC_API_KEY && !GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'AI API anahtarı sunucuda yapılandırılmamış.' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { files, fileData, mimeType, textContent, model } = body;

        // Support both single file (legacy) and multi-file uploads
        const fileList: { data: string; mimeType: string }[] = [];

        if (files && Array.isArray(files)) {
            fileList.push(...files);
        } else if (fileData && mimeType) {
            fileList.push({ data: fileData, mimeType });
        }

        if (fileList.length === 0 && !textContent) {
            return NextResponse.json(
                { error: 'Dosya verisi veya metin içeriği gerekli.' },
                { status: 400 }
            );
        }

        let responseText: string;
        let provider = 'unknown';
        const isGeminiModel = model?.startsWith('gemini-');

        if (isGeminiModel && GEMINI_API_KEY) {
            // User explicitly selected a Gemini model
            try {
                responseText = await callGemini(fileList, textContent, model);
                provider = 'gemini';
            } catch (geminiErr: any) {
                console.error('[AI Menu] Gemini failed:', geminiErr.message);
                if (!ANTHROPIC_API_KEY) throw geminiErr;
                console.log('[AI Menu] Falling back to Claude...');
                responseText = await callClaude(fileList, textContent);
                provider = 'claude-fallback';
            }
        } else if (ANTHROPIC_API_KEY) {
            // Claude model selected (or default)
            try {
                responseText = await callClaude(fileList, textContent, model);
                provider = 'claude';
            } catch (claudeErr: any) {
                console.error('[AI Menu] Claude failed:', claudeErr.message);
                if (!GEMINI_API_KEY) throw claudeErr;
                console.log('[AI Menu] Falling back to Gemini...');
                responseText = await callGemini(fileList, textContent);
                provider = 'gemini-fallback';
            }
        } else {
            responseText = await callGemini(fileList, textContent);
            provider = 'gemini';
        }

        console.log(`[AI Menu] Response from ${provider}, length: ${responseText.length}`);

        // Parse JSON from response (strip markdown fences if present)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[AI Menu] No JSON in response:', responseText.substring(0, 500));
            return NextResponse.json(
                { error: 'AI yanıtında geçerli JSON bulunamadı.' },
                { status: 500 }
            );
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({ data: parsed, provider });

    } catch (err: any) {
        console.error('AI Menu parse error:', err);
        return NextResponse.json(
            { error: `AI işleme hatası: ${err.message || 'Bilinmeyen hata'}` },
            { status: 500 }
        );
    }
}
