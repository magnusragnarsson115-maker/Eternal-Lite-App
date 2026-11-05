import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Teleporady przez Jitsi Meet (open source). Pokój = losowy identyfikator 128-bit przypisany do wizyty.
 * Produkcyjnie: własna instancja Jitsi (JITSI_DOMAIN) z uwierzytelnianiem JWT (JITSI_APP_ID/SECRET),
 * hostowana w EOG, z umową powierzenia. Publiczny meet.jit.si — wyłącznie do testów.
 */

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signJitsiJwt(room: string, user: { name: string; id: string; moderator: boolean }, ttlSeconds = 3 * 3600): string | undefined {
  if (!config.jitsi.appId || !config.jitsi.appSecret) return undefined;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    aud: 'jitsi',
    iss: config.jitsi.appId,
    sub: config.jitsi.domain,
    room,
    iat: now,
    nbf: now - 60,
    exp: now + ttlSeconds,
    context: { user: { id: user.id, name: user.name }, features: { recording: false, livestreaming: false } },
    moderator: user.moderator,
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.createHmac('sha256', config.jitsi.appSecret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export interface TeleJoinInfo {
  domain: string;
  room: string;
  url: string;
  jwt?: string;
  publicServer: boolean;
}

export function teleJoinInfo(roomId: string, user: { name: string; id: string; moderator: boolean }): TeleJoinInfo {
  const room = `eternal-${roomId}`;
  const jwt = signJitsiJwt(room, user);
  const config_ = [
    'config.prejoinConfig.enabled=true',
    'config.disableDeepLinking=true',
    'config.fileRecordingsEnabled=false',
    'config.liveStreamingEnabled=false',
    `userInfo.displayName="${encodeURIComponent(user.name)}"`,
  ].join('&');
  const url = `https://${config.jitsi.domain}/${room}${jwt ? `?jwt=${jwt}` : ''}#${config_}`;
  return { domain: config.jitsi.domain, room, url, jwt, publicServer: config.jitsi.domain === 'meet.jit.si' };
}

/** Okno dołączenia: 15 min przed początkiem do 30 min po końcu wizyty. */
export function teleWindowOpen(start: string, end: string, now = Date.now()): boolean {
  return now >= Date.parse(start) - 15 * 60_000 && now <= Date.parse(end) + 30 * 60_000;
}
