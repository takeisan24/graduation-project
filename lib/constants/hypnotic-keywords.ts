/**
 * Danh sách từ khóa thôi miên chia theo nhóm (cập nhật từ Excel khách hàng).
 */
export const HYPNOTIC_KEYWORDS = {
  positive_success: [
    "tuyệt vời", "thành công", "bùng nổ", "đáng kinh ngạc",
    "không thể tin được", "ấn tượng", "bứt phá", "thành tựu"
  ],
  innovation_future: [
    "tiến bộ", "phát triển", "công nghệ hiện đại", "tương lai",
    "mở ra kỷ nguyên mới", "định hướng tương lai", "chuẩn mực mới", "mở ra cơ hội mới"
  ],
  uniqueness: [
    "duy nhất", "độc quyền", "khác biệt", "vượt trội",
    "không thể thay thế", "chỉ riêng bạn", "lựa chọn sáng giá nhất"
  ],
  value_benefit: [
    "giảm giá", "miễn phí", "tiết kiệm", "giá tốt",
    "lợi ích vượt trội", "hiệu quả ngay lập tức", "đặc quyền",
    "tốt nhất cho bạn", "không có đối thủ", "thêm giá trị"
  ],
  breakthrough_creative: [
    "đột phá", "công nghệ mới", "sáng tạo", "tiên phong",
    "độc nhất vô nhị", "chưa từng có", "vượt trội",
    "cách mạng hóa", "tiêu chuẩn mới", "thay đổi cuộc chơi"
  ],
  call_to_action: [
    "hành động ngay", "khám phá ngay", "đừng bỏ lỡ", "tham gia",
    "thử ngay", "nhanh tay đăng ký", "bắt đầu hôm nay",
    "mua ngay", "đặt hàng nhanh chóng"
  ],
  curiosity: [
    "bí mật", "bật mí", "hé lộ", "tiết lộ", "ít ai biết",
    "cảnh báo", "sự thật", "đằng sau", "khám phá"
  ],
  emotional: [
    "đau lòng", "bế tắc", "thất bại", "vỡ lẽ", "thay đổi hoàn toàn",
    "cuộc đời tôi đã thay đổi", "tôi đã sai", "bạn không đơn độc"
  ]
} as const;

/**
 * Danh sách phẳng tất cả các từ khóa để dùng cho AI prompt.
 */
export const ALL_HYPNOTIC_KEYWORDS = [
  ...HYPNOTIC_KEYWORDS.positive_success,
  ...HYPNOTIC_KEYWORDS.innovation_future,
  ...HYPNOTIC_KEYWORDS.uniqueness,
  ...HYPNOTIC_KEYWORDS.value_benefit,
  ...HYPNOTIC_KEYWORDS.breakthrough_creative,
  ...HYPNOTIC_KEYWORDS.call_to_action,
  ...HYPNOTIC_KEYWORDS.curiosity,
  ...HYPNOTIC_KEYWORDS.emotional,
];

// ============================================================
// HOOK FORMULA - Cập nhật từ 100 Công Thức Đặt Tiêu Đề & 150 Mẫu Hook
// ============================================================
// LƯU Ý QUAN TRỌNG: Đây là công thức về mặt Ý NGHĨA.
// TUYỆT ĐỐI KHÔNG được viết các từ: "Nỗi đau", "Lợi ích", "KOL", "Đối tượng" vào trong bài.
// Hãy diễn giải chúng thành câu văn tự nhiên, thu hút.
export const HOOK_FORMULA = `Chọn MỘT trong các công thức tiêu đề sau đây để viết câu tiêu đề (Hook) hấp dẫn nhất:

--- NHÓM GÂY TÒ MÒ / BÍ MẬT ---
- Tiết lộ [số] bí quyết mà [Người/đối tượng] dùng để [Kết quả mong muốn]
- Bí mật đằng sau cách [Người] đạt được [Kết quả] mà không ai biết
- Bật mí [số] cách đạt được [kết quả]
- Điều khó khăn nhất về [chủ đề] mà không ai nói đến
- Tại sao không ai nói về [điều này] trong [ngành/niche]?
- Những điều chưa biết về [chủ đề/sản phẩm]
- Đây là một lời nói dối mà [ngành/người] không bao giờ thừa nhận

--- NHÓM CHỨNG MINH / TRẢI NGHIỆM THỰC TẾ ---
- Tôi đã thử [hành động] trong [X] ngày và đây là kết quả
- Khoảnh khắc tôi nhận ra [điều này], mọi thứ đã thay đổi
- Sai lầm lớn nhất tôi mắc phải khi bắt đầu [hành động]
- Đây là điều cuối cùng khiến tôi vỡ lẽ sau nhiều tháng thất bại với [chủ đề]
- Tôi đã tiêu [X tiền/thời gian] cho [điều này] - đây là suy nghĩ thật lòng

--- NHÓM LÀM THẾ NÀO (HOW-TO) ---
- Làm thế nào [Người] đã [Thành công] bằng cách [Hành động]?
- Làm thế nào để [đạt kết quả ấn tượng] chỉ trong [thời gian ngắn]?
- Làm sao để chấm dứt [vấn đề] chỉ trong [thời gian]?
- Đây là cách tôi [đạt được kết quả X] chỉ trong [thời gian ngắn]
- Đây là chiến lược tôi sẽ dùng nếu bắt đầu lại từ đầu
- Đây là cách lười biếng nhất để đạt được [kết quả mong muốn]

--- NHÓM SAI LẦM / CẢNH BÁO ---
- [Số] sai lầm mà bạn nên tránh khi [hành động]
- Sai lầm phổ biến khi [thực hiện hành động]
- Cảnh báo: Những điều bạn phải biết về [điều này]
- Ngừng làm [điều này] ngay bây giờ - đây là lý do
- Vẫn đang dùng [phương pháp cũ]? Đây là lý do bạn nên dừng ngay
- Đừng sử dụng [cái này] - thay vào đó hãy dùng [cái kia]

--- NHÓM LỜI KHUYÊN / TRUYỀN CẢM HỨNG ---
- Lời khuyên tốt nhất và tệ nhất tôi nhận được về [chủ đề]
- Mọi người bảo tôi [điều A], nhưng tôi làm [điều B] và nó hiệu quả
- Nếu tôi phải bắt đầu lại từ đầu, tôi sẽ...
- Bạn có thể [đạt được điều phi thường] ngay cả khi [điều bình thường]
- Ngừng [thói quen cũ] - hãy bắt đầu [hành động mới]

--- NHÓM XU HƯỚNG / TIN TỨC ---
- [Xu hướng mới] mà [đối tượng] đang tin dùng
- [Lời hứa] với [số] phương pháp/bí quyết đã được chứng minh
- Mẹo [hành động] như [tên người nổi tiếng/idol]`;

