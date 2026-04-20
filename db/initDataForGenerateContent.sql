
-- A. INSERT NICHES
INSERT INTO niches (slug, name) VALUES
('real-estate', 'Bất động sản (Real Estate)'),
('accommodation', 'Lưu trú (Travel/Lifestyle)'),
('interior-construction', 'Nội thất & Xây dựng'),
('furniture-materials', 'Bán đồ nội thất'),
('home-appliances', 'Đồ gia dụng & Nhà bếp'),
('fashion', 'Thời trang (Fashion)'),
('beauty-spa', 'Làm đẹp & Spa (Beauty)'),
('cosmetics', 'Mỹ phẩm (Beauty)'),
('travel', 'Du lịch (Travel)'),
('media-design', 'Media & Design (Tech/Creative)'),
('online-course', 'Giáo dục (Education)'),
('nutrition', 'Dinh dưỡng & Fitness'),
('fb-restaurant', 'F&B (Food)');

-- B. INSERT CONTENT GOALS
INSERT INTO content_goals (slug, name, prompt_modifier_text) VALUES
('trust', 'Trust (Xây dựng niềm tin)', 'Tập trung vào sự chuyên nghiệp, minh bạch, dữ liệu thực tế và trải nghiệm chân thật.'),
('viral', 'Viral (Lan truyền nhanh)', 'Sử dụng yếu tố kịch tính, bắt trend, gây tranh luận hoặc cảm xúc mạnh (bất ngờ, hài hước).'),
('sales', 'Sales (Thúc đẩy chuyển đổi)', 'Tập trung vào lợi ích (Benefit), sự khan hiếm (Urgency) và giải pháp cho nỗi đau của khách hàng.'),
('education', 'Education (Giáo dục)', 'Giải thích đơn giản hóa các khái niệm phức tạp, quy trình từng bước rõ ràng.'),
('branding', 'Branding (Thương hiệu)', 'Kể chuyện (Storytelling) về giá trị cốt lõi và sứ mệnh.');

-- C. INSERT FRAMEWORKS 
INSERT INTO frameworks (slug, title, description, icon_name, goal_ids, base_prompt_text, placeholders) VALUES

-- 1. EXPERT KNOWLEDGE (Trust, Education, Branding)
('expert-knowledge', 'Expert Tips & Tricks', 'Chia sẻ kiến thức chuyên môn và mẹo hay từ kinh nghiệm thực tế.', 
'Lightbulb',
ARRAY[
    (SELECT id FROM content_goals WHERE slug = 'trust'), 
    (SELECT id FROM content_goals WHERE slug = 'education'),
    (SELECT id FROM content_goals WHERE slug = 'branding')
],
$$Đóng vai một chuyên gia trong lĩnh vực này. Hãy viết bài chia sẻ mẹo chuyên gia về chủ đề được yêu cầu. Nội dung cần thể hiện kinh nghiệm thực tế, đưa ra lời khuyên sâu sắc mà người ngoài ngành ít biết. Giọng văn đáng tin cậy.$$,
ARRAY['Chủ đề', 'Kinh nghiệm thực tế']),

-- 2. AUTHENTIC REVIEW (Trust, Sales, Viral)
('authentic-review', 'Customer Review', 'Đánh giá trung thực từ góc nhìn khách hàng thực tế.',
'Heart',
ARRAY[
    (SELECT id FROM content_goals WHERE slug = 'trust'), 
    (SELECT id FROM content_goals WHERE slug = 'sales'),
    (SELECT id FROM content_goals WHERE slug = 'viral')
],
$$Viết một bài đánh giá (Review) về sản phẩm hoặc dịch vụ dựa trên trải nghiệm thực tế. Tập trung vào cảm nhận trung thực, không quảng cáo sáo rỗng. Nêu rõ những điểm hài lòng và chi tiết đánh giá cụ thể.$$,
ARRAY['Tên sản phẩm/dịch vụ', 'Chi tiết đánh giá']),

-- 3. COMPARISON (Trust, Sales, Education)
('comparison', 'Comparison Guide', 'So sánh các lựa chọn để giúp khách hàng ra quyết định.',
'TrendingUp',
ARRAY[
    (SELECT id FROM content_goals WHERE slug = 'trust'), 
    (SELECT id FROM content_goals WHERE slug = 'sales'),
    (SELECT id FROM content_goals WHERE slug = 'education')
],
$$Hãy viết bài so sánh chi tiết giữa các lựa chọn. Phân tích dựa trên các tiêu chí cụ thể (giá, chất lượng, hiệu quả...). Mục tiêu là giúp người đọc phân vân có thể đưa ra quyết định phù hợp nhất.$$,
ARRAY['Các lựa chọn so sánh', 'Tiêu chí đánh giá']),

