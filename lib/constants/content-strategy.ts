// lib/constants/content-strategy.ts

import { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { getAppUrl } from '@/lib/utils/urlConfig';

// --- Types (Giữ nguyên) ---
export interface ContentGoal { id: string; label: string; slug: string; description: string; }
export interface Niche { id: string; label: string; slug: string; description: string; }
export interface Framework {
  id: string; title: string; slug: string; description: string; icon: LucideIcon;
  goals: string[]; niches: string[]; placeholders: string[];
  base_prompt_text?: string; niche_overrides?: Record<string, string>; goal_overrides?: Record<string, string>;
}

// --- CẤU HÌNH CACHE MỚI (GỘP) ---
const CACHE_KEY = 'omnia_strategy_config';
const CACHE_TTL = 60 * 60 * 1000; // 1 Giờ

// Interface cho cục data tổng
interface StrategyConfig {
  goals: ContentGoal[];
  niches: Niche[];
  frameworks: any[]; // Raw data chưa map icon
}

// Memory Cache
let MEMORY_CACHE: StrategyConfig | null = null;
let fetchPromise: Promise<StrategyConfig> | null = null;

// Helper: LocalStorage
const getLocalCache = (): StrategyConfig | null => {
  if (typeof window === 'undefined') return null;
  try {
    const itemStr = localStorage.getItem(CACHE_KEY);
    if (!itemStr) return null;
    const item = JSON.parse(itemStr);
    if (new Date().getTime() > item.expiry) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return item.value;
  } catch { return null; }
};

// Helper: Map Icon (Giữ nguyên logic cũ)
const mapIconData = (rawData: any[]): Framework[] => {
  return rawData.map((item: any) => ({
    ...item,
    icon: (LucideIcons as any)[(item.icon_name || '').trim()] || LucideIcons.Zap,
  }));
};

// --- HÀM FETCH CHÍNH (GỘP) ---
async function fetchStrategyConfig(): Promise<StrategyConfig> {
  // 1. Check Memory
  if (MEMORY_CACHE) return MEMORY_CACHE;

  // 2. Check Promise (deduplicate requests)
  if (fetchPromise) return fetchPromise;

  // 3. Check LocalStorage
  const localData = getLocalCache();
  if (localData) {
    MEMORY_CACHE = localData;
    return localData;
  }

  // 4. Fetch API
  fetchPromise = (async () => {
    try {
      // GỌI 1 API DUY NHẤT
      const appUrl = getAppUrl();
      const res = await fetch(`${appUrl}/api/v1/strategy-config`, { cache: 'no-store' });
      if (!res.ok) throw new Error("Failed to fetch strategy config");
      const json = await res.json();

      const data = json.data || { goals: [], niches: [], frameworks: [] };

      // Update Cache
      MEMORY_CACHE = data;
      if (typeof window !== 'undefined') {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          value: data,
          expiry: new Date().getTime() + CACHE_TTL
        }));
      }
      return data;
    } catch (error) {
      console.error("Strategy Config Fetch Error:", error);
      return { goals: [], niches: [], frameworks: [] };
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

// --- EXPORT CÁC HÀM CŨ (ĐỂ KHÔNG PHÁ VỠ CODE UI) ---
// Các hàm này giờ chỉ đơn giản là gọi hàm tổng rồi lấy phần dữ liệu cần thiết

export async function fetchContentGoals(): Promise<ContentGoal[]> {
  const config = await fetchStrategyConfig();
  return config.goals;
}

export async function fetchNiches(): Promise<Niche[]> {
  const config = await fetchStrategyConfig();
  return config.niches;
}

export async function fetchFrameworks(goalId?: string, nicheId?: string): Promise<Framework[]> {
  // 1. Lấy dữ liệu tổng từ Cache/API
  const config = await fetchStrategyConfig();
  const allFrameworks = mapIconData(config.frameworks);

  // 2. LOGIC KIỂM TRA ĐIỀU KIỆN (Logic Cũ)
  // Nếu thiếu Goal HOẶC thiếu Niche -> Trả về rỗng để bắt người dùng chọn đủ.
  // Điều này giúp Prompt AI sau này không bị lỗi thiếu context.
  if (!goalId || !nicheId) {
    return [];
  }

  // 3. LOGIC LỌC (Filter)
  const result = allFrameworks.filter(fw => {
    // Kiểm tra xem Framework này có hỗ trợ Goal đang chọn không?
    const matchGoal = goalId ? (fw.goals?.includes(goalId)) : true;

    // Kiểm tra xem Framework này có hỗ trợ Niche đang chọn không?
    const matchNiche = nicheId ? (fw.niches?.includes(nicheId)) : true;

    // Framework phải thỏa mãn CẢ HAI điều kiện
    return matchGoal && matchNiche;
  });

  // 4. Lưu cache item đầu tiên (để UI có thể auto-select hoặc preview nếu cần)
  if (result.length > 0) {
    if (typeof window !== 'undefined') {
      localStorage.setItem("selectedData", JSON.stringify(result[0]));
    }
  }

  return result;
}

export async function getFrameworkById(id: string): Promise<Framework | undefined> {
  const config = await fetchStrategyConfig();
  return mapIconData(config.frameworks).find(f => f.id === id);
}