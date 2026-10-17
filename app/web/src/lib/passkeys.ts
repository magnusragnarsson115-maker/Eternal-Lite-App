import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { post } from '../api';
import type { Me } from '../types';

/** Klucze dostępu i klucze sprzętowe (WebAuthn): rejestracja, logowanie pacjenta, drugi składnik personelu. */

export const passkeysSupported = (): boolean => browserSupportsWebAuthn();

export async function registerPasskey(label?: string): Promise<{ me: Me }> {
  const { flowId, options } = await post<{ flowId: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>('/api/auth/webauthn/register/options');
  const response = await startRegistration({ optionsJSON: options });
  return post<{ me: Me }>('/api/auth/webauthn/register/verify', { flowId, response, label });
}

export async function loginWithPasskey(): Promise<Me> {
  const { flowId, options } = await post<{ flowId: string; options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }>('/api/auth/webauthn/login/options');
  const response = await startAuthentication({ optionsJSON: options });
  return post<Me>('/api/auth/webauthn/login/verify', { flowId, response });
}

export async function securityKeySecondFactor(): Promise<Me> {
  const { flowId, options } = await post<{ flowId: string; options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }>('/api/auth/mfa/webauthn/options');
  const response = await startAuthentication({ optionsJSON: options });
  return post<Me>('/api/auth/mfa/webauthn/verify', { flowId, response });
}
