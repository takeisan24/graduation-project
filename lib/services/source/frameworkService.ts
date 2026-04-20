import { supabase } from "@/lib/supabase";

export interface FrameworkDTO {
    id: string;
    title: string;
    slug: string;
    description: string;
    icon_name: string;
    goals: string[];
    niches: string[];
    placeholders: string[];
    
    // --- CÁC TRƯỜNG MỚI ĐỂ FE KHÔNG CẦN CALL LẺ ---
    base_prompt_text: string;
    niche_overrides: Record<string, string>; // { [nicheId]: "Prompt..." }
    goal_overrides: Record<string, string>;  // { [goalId]: "Modifier..." }
}

export async function getFrameworks(
    nicheId?: string | null,
    goalId?: string | null
): Promise<FrameworkDTO[]> {

    // 1. Chuẩn bị Query Frameworks (Lấy thêm base_prompt_text và override của niche)
    let frameworkQuery = supabase.from("frameworks").select(`
        *,
        framework_niches ( niche_id, override_prompt_text )
    `);

    // 2. Apply Filters (Giữ nguyên logic cũ của bạn)
    if (goalId) {
        frameworkQuery = frameworkQuery.contains('goal_ids', [goalId]);
    }

    if (nicheId && nicheId !== 'general') {
        // Dùng !inner để lọc cứng, nhưng vẫn lấy field override_prompt_text
        frameworkQuery = supabase.from("frameworks").select(`
            *,
            framework_niches!inner ( niche_id, override_prompt_text )
        `).eq('framework_niches.niche_id', nicheId);

        if (goalId) frameworkQuery = frameworkQuery.contains('goal_ids', [goalId]);
    }

    // 3. Gọi song song: Lấy Frameworks VÀ Lấy toàn bộ Goals (Để lấy text)
    // content_goals bảng rất nhỏ (< 20 dòng) nên fetch hết rất nhanh
    const [fwRes, goalsRes] = await Promise.all([
        frameworkQuery,
        supabase.from("content_goals").select("id, prompt_modifier_text")
    ]);

    if (fwRes.error) {
        console.error("[db/frameworks] Error fetching frameworks:", fwRes.error.message);
        return [];
    }

    // 4. Tạo Map cho Goals (Biến đổi Array -> Object để tra cứu nhanh)
    // Kết quả: { "goal_viral": "Hãy viết giọng hài hước...", "goal_sales": "..." }
    const goalTextMap: Record<string, string> = {};
    if (goalsRes.data) {
        goalsRes.data.forEach((g: { id: string; prompt_modifier_text?: string }) => {
            goalTextMap[g.id] = g.prompt_modifier_text || "";
        });
    }

    // 5. Map dữ liệu trả về Frontend
    return (fwRes.data || []).map((item: {
        id: string;
        title: string;
        slug: string;
        description: string;
        icon_name: string;
        base_prompt_text?: string;
        placeholders?: string[];
        goal_ids?: string[];
        framework_niches?: { niche_id: string; override_prompt_text?: string }[];
    }) => {
        
        // A. Xử lý Niche Overrides
        const nicheOverrides: Record<string, string> = {};
        const supportedNiches: string[] = [];

        if (item.framework_niches && Array.isArray(item.framework_niches)) {
            item.framework_niches.forEach((fn: { niche_id: string; override_prompt_text?: string }) => {
                supportedNiches.push(fn.niche_id);
                // Chỉ thêm vào map nếu có override text
                if (fn.override_prompt_text) {
                    nicheOverrides[fn.niche_id] = fn.override_prompt_text;
                }
            });
        }

        // B. Xử lý Goal Overrides
        const goalOverrides: Record<string, string> = {};
        const frameworkGoalIds: string[] = item.goal_ids || [];
        
        frameworkGoalIds.forEach((gid) => {
            // Tra cứu text từ goalTextMap đã fetch ở bước 3
            if (goalTextMap[gid]) {
                goalOverrides[gid] = goalTextMap[gid];
            }
        });

        return {
            id: item.id,
            title: item.title,
            description: item.description,
            icon_name: item.icon_name,
            slug: item.slug,
            
            goals: frameworkGoalIds,
            niches: supportedNiches,
            placeholders: item.placeholders || [],
            
            // Dữ liệu Prompting
            base_prompt_text: item.base_prompt_text || "",
            niche_overrides: nicheOverrides, // FE chỉ cần: fw.niche_overrides[nicheId]
            goal_overrides: goalOverrides    // FE chỉ cần: fw.goal_overrides[goalId]
        };
    });
}