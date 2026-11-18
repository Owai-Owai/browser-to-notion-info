const encoder = new TextEncoder();
const bytes = (value: string) => encoder.encode(value);
const base64 = (value: Uint8Array) => btoa(Array.from(value, byte => String.fromCharCode(byte)).join(""));
const unbase64 = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
export const basicCredential = (value: string) => base64(bytes(value));
export const randomToken = () => base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
export async function hash(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(value))), byte => byte.toString(16).padStart(2,"0")).join(""); }
export async function challenge(value: string) { return base64(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(value)))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }

/** AES-256-GCM uses the existing IV + tag + ciphertext format for future portability. */
export function tokenEncryption(secret: string) {
  if (!/^[a-f\d]{64}$/i.test(secret)) throw new Error("Configure a 64-character hexadecimal encryption key.");
  const key = crypto.subtle.importKey("raw", Uint8Array.from(secret.match(/../g)!, byte => parseInt(byte,16)), "AES-GCM", false, ["encrypt","decrypt"]);
  return {
    async encrypt(value: unknown): Promise<string> {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key, bytes(JSON.stringify(value))));
      const output = new Uint8Array(iv.length + encrypted.length);
      output.set(iv); output.set(encrypted.subarray(-16),12); output.set(encrypted.subarray(0,-16),28);
      return base64(output);
    },
    async decrypt(value: string): Promise<unknown> {
      const input = unbase64(value);
      if (input.length < 28) throw new Error("The stored credentials could not be read.");
      const encrypted = new Uint8Array(input.length - 12);
      encrypted.set(input.subarray(28)); encrypted.set(input.subarray(12,28), input.length-28);
      const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: input.subarray(0,12) }, await key, encrypted);
      return JSON.parse(new TextDecoder().decode(clear));
    },
  };
}
