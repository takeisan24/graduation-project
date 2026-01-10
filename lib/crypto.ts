import crypto from "crypto";

// 1. Lấy Key từ biến môi trường, fallback nếu thiếu
const RAW_KEY = process.env.ENCRYPTION_KEY || "omnia-fallback-secret-key-change-me";

// 2. QUAN TRỌNG: Hash key bằng SHA-256 để luôn đảm bảo có đúng 32 bytes (256 bits)
// Việc này giúp tránh lỗi "Invalid key length" bất kể độ dài của RAW_KEY là bao nhiêu
const ENC_KEY = crypto.createHash('sha256').update(String(RAW_KEY)).digest(); 

const IV_LENGTH = 16; // AES block size

export function encryptToken(text: string): string {
  if (!text) return "";
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", ENC_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch (error) {
    console.error("[Crypto] Encrypt error:", error);
    return text; // Fallback: return raw text if encrypt fails (dev mode)
  }
}

export function decryptToken(text: string): string {
  if (!text) return "";
  try {
    const textParts = text.split(":");
    // Kiểm tra format có đúng là iv:content không
    if (textParts.length !== 2) {
        // Nếu không đúng format (có thể là token cũ chưa mã hóa), trả về nguyên gốc
        return text;
    }
    
    const ivHex = textParts.shift();
    const encryptedHex = textParts.join(":");
    
    if (!ivHex || !encryptedHex) return text;

    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(encryptedHex, "hex");
    
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENC_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    console.error("[Crypto] Decrypt error:", error);
    return text; // Fallback: return original text if decrypt fails
  }
}