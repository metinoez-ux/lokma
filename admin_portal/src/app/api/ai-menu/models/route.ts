import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const revalidate = 604800; // Cache for 1 week (seconds)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface AIModel {
 id: string;
 name: string;
 provider: string;
 group: string;
}

// Fallback models in case API calls fail
const FALLBACK_MODELS: AIModel[] = [
 { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'claude', group: 'Anthropic Claude' },
 { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'claude', group: 'Anthropic Claude' },
 { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'claude', group: 'Anthropic Claude' },
 { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'openai', group: 'OpenAI' },
 { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'openai', group: 'OpenAI' },
 { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', group: 'OpenAI' },
 { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'gemini', group: 'Google Gemini' },
 { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'gemini', group: 'Google Gemini' },
 { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', group: 'Google Gemini' },
];

function formatModelName(id: string): string {
 // Claude models
 if (id.includes('claude')) {
 const parts = id.replace('claude-', '').split('-');
 const variant = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
 // Extract version info
 const versionMatch = id.match(/(\d+[\.\-]\d+)/);
 if (versionMatch) {
 return `Claude ${variant} ${versionMatch[1].replace('-', '.')}`;
 }
 return `Claude ${variant}`;
 }
 // GPT models
 if (id.startsWith('gpt-')) {
 return id.toUpperCase().replace('GPT-', 'GPT-');
 }
 // Gemini models
 if (id.startsWith('gemini-')) {
 return id
 .replace('gemini-', 'Gemini ')
 .replace('-preview', '')
 .replace('-latest', '')
 .split('-')
 .map(p => p.charAt(0).toUpperCase() + p.slice(1))
 .join(' ');
 }
 return id;
}

async function fetchAnthropicModels(): Promise<AIModel[]> {
 if (!ANTHROPIC_API_KEY) return [];
 try {
 const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
 const response = await anthropic.models.list({ limit: 50 });
 
 const models: AIModel[] = [];
 for (const m of response.data) {
 // Only include chat models with vision capability
 if (m.id.includes('claude') && !m.id.includes('instant')) {
 models.push({
 id: m.id,
 name: m.display_name || formatModelName(m.id),
 provider: 'claude',
 group: 'Anthropic Claude',
 });
 }
 }
 // Sort: newest first (by ID which contains version)
 models.sort((a, b) => b.id.localeCompare(a.id));
 // Limit to top 5 most relevant
 return models.slice(0, 5);
 } catch (err: any) {
 console.error('[AI Models] Anthropic fetch failed:', err.message);
 return FALLBACK_MODELS.filter(m => m.provider === 'claude');
 }
}

async function fetchOpenAIModels(): Promise<AIModel[]> {
 if (!OPENAI_API_KEY) return [];
 try {
 const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
 const response = await openai.models.list();
 
 const models: AIModel[] = [];
 for (const m of response.data) {
 // Only include GPT chat models with vision
 if ((m.id.startsWith('gpt-') || m.id.startsWith('o')) && 
 !m.id.includes('realtime') && 
 !m.id.includes('audio') &&
 !m.id.includes('search') &&
 !m.id.includes('instruct') &&
 !m.id.includes('tts') &&
 !m.id.includes('whisper') &&
 !m.id.includes('davinci') &&
 !m.id.includes('babbage') &&
 !m.id.includes('embedding') &&
 !m.id.includes('moderation') &&
 !m.id.includes('dall-e') &&
 !m.id.includes('oss') &&
 !m.id.includes('codex')
 ) {
 models.push({
 id: m.id,
 name: formatModelName(m.id),
 provider: 'openai',
 group: 'OpenAI',
 });
 }
 }
 // Sort by created date (newest first)
 models.sort((a, b) => b.id.localeCompare(a.id));
 // Limit to top 6
 return models.slice(0, 6);
 } catch (err: any) {
 console.error('[AI Models] OpenAI fetch failed:', err.message);
 return FALLBACK_MODELS.filter(m => m.provider === 'openai');
 }
}

async function fetchGeminiModels(): Promise<AIModel[]> {
 if (!GEMINI_API_KEY) return [];
 try {
 // Google AI API - list models
 const res = await fetch(
 `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
 );
 if (!res.ok) throw new Error(`Gemini API: ${res.status}`);
 const data = await res.json();
 
 const models: AIModel[] = [];
 for (const m of data.models || []) {
 const id = m.name?.replace('models/', '') || '';
 // Only include generateContent-capable Gemini models
 if (id.startsWith('gemini-') && 
 m.supportedGenerationMethods?.includes('generateContent') &&
 !id.includes('embedding') &&
 !id.includes('aqa') &&
 !id.includes('image')
 ) {
 models.push({
 id,
 name: m.displayName || formatModelName(id),
 provider: 'gemini',
 group: 'Google Gemini',
 });
 }
 }
 // Sort newest first
 models.sort((a, b) => b.id.localeCompare(a.id));
 // Limit to top 5
 return models.slice(0, 5);
 } catch (err: any) {
 console.error('[AI Models] Gemini fetch failed:', err.message);
 return FALLBACK_MODELS.filter(m => m.provider === 'gemini');
 }
}

// In-memory cache
let cachedModels: AIModel[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week in ms

export async function GET() {
 const now = Date.now();
 
 // Return cache if fresh
 if (cachedModels && (now - cacheTimestamp) < CACHE_DURATION) {
 return NextResponse.json({ models: cachedModels, cached: true });
 }
 
 try {
 const [claudeModels, openaiModels, geminiModels] = await Promise.all([
 fetchAnthropicModels(),
 fetchOpenAIModels(),
 fetchGeminiModels(),
 ]);
 
 const allModels = [...claudeModels, ...openaiModels, ...geminiModels];
 
 // Update cache
 if (allModels.length > 0) {
 cachedModels = allModels;
 cacheTimestamp = now;
 }
 
 return NextResponse.json({ 
 models: allModels.length > 0 ? allModels : FALLBACK_MODELS,
 cached: false,
 lastUpdated: new Date().toISOString(),
 });
 } catch (err: any) {
 console.error('[AI Models] Failed to fetch models:', err.message);
 return NextResponse.json({ 
 models: cachedModels || FALLBACK_MODELS, 
 cached: true,
 error: err.message,
 });
 }
}
