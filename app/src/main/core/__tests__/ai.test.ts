import { describe, expect, it } from 'vitest';
import { buildAnalysisMessages } from '../ai';

describe('buildAnalysisMessages', () => {
  it('system + user, контекст и лог на месте', () => {
    const msgs = buildAnalysisMessages(['[ERROR] boom'], 'inst · 1.21.4 · fabric');
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe('system');
    expect(msgs[0]!.content).toContain('ДИАГНОЗ');
    expect(msgs[1]!.content).toContain('inst · 1.21.4 · fabric');
    expect(msgs[1]!.content).toContain('[ERROR] boom');
  });

  it('берёт только хвост из 120 строк', () => {
    const lines = Array.from({ length: 500 }, (_, i) => `line-${i}`);
    const msgs = buildAnalysisMessages(lines, 'ctx');
    expect(msgs[1]!.content).not.toContain('line-379');
    expect(msgs[1]!.content).toContain('line-380');
    expect(msgs[1]!.content).toContain('line-499');
  });

  it('формат ответа задан в system-промпте', () => {
    const sys = buildAnalysisMessages([], '')[0]!.content;
    for (const part of ['ДИАГНОЗ', 'ПРИЧИНА', 'РЕШЕНИЕ', 'по-русски']) {
      expect(sys).toContain(part);
    }
  });
});