/**
 * 30 Mẫu Hook tiêu biểu để AI tham khảo và biến tấu.
 */
export const HOOK_TEMPLATES_150 = [
  "Điều khó khăn nhất về ___ mà không ai nói đến",
  "Tôi đã thử ___ trong [X] ngày và đây là những gì đã xảy ra",
  "Khoảnh khắc tôi nhận ra ___, mọi thứ đã thay đổi",
  "Sai lầm lớn nhất tôi mắc phải khi tôi bắt đầu ___",
  "Lời khuyên tốt nhất và tệ nhất tôi nhận được về ___",
  "Mọi người bảo tôi ___, nhưng tôi lại làm ___, và nó hiệu quả",
  "Điều không ai nói với bạn về ___, và nguyên nhân nó khiến bạn bế tắc",
  "Tôi đã tiêu [X]đ cho ___. Đây là suy nghĩ thật lòng của tôi",
  "Đây là điều cuối cùng khiến tôi vỡ lẽ sau nhiều tháng thất bại với ___",
  "Tôi vừa phát hiện ra ___ giúp mọi người ___",
  "Nếu tôi phải bắt đầu lại từ đầu, tôi sẽ...",
  "Ngừng làm [điều này] - đây là lý do tại sao",
  "Đây là một lời nói dối mà [ngành] không bao giờ thừa nhận",
  "Đây là cách tôi [đạt được X] chỉ trong [thời gian ngắn]",
  "Đây là chiến lược tôi sẽ dùng nếu bắt đầu lại từ đầu",
  "Tại sao không ai nói về ___ trong [ngành/niche]?",
  "Đây là cách lười biếng để đạt được [kết quả mong muốn]",
  "Vẫn đang sử dụng [phương pháp lỗi thời]? Đây là lý do bạn nên dừng ngay",
  "Đừng sử dụng [phổ biến], thay vào đó hãy sử dụng ___",
  "Bạn không phải là người duy nhất gặp phải [vấn đề]. Nhưng tôi có một mẹo giúp bạn",
  "Tiết lộ [số] bí quyết mà [Người] sử dụng để đạt được [Kết quả]",
  "Bí mật đằng sau cách [Người] đạt được [Kết quả] mà không ai biết",
  "Bật mí [số] cách đạt được [kết quả]",
  "Làm thế nào [Người] đã [Thành công] bằng cách [Hành động]?",
  "Làm thế nào để [kết quả ấn tượng] chỉ trong [thời gian]?",
  "Cảnh báo: Những điều bạn phải biết về ___",
  "Lời khuyên dành cho [đối tượng] nếu không muốn [vấn đề]",
  "Bạn có thể [điều phi thường] ngay cả khi [điều bình thường]",
  "Mẹo ___ như [người nổi tiếng]",
  "[Số] sai lầm mà bạn nên tránh khi [hành động]",
];

/**
 * Các cụm từ và quy tắc bị cấm (Negative Constraints).
 */
export const FORBIDDEN_PHRASES = [
  "Cái \"Lợi Ích\" rõ rệt nhất mình thấy là",
  "Điểm \"Khan Hiếm\" (hay giá trị không phải lúc nào cũng có)",
  "Giải pháp cho \"Nỗi Đau\"",
  "Có một sự thật mà ít ai nói thẳng.",
  "Kết luận rất thẳng là",
  "Không phải là \"không đủ giỏi\" mà là chưa hiểu rõ luật chơi",
  "Mình thấy một điểm chung.",
  "Trong thời đại số hóa",
  "Không thể phủ nhận rằng"
];

export const FORMATTING_CONSTRAINTS = `
- KHÔNG đưa nhiều từ vào ngoặc kép "" dù không phải trích dẫn lời nói, quote.
- KHÔNG bỏ quá nhiều icon vào nội dung post mạng xã hội (tối đa 3 icon/bài).
- KHÔNG bỏ line gạch ngang (---, ***, ___) tách các phần trong content post.
- TUYỆT ĐỐI KHÔNG sử dụng các từ khóa tiêu đề dàn ý như: "Mở bài:", "Thân bài:", "Kết bài:", "Lợi ích:", "Kết luận:", "Tóm lại:"... Bài viết phải là văn bản liền mạch.
- TRÁNH các từ khóa bị cấm sau đây: ${FORBIDDEN_PHRASES.map(p => `"${p}"`).join(', ')}.
`;
