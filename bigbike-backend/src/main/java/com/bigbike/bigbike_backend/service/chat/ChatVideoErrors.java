package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.error.ValidationException;

final class ChatVideoErrors {
    private ChatVideoErrors() {}
    static ValidationException invalid(String code, String lang) {
        return ValidationException.fromField("videoIds", code, message(code, lang));
    }
    static String message(String code, String lang) {
        boolean en = "en".equals(lang);
        return switch (code) {
            case "CHAT_VIDEO_TOO_LARGE" -> en ? "Please choose a video no larger than 40 MB." : "Anh/chị vui lòng chọn video không quá 40 MB.";
            case "CHAT_VIDEO_TOO_LONG" -> en ? "Please choose a video no longer than 15 seconds." : "Anh/chị vui lòng chọn video không quá 15 giây.";
            case "CHAT_VIDEO_UNSUPPORTED_TYPE" -> en ? "Please send an MP4, MOV or WebM video." : "Anh/chị vui lòng gửi video MP4, MOV hoặc WebM.";
            case "CHAT_VIDEO_CONVERSATION_LIMIT" -> en ? "This conversation has reached its limit of two videos. Please send a photo or describe the item in text." : "Hội thoại này đã nhận đủ hai video. Anh/chị vui lòng gửi ảnh hoặc mô tả bằng chữ.";
            case "CHAT_VIDEO_DAILY_LIMIT" -> en ? "The shop's video allowance has been reached for today. Please send a photo or describe the item in text." : "Shop đã dùng hết lượt đọc video hôm nay. Anh/chị vui lòng gửi ảnh hoặc mô tả bằng chữ.";
            case "CHAT_VIDEO_TIMEOUT" -> en ? "I am sorry, I could not finish reviewing your video within 60 seconds. Please send photos of the relevant details instead." : "Em xin lỗi, em chưa xem xong video trong 60 giây. Anh/chị vui lòng gửi ảnh chụp các chi tiết cần hỏi để em hỗ trợ.";
            case "CHAT_VIDEO_UNAVAILABLE" -> en ? "Video review is temporarily unavailable. Please send a photo or describe the item in text." : "Tính năng đọc video tạm thời chưa sẵn sàng. Anh/chị vui lòng gửi ảnh hoặc mô tả bằng chữ.";
            case "CHAT_MEDIA_EXCLUSIVE" -> en ? "Please send either one photo or one video in a message." : "Mỗi lượt anh/chị vui lòng gửi một ảnh hoặc một video.";
            default -> en ? "I could not read this video. Please choose another MP4, MOV or WebM file, or send photos instead." : "Em không đọc được video này. Anh/chị vui lòng chọn tệp MP4, MOV hoặc WebM khác, hoặc gửi ảnh chụp thay thế.";
        };
    }
}
