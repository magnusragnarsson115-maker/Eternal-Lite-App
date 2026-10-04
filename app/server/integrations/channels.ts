import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { config } from '../config.js';
import { fetchWithTimeout } from '../lib/util.js';
import { getSetting, setSetting } from '../settings.js';

/**
 * Kanały dostarczania powiadomień. Treść wysyłana poza aplikację (e-mail, SMS, push)
 * nigdy nie zawiera danych o stanie zdrowia — tylko informację, że coś czeka w aplikacji.
 */

export class ChannelNotConfigured extends Error {
  constructor(channel: string) {
    super(`${channel}: provider not configured`);
  }
}

// --- e-mail (dowolny serwer SMTP) ---------------------------------------------------------------

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

export function emailConfigured(): boolean {
  return !!config.mail.smtpUrl;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!config.mail.smtpUrl) throw new ChannelNotConfigured('email');
  transporter ??= nodemailer.createTransport(config.mail.smtpUrl);
  await transporter.sendMail({ from: config.mail.from, to, subject, text });
}

export async function verifyEmailTransport(): Promise<{ ok: boolean; detail: string }> {
  if (!config.mail.smtpUrl) return { ok: false, detail: 'SMTP_URL nie ustawiony' };
  try {
    transporter ??= nodemailer.createTransport(config.mail.smtpUrl);
    await transporter.verify();
    return { ok: true, detail: 'Połączenie SMTP poprawne' };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

// --- SMS (SMSAPI.pl albo własny webhook bramki) ---------------------------------------------------

export function smsConfigured(): boolean {
  return (config.sms.provider === 'smsapi' && !!config.sms.smsapiToken) || (config.sms.provider === 'webhook' && !!config.sms.webhookUrl);
}

export function normalizePolishPhone(phone: string): string | undefined {
  const digits = phone.replace(/[^\d+]/g, '');
  if (/^\+48\d{9}$/.test(digits)) return digits.slice(1);
  if (/^48\d{9}$/.test(digits)) return digits;
  if (/^\d{9}$/.test(digits)) return `48${digits}`;
  if (/^\+\d{8,15}$/.test(digits)) return digits.slice(1);
  return undefined;
}

export async function sendSms(to: string, message: string): Promise<void> {
  const number = normalizePolishPhone(to);
  if (!number) throw new Error('invalid_phone');
  if (config.sms.provider === 'smsapi' && config.sms.smsapiToken) {
    const res = await fetchWithTimeout('https://api.smsapi.pl/sms.do', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.sms.smsapiToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ to: number, message, from: config.sms.sender, format: 'json', encoding: 'utf-8' }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: number; message?: string };
    if (!res.ok || json.error) throw new Error(`SMSAPI: ${json.message ?? res.status}`);
    return;
  }
  if (config.sms.provider === 'webhook' && config.sms.webhookUrl) {
    const res = await fetchWithTimeout(config.sms.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: number, message, sender: config.sms.sender }),
    });
    if (!res.ok) throw new Error(`SMS webhook: ${res.status}`);
    return;
  }
  throw new ChannelNotConfigured('sms');
}

// --- Web Push (VAPID, standard W3C — bez opłat i bez zewnętrznego konta) ---------------------------------

let vapid: { publicKey: string; privateKey: string } | undefined;

export function getVapidKeys(): { publicKey: string; privateKey: string } {
  if (vapid) return vapid;
  if (config.push.vapidPublicKey && config.push.vapidPrivateKey) {
    vapid = { publicKey: config.push.vapidPublicKey, privateKey: config.push.vapidPrivateKey };
  } else {
    vapid = getSetting<{ publicKey: string; privateKey: string }>('vapid');
    if (!vapid) {
      vapid = webpush.generateVAPIDKeys();
      setSetting('vapid', vapid);
    }
  }
  webpush.setVapidDetails(config.push.subject, vapid.publicKey, vapid.privateKey);
  return vapid;
}

export class PushGone extends Error {}

export async function sendPush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: object): Promise<void> {
  getVapidKeys();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 3600, urgency: 'normal' });
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) throw new PushGone('subscription expired');
    throw err;
  }
}