-- 4. MISTAKE WARNING (Viral, Education, Trust)
('mistake-warning', 'Myth Busting & Warning', 'Phá bỏ quan niệm sai lầm và đưa ra sự thật, hoặc cảnh báo rủi ro.',
'AlertTriangle',
ARRAY[
    (SELECT id FROM content_goals WHERE slug = 'viral'), 
    (SELECT id FROM content_goals WHERE slug = 'education'),
    (SELECT id FROM content_goals WHERE slug = 'trust')
],
$$Hãy viết bài "Phá bỏ lầm tưởng" về vấn đề được nêu. Chỉ ra tại sao quan niệm này sai lầm và cung cấp sự thật khoa học hoặc thực tế để chứng minh. Tiêu đề cần gây tò mò hoặc tranh luận nhẹ.$$,
ARRAY['Quan niệm sai lầm', 'Sự thật/Giải pháp đúng']),

-- 5. HOW-TO GUIDE (Education, Trust, Branding)
('howto-guide', 'Step-by-Step Tutorial', 'Hướng dẫn từng bước chi tiết về kỹ năng hoặc kiến thức.',
'ListOrdered',
ARRAY[
    (SELECT id FROM content_goals WHERE slug = 'education'), 
    (SELECT id FROM content_goals WHERE slug = 'trust'),
    (SELECT id FROM content_goals WHERE slug = 'branding')
],
$$Hãy viết bài hướng dẫn chi tiết cách thực hiện kỹ năng hoặc công việc theo từng bước (Step-by-step). Đảm bảo ngôn ngữ dễ hiểu, logic, ai đọc cũng làm theo được.$$,
ARRAY['Kỹ năng/Công việc', 'Các bước thực hiện']),

-- 6. STORYTELLING (Viral, Branding, Trust, Sales)
('storytelling', 'Drama & Transformation Story', 'Kể câu chuyện có tình tiết kịch tính hoặc hành trình thay đổi ngoạn mục.',
'BookOpenText',
ARRAY[
    (SELECT id FROM content_goals WHERE slug = 'viral'), 
    (SELECT id FROM content_goals WHERE slug = 'branding'),
    (SELECT id FROM content_goals WHERE slug = 'trust'),
    (SELECT id FROM content_goals WHERE slug = 'sales')
],
$$Hãy viết bài kể chuyện về chủ đề được cung cấp. Bắt đầu bằng một tình tiết kịch tính hoặc một sự kiện bất ngờ để thu hút sự chú ý ngay lập tức. Sau đó dẫn dắt người đọc qua hành trình cảm xúc.$$,
ARRAY['Chủ đề câu chuyện', 'Sự kiện bất ngờ']),

-- 7. TIPS & TRICKS (Viral, Education, Trust)
('tips-tricks', 'Hacks & Tips', 'Mẹo tăng năng suất, tiết kiệm hoặc thủ thuật hữu ích.',
'Zap',
ARRAY[
    (SELECT id FROM content_goals WHERE slug = 'viral'), 
    (SELECT id FROM content_goals WHERE slug = 'education'),
    (SELECT id FROM content_goals WHERE slug = 'trust')
],
$$Hãy chia sẻ các mẹo vặt hoặc phương pháp hack về chủ đề này. Nội dung cần ngắn gọn, súc tích, mang lại giá trị tức thì cho người đọc.$$,
ARRAY['Chủ đề', 'Công cụ/Cách thức hữu ích']),

-- 8. BEFORE AFTER (Viral, Sales, Branding)
('before-after', 'Before & After', 'Thể hiện sự thay đổi ngoạn mục qua hình ảnh hoặc mô tả.',
'ArrowLeftRight',
ARRAY[
    (SELECT id FROM content_goals WHERE slug = 'viral'), 
    (SELECT id FROM content_goals WHERE slug = 'sales'),
    (SELECT id FROM content_goals WHERE slug = 'branding')
],
$$Viết nội dung mô tả sự lột xác "Before & After". Nhấn mạnh sự tương phản giữa trạng thái tồi tệ ban đầu và kết quả tuyệt vời sau đó.$$,
ARRAY['Chủ đề (VD: Làn da, Căn phòng)', 'Mô tả thay đổi']),

-- 9. BEHIND SCENES (Trust, Branding, Sales)
('behind-scenes', 'Behind The Scenes', 'Chia sẻ quy trình làm việc, tạo sự gần gũi và minh bạch.',
'Clapperboard',
ARRAY[
    (SELECT id FROM content_goals WHERE slug = 'trust'), 
    (SELECT id FROM content_goals WHERE slug = 'branding'),
    (SELECT id FROM content_goals WHERE slug = 'sales')
],
$$Hãy viết bài chia sẻ hậu trường về quy trình làm việc. Cho khán giả thấy những góc khuất, sự nỗ lực hoặc quy trình thú vị mà họ thường không được thấy.$$,
ARRAY['Quy trình làm việc', 'Chi tiết hậu trường']),

