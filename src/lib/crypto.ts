// Using browser built-in SubtleCrypto for encryption
// This is used to encrypt sensitive keys like GitHub Token and OpenAI Key in IndexedDB

const ALGO = 'AES-GCM';

async function getEncryptionKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('gtbook-salt-2026'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(text: string, password: string): Promise<string> {
  const key = await getEncryptionKey(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoded
  );
  
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...result));
}

export async function decrypt(base64: string, password: string): Promise<string> {
  try {
    const key = await getEncryptionKey(password);
    const data = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGO, iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    throw new Error('Decryption failed');
  }
}
