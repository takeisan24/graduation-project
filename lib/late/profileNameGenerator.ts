import { supabase } from "@/lib/supabase";

/**
 * Generate a random alphanumeric string of specified length
 * @param length - Length of the random string
 * @returns Random string containing uppercase letters and numbers
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate profile name in format: PN_{số thứ tự theo profile db}_{chuỗi random 7 ký tự}
 * Example: PN_31_7NDFS3M
 * 
 * @returns Profile name string
 */
export async function generateProfileName(): Promise<string> {
  try {
    // Get the total count of profiles in database
    const { count, error } = await supabase
      .from("getlate_profiles")
      .select("*", { count: 'exact', head: true });

    if (error) {
      console.error("[profileNameGenerator] Error counting profiles:", error);
      // Fallback: use timestamp-based number if count fails
      const fallbackNumber = Math.floor(Date.now() / 1000) % 10000;
      const randomStr = generateRandomString(7);
      return `PN_${fallbackNumber}_${randomStr}`;
    }

    // Next profile number = current count + 1
    const nextProfileNumber = (count || 0) + 1;
    
    // Generate random 7-character string
    const randomStr = generateRandomString(7);
    
    // Format: PN_{number}_{random}
    return `PN_${nextProfileNumber}_${randomStr}`;
  } catch (err: any) {
    console.error("[profileNameGenerator] Error generating profile name:", err);
    // Fallback: use timestamp-based number
    const fallbackNumber = Math.floor(Date.now() / 1000) % 10000;
    const randomStr = generateRandomString(7);
    return `PN_${fallbackNumber}_${randomStr}`;
  }
}

