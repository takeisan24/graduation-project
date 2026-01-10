// check-models.js
const dotenv = require('dotenv');

// Load API Key
dotenv.config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ Lỗi: Chưa có GEMINI_API_KEY trong file .env.local");
    process.exit(1);
}

async function listModels() {
    console.log("🔄 Đang lấy danh sách models từ Google...");
    console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || response.statusText);
        }

        console.log("\n✅ DANH SÁCH CÁC MODEL KHẢ DỤNG CHO BẠN:\n");

        // Lọc ra các model có khả năng tạo ảnh hoặc vision
        const models = data.models || [];
        
        models.forEach(model => {
            // In ra tên và các phương thức hỗ trợ
            console.log(`--------------------------------------------------`);
            console.log(`Name (ID): \x1b[32m${model.name.replace('models/', '')}\x1b[0m`); // Tô xanh ID
            console.log(`Display Name: ${model.displayName}`);
            console.log(`Methods: ${model.supportedGenerationMethods.join(', ')}`);
            
            // Highlight model tạo ảnh
            if (model.supportedGenerationMethods.includes('predict') || 
                model.supportedGenerationMethods.includes('imageGeneration')) {
                console.log("👉 \x1b[33mĐÂY LÀ MODEL TẠO ẢNH (Imagen)\x1b[0m");
            }
        });

        console.log("\n--------------------------------------------------");

    } catch (error) {
        console.error("❌ Lỗi khi gọi API:", error.message);
    }
}

listModels();