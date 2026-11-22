import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  ApprovedMemory,
  CompanionLanguage,
  CompanionMode,
} from './src/types/shongi.ts';
import {
  buildCompanionSystemInstruction,
  detectCompanionLanguage,
  isNoiseOnlyTranscript,
  sanitizeChatHistory,
  stripMarkdownForSpeech,
} from './src/utils/shongiLogic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string; retryable: boolean } {
  const raw = err instanceof Error ? err.message : String(err);
  let extracted = raw;

  try {
    const outer = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (outer?.error?.message) {
      extracted = outer.error.message;
      try {
        const inner = JSON.parse(extracted) as { error?: { message?: string; code?: number } };
        if (inner?.error?.message) {
          extracted = inner.error.message;
        }
      } catch {
        // Inner message is plain text
      }
    }
  } catch {
    // Outer message is plain text
  }

  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      retryable: false,
      message: 'Please check your GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      retryable: true,
      message: 'Rate limit reached right now. Please wait a moment and try again.',
    };
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return {
      status: 503,
      retryable: true,
      message: 'SHONGI is experiencing high demand right now. Please tap Try Again in a moment.',
    };
  }
  return {
    status: 500,
    retryable: false,
    message: extracted || 'Unable to reach Gemini right now. Please try again.',
  };
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const info = formatGeminiError(err);
      if (!info.retryable || attempt >= maxRetries) {
        throw err;
      }
      const delayMs =
        info.status === 429 ? 900 * (attempt + 1) : 450 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt += 1;
    }
  }
}

interface StreamRequestBody {
  message?: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  mode?: CompanionMode;
  memories?: ApprovedMemory[];
  isVoiceTurn?: boolean;
}

interface TranscribeRequestBody {
  audioBase64?: string;
  mimeType?: string;
}

interface TtsRequestBody {
  text?: string;
  language?: CompanionLanguage;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Streaming empathetic Gemini response (word/chunk SSE)
  app.post('/api/companion/stream', async (req, res) => {
    const body = (req.body ?? {}) as StreamRequestBody;
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!message) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to enable live Gemini streaming.',
      });
      return;
    }

    const mode: CompanionMode =
      body.mode === 'reflection' || body.mode === 'action' ? body.mode : 'listening';
    const memories = Array.isArray(body.memories) ? body.memories : [];
    const isVoiceTurn = Boolean(body.isVoiceTurn);
    const targetLanguage = detectCompanionLanguage(message);
    const systemInstruction = buildCompanionSystemInstruction(
      mode,
      memories,
      targetLanguage,
      isVoiceTurn
    );

    const mappedHistory = sanitizeChatHistory(
      (Array.isArray(body.history) ? body.history : []).slice(-12)
    ).map((item) => ({
      role: item.role,
      parts: [{ text: item.text }],
    }));

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const writeEvent = (payload: Record<string, unknown>) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    let clientAborted = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientAborted = true;
      }
    });

    try {
      writeEvent({ type: 'meta', language: targetLanguage });

      const contents = [
        ...mappedHistory,
        { role: 'user' as const, parts: [{ text: message }] },
      ];

      const openStreamWithModel = async (
        model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite',
        thinkingLevel: ThinkingLevel
      ) =>
        ai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel },
          },
        });

      let streamResponse;
      try {
        streamResponse = await withRetry(
          () => openStreamWithModel('gemini-4-hydrogen', ThinkingLevel.LOW),
          1
        );
      } catch (primaryErr) {
        const info = formatGeminiError(primaryErr);
        if (info.status === 429 || info.status === 503) {
          streamResponse = await withRetry(
            () => openStreamWithModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL),
            1
          );
        } else {
          throw primaryErr;
        }
      }

      let emittedChars = 0;
      for await (const chunk of streamResponse) {
        if (clientAborted) break;
        if (chunk.text) {
          emittedChars += chunk.text.length;
          writeEvent({ type: 'chunk', text: chunk.text });
        }
      }

      if (!clientAborted) {
        if (emittedChars === 0) {
          writeEvent({
            type: 'error',
            message: 'SHONGI could not generate a reply right now. Please tap Try Again.',
          });
        } else {
          writeEvent({ type: 'done', language: targetLanguage });
        }
      }
      if (!res.writableEnded) {
        res.end();
      }
    } catch (err) {
      if (!clientAborted && !res.writableEnded) {
        const formatted = formatGeminiError(err);
        writeEvent({ type: 'error', message: formatted.message });
        res.end();
      }
    }
  });

  // Voice transcription (listen) using gemini-3.5-transcribe
  app.post('/api/companion/transcribe', async (req, res) => {
    const body = (req.body ?? {}) as TranscribeRequestBody;
    const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64.trim() : '';
    const rawMime = typeof body.mimeType === 'string' ? body.mimeType.trim() : 'audio/webm';
    const mimeType = rawMime.split(';')[0].trim() || 'audio/webm';

    if (!audioBase64) {
      res.status(400).json({ error: 'Audio payload is required.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to enable voice transcription.',
      });
      return;
    }

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
              {
                text: 'Transcribe the human speech accurately. Write Bengali in Bengali script if spoken in Bengali, or English if spoken in English. If there is only silence, background noise, or no clear speech, return an empty string. Return only the clean transcription.',
              },
            ],
          },
        })
      );

      const rawText = response.text?.trim() ?? '';
      res.json({ text: isNoiseOnlyTranscript(rawText) ? '' : rawText });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Voice reply (talk / TTS) using gemini-3.8-flash-lite-tts
  app.post('/api/companion/tts', async (req, res) => {
    const body = (req.body ?? {}) as TtsRequestBody;
    const rawText = typeof body.text === 'string' ? body.text.trim() : '';
    const text = stripMarkdownForSpeech(rawText);

    if (!text) {
      res.status(400).json({ error: 'Text is required for speech synthesis.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to enable SHONGI voice replies.',
      });
      return;
    }

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text,
                  speechMetadata: {
                    style: 'Natural, warm, conversational human friend, gentle pacing',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        })
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Voice model returned an empty audio response.' });
        return;
      }

      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const distDir = path.resolve(__dirname, 'dist');
  const isDev = process.env.NODE_ENV === 'development' || !fs.existsSync(path.join(distDir, 'index.html'));

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SHONGI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SHONGI server:', err);
  process.exit(1);
});
