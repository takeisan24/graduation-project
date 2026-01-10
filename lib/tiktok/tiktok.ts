export async function fetchTikTokMetadata(url: string) {
  try {
    // Sử dụng API public của TikWM để lấy thông tin
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.code === 0 && data.data) {
      return {
        title: data.data.title || "Không có tiêu đề",
        duration: data.data.duration,
        cover: data.data.cover,
        stats: {
          views: data.data.play_count,
          likes: data.data.digg_count
        },
        videoUrl: data.data.hdplay || data.data.play || null
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching TikTok metadata:", error);
    return null;
  }
}