-- 10. LISTICLE (Viral, Education, Sales)
('listicle', 'Trend Collection / Top List', 'Danh sách tổng hợp theo trend hoặc top list dễ đọc.',
'ListTodo',
ARRAY[
    (SELECT id FROM content_goals WHERE slug = 'viral'),
    (SELECT id FROM content_goals WHERE slug = 'education'),
    (SELECT id FROM content_goals WHERE slug = 'sales')
],
$$Tổng hợp một danh sách (Top List) về chủ đề hoặc trend này. Trình bày dạng liệt kê, bắt trend và khuyến khích người đọc tham gia thảo luận hoặc lưu lại.$$,
ARRAY['Trend/Chủ đề', 'Các mục trong danh sách']);

-- D. INSERT FRAMEWORK NICHES
-- Override Prompt luôn là NULL

INSERT INTO framework_niches (framework_id, niche_id, override_prompt_text) VALUES 
-- 1. REAL ESTATE (Bất động sản)
((SELECT id FROM frameworks WHERE slug = 'expert-knowledge'), (SELECT id FROM niches WHERE slug = 'real-estate'), NULL),
((SELECT id FROM frameworks WHERE slug = 'mistake-warning'), (SELECT id FROM niches WHERE slug = 'real-estate'), NULL),
((SELECT id FROM frameworks WHERE slug = 'comparison'), (SELECT id FROM niches WHERE slug = 'real-estate'), NULL),
((SELECT id FROM frameworks WHERE slug = 'behind-scenes'), (SELECT id FROM niches WHERE slug = 'real-estate'), NULL),
((SELECT id FROM frameworks WHERE slug = 'storytelling'), (SELECT id FROM niches WHERE slug = 'real-estate'), NULL),

-- 2. ACCOMMODATION (Homestay/Hotel)
((SELECT id FROM frameworks WHERE slug = 'storytelling'), (SELECT id FROM niches WHERE slug = 'accommodation'), NULL),
((SELECT id FROM frameworks WHERE slug = 'authentic-review'), (SELECT id FROM niches WHERE slug = 'accommodation'), NULL),
((SELECT id FROM frameworks WHERE slug = 'behind-scenes'), (SELECT id FROM niches WHERE slug = 'accommodation'), NULL),
((SELECT id FROM frameworks WHERE slug = 'listicle'), (SELECT id FROM niches WHERE slug = 'accommodation'), NULL),

-- 3. INTERIOR & CONSTRUCTION (Nội thất & Xây dựng)
((SELECT id FROM frameworks WHERE slug = 'before-after'), (SELECT id FROM niches WHERE slug = 'interior-construction'), NULL),
((SELECT id FROM frameworks WHERE slug = 'expert-knowledge'), (SELECT id FROM niches WHERE slug = 'interior-construction'), NULL),
((SELECT id FROM frameworks WHERE slug = 'comparison'), (SELECT id FROM niches WHERE slug = 'interior-construction'), NULL),
((SELECT id FROM frameworks WHERE slug = 'howto-guide'), (SELECT id FROM niches WHERE slug = 'interior-construction'), NULL),

-- 4. FURNITURE (Bán đồ nội thất)
-- Sửa lỗi: Thay slug='sales' bằng 'listicle' (Top list sản phẩm) để không bị null framework_id
((SELECT id FROM frameworks WHERE slug = 'authentic-review'), (SELECT id FROM niches WHERE slug = 'furniture-materials'), NULL),
((SELECT id FROM frameworks WHERE slug = 'listicle'), (SELECT id FROM niches WHERE slug = 'furniture-materials'), NULL),

-- 5. HOME APPLIANCES (Đồ gia dụng)
((SELECT id FROM frameworks WHERE slug = 'comparison'), (SELECT id FROM niches WHERE slug = 'home-appliances'), NULL),
((SELECT id FROM frameworks WHERE slug = 'authentic-review'), (SELECT id FROM niches WHERE slug = 'home-appliances'), NULL),
((SELECT id FROM frameworks WHERE slug = 'tips-tricks'), (SELECT id FROM niches WHERE slug = 'home-appliances'), NULL),

