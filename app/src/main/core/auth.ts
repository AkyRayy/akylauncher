import { createHash } from 'node:crypto';

export function offlineUuid(nickname: string): string {
  const hash = createHash('md5').update(`OfflinePlayer:${nickname}`, 'utf8').digest();
  hash[6] = (hash[6]! & 0x0f) | 0x30;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');
}

export function validNickname(nickname: string): boolean {
  return /^[A-Za-z0-9_]{3,16}$/.test(nickname);
}

export interface Session {
  nickname: string;
  uuid: string;
  accessToken: string;
  userType: 'legacy';
}

export function offlineSession(nickname: string): Session {
  return {
    nickname,
    uuid: offlineUuid(nickname),
    accessToken: '0',
    userType: 'legacy'
  };
}
