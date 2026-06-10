import { z } from 'zod';
import { getSettings } from './settings';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = 'llama-3.3-70b-versatile';

const ChatRespSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1)
});

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export function buildAnalysisMessages(lines: string[], context: string): ChatMessage[] {
  const tail = lines.slice(-120);
  return [
    {
      role: 'system',
      content: [
        'Ты — встроенный диагност Minecraft-лаунчера AkyLauncher.',
        'Тебе дают хвост лога запуска/игры. Найди причину проблемы и дай решение.',
        'Формат ответа — строго:',
        'ДИАГНОЗ: одна строка — что сломалось.',
        'ПРИЧИНА: 1-2 строки — почему.',
        'РЕШЕНИЕ: нумерованные шаги, максимум 5, каждый — конкретное действие.',
        'Пиши по-русски, коротко, без эмодзи и без воды.',
        'Если лог чистый и ошибок нет — так и скажи одной строкой.',
        'Частые случаи: несовместимость версий модов и игры, нехватка RAM (OutOfMemoryError),',
        'неправильная версия Java (UnsupportedClassVersionError), отсутствие Fabric API,',
        'конфликты модов (Mixin apply failed), битые библиотеки (ClassNotFoundException).'
      ].join('\n')
    },
    {
      role: 'user',
      content: `Контекст: ${context}\n\nЛог:\n${tail.join('\n')}`
    }
  ];
}

export async function analyzeLog(lines: string[], context: string): Promise<string> {
  const settings = await getSettings();
  const key = settings.groqApiKey.trim();
  if (!key) throw new Error('нет api-ключа · настройки → ии');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: buildAnalysisMessages(lines, context),
      temperature: 0.2,
      max_tokens: 700
    })
  });

  if (res.status === 401) throw new Error('ключ отклонён · проверь его в console.groq.com');
  if (res.status === 429) throw new Error('лимит groq исчерпан · попробуй позже');
  if (!res.ok) throw new Error(`groq недоступен · http ${res.status}`);

  const parsed = ChatRespSchema.parse(await res.json());
  return parsed.choices[0]!.message.content.trim();
}
