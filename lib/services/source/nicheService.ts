import { supabase } from "@/lib/supabase";

export interface NicheDTO {
    id: string;
    label: string;
    slug: string;
    description: string;
}

/**
 * Lấy danh sách Ngách và map sang cấu trúc Frontend cần
 */
export async function getAllNiches(): Promise<NicheDTO[]> {
    // Query DB lấy: id, name, description
    const { data, error } = await supabase
        .from("niches")
        .select("id, name, description, slug")
        .order("id", { ascending: true });

    if (error) {
        console.error("[db/niches] Error getting niches:", error.message);
        return [];
    }

    return (data || []).map((item) => ({
        id: item.id,
        label: item.name,
        slug: item.slug,
        description: item.description || ""
    }));
}