-- 6. BEAUTY & COSMETICS
((SELECT id FROM frameworks WHERE slug = 'authentic-review'), (SELECT id FROM niches WHERE slug = 'cosmetics'), NULL),
((SELECT id FROM frameworks WHERE slug = 'howto-guide'), (SELECT id FROM niches WHERE slug = 'cosmetics'), NULL),
((SELECT id FROM frameworks WHERE slug = 'mistake-warning'), (SELECT id FROM niches WHERE slug = 'cosmetics'), NULL),
((SELECT id FROM frameworks WHERE slug = 'listicle'), (SELECT id FROM niches WHERE slug = 'cosmetics'), NULL),

-- 7. SPA & BEAUTY SERVICES
((SELECT id FROM frameworks WHERE slug = 'before-after'), (SELECT id FROM niches WHERE slug = 'beauty-spa'), NULL),
((SELECT id FROM frameworks WHERE slug = 'storytelling'), (SELECT id FROM niches WHERE slug = 'beauty-spa'), NULL),
((SELECT id FROM frameworks WHERE slug = 'behind-scenes'), (SELECT id FROM niches WHERE slug = 'beauty-spa'), NULL),

-- 8. FASHION (Thời trang)
((SELECT id FROM frameworks WHERE slug = 'tips-tricks'), (SELECT id FROM niches WHERE slug = 'fashion'), NULL),
((SELECT id FROM frameworks WHERE slug = 'listicle'), (SELECT id FROM niches WHERE slug = 'fashion'), NULL),
((SELECT id FROM frameworks WHERE slug = 'howto-guide'), (SELECT id FROM niches WHERE slug = 'fashion'), NULL),
((SELECT id FROM frameworks WHERE slug = 'before-after'), (SELECT id FROM niches WHERE slug = 'fashion'), NULL),

-- 9. FITNESS & NUTRITION
((SELECT id FROM frameworks WHERE slug = 'expert-knowledge'), (SELECT id FROM niches WHERE slug = 'nutrition'), NULL),
((SELECT id FROM frameworks WHERE slug = 'howto-guide'), (SELECT id FROM niches WHERE slug = 'nutrition'), NULL),
((SELECT id FROM frameworks WHERE slug = 'before-after'), (SELECT id FROM niches WHERE slug = 'nutrition'), NULL),
((SELECT id FROM frameworks WHERE slug = 'mistake-warning'), (SELECT id FROM niches WHERE slug = 'nutrition'), NULL),

-- 10. ONLINE COURSE (Giáo dục)
((SELECT id FROM frameworks WHERE slug = 'storytelling'), (SELECT id FROM niches WHERE slug = 'online-course'), NULL),
((SELECT id FROM frameworks WHERE slug = 'mistake-warning'), (SELECT id FROM niches WHERE slug = 'online-course'), NULL),
((SELECT id FROM frameworks WHERE slug = 'expert-knowledge'), (SELECT id FROM niches WHERE slug = 'online-course'), NULL),
((SELECT id FROM frameworks WHERE slug = 'comparison'), (SELECT id FROM niches WHERE slug = 'online-course'), NULL),

-- 11. TRAVEL (Du lịch)
((SELECT id FROM frameworks WHERE slug = 'listicle'), (SELECT id FROM niches WHERE slug = 'travel'), NULL),
((SELECT id FROM frameworks WHERE slug = 'tips-tricks'), (SELECT id FROM niches WHERE slug = 'travel'), NULL),
((SELECT id FROM frameworks WHERE slug = 'storytelling'), (SELECT id FROM niches WHERE slug = 'travel'), NULL),
((SELECT id FROM frameworks WHERE slug = 'authentic-review'), (SELECT id FROM niches WHERE slug = 'travel'), NULL),

-- 12. F&B (Nhà hàng/Ăn uống)
((SELECT id FROM frameworks WHERE slug = 'authentic-review'), (SELECT id FROM niches WHERE slug = 'fb-restaurant'), NULL),
((SELECT id FROM frameworks WHERE slug = 'behind-scenes'), (SELECT id FROM niches WHERE slug = 'fb-restaurant'), NULL),
((SELECT id FROM frameworks WHERE slug = 'listicle'), (SELECT id FROM niches WHERE slug = 'fb-restaurant'), NULL),
((SELECT id FROM frameworks WHERE slug = 'mistake-warning'), (SELECT id FROM niches WHERE slug = 'fb-restaurant'), NULL),

-- 13. MEDIA & DESIGN
((SELECT id FROM frameworks WHERE slug = 'howto-guide'), (SELECT id FROM niches WHERE slug = 'media-design'), NULL),
((SELECT id FROM frameworks WHERE slug = 'tips-tricks'), (SELECT id FROM niches WHERE slug = 'media-design'), NULL),
((SELECT id FROM frameworks WHERE slug = 'behind-scenes'), (SELECT id FROM niches WHERE slug = 'media-design'), NULL);
