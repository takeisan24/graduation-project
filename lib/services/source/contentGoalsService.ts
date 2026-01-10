import { supabase } from "@/lib/supabase";

export interface ContentGoalDTO {
    id: string;
    label: string;
    slug: string;
    description: string;
}

/**
 * Lấy danh sách Ngách và map sang cấu trúc Frontend cần
 */
export async function getAllContentGoal(): Promise<ContentGoalDTO[]> {
    const { data, error } = await supabase
        .from("content_goals")
        .select("id, name, prompt_modifier_text, slug")
        .order("id", { ascending: true });

    if (error) {
        console.error("[db/niches] Error getting niches:", error.message);
        return [];
    }

    return (data || []).map((item) => ({
        id: item.id,
        label: item.name,
        slug : item.slug,
        description: item.prompt_modifier_text || ""
    }));
}