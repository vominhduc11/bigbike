import { describe, expect, it } from 'vitest'
import {
  validateSafePublicLink,
  extractAllowedYouTubeId,
  extractAllowedTikTokId,
  isAllowedFacebookVideoUrl,
  isAllowedMediaVideoUrl,
  validateHomeVideoUrl,
  validateRedirectSource,
  validateRedirectTarget,
  validateSafeMediaImageUrl,
} from './urlPolicies'

// Module an toàn URL/video dùng chung cho Slider, Menu, Video trang chủ, PDP, nội dung —
// trước đây chưa có test nào. Đây là nguồn chân lý cho việc chặn scheme nguy hiểm và
// duyệt nguồn nhúng video, nên khoá hành vi bằng test để không hồi quy âm thầm.

describe('validateSafePublicLink', () => {
  it('nhận đường dẫn nội bộ và https', () => {
    expect(validateSafePublicLink('/khuyen-mai').valid).toBe(true)
    expect(validateSafePublicLink('https://bigbike.vn/x').valid).toBe(true)
  })

  it('từ chối scheme nguy hiểm và giao thức-tương-đối', () => {
    expect(validateSafePublicLink('javascript:alert(1)').reason).toBe('unsafe')
    expect(validateSafePublicLink('//evil.com').reason).toBe('unsafe')
    expect(validateSafePublicLink('data:text/html,x').reason).toBe('unsafe')
  })

  it('từ chối http (không phải https) và link có thông tin đăng nhập', () => {
    expect(validateSafePublicLink('http://bigbike.vn').reason).toBe('protocol')
    expect(validateSafePublicLink('https://user:pass@bigbike.vn').reason).toBe('malformed')
  })

  it('từ chối chuỗi rỗng', () => {
    expect(validateSafePublicLink('   ').reason).toBe('required')
  })
})

describe('extractAllowedYouTubeId', () => {
  it('lấy id từ watch?v=, youtu.be, /embed/, /shorts/', () => {
    expect(extractAllowedYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractAllowedYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractAllowedYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractAllowedYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('trả null cho host lạ hoặc id sai độ dài', () => {
    expect(extractAllowedYouTubeId('https://vimeo.com/123')).toBeNull()
    expect(extractAllowedYouTubeId('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(extractAllowedYouTubeId('javascript:alert(1)')).toBeNull()
  })
})

describe('extractAllowedTikTokId', () => {
  it('lấy id số từ link đầy đủ', () => {
    expect(extractAllowedTikTokId('https://www.tiktok.com/@bigbike/video/7412345678901234567'))
      .toBe('7412345678901234567')
  })

  it('từ chối link rút gọn vt.tiktok.com / vm.tiktok.com', () => {
    expect(extractAllowedTikTokId('https://vt.tiktok.com/ZSabc123/')).toBeNull()
    expect(extractAllowedTikTokId('https://vm.tiktok.com/ZSabc123/')).toBeNull()
  })
})

describe('isAllowedFacebookVideoUrl', () => {
  it('nhận link video/reel/watch/video.php công khai', () => {
    expect(isAllowedFacebookVideoUrl('https://www.facebook.com/bigbike/videos/123456789')).toBe(true)
    expect(isAllowedFacebookVideoUrl('https://www.facebook.com/reel/123456789')).toBe(true)
    expect(isAllowedFacebookVideoUrl('https://www.facebook.com/watch')).toBe(true)
  })

  it('từ chối link rút gọn fb.watch và host lạ', () => {
    expect(isAllowedFacebookVideoUrl('https://fb.watch/abc123/')).toBe(false)
    expect(isAllowedFacebookVideoUrl('https://vimeo.com/videos/1')).toBe(false)
  })
})

describe('isAllowedMediaVideoUrl', () => {
  it('nhận video trong kho nội bộ /media', () => {
    expect(isAllowedMediaVideoUrl('/media/videos/clip.mp4')).toBe(true)
    expect(isAllowedMediaVideoUrl('/media-proxy/videos/clip.mp4')).toBe(true)
  })

  it('từ chối video trỏ host ngoài không thuộc kho', () => {
    expect(isAllowedMediaVideoUrl('https://cdn.ben-ngoai.com/clip.mp4')).toBe(false)
    expect(isAllowedMediaVideoUrl('javascript:alert(1)')).toBe(false)
  })
})

describe('validateHomeVideoUrl chỉ cho phép nguồn ghi mới', () => {
  it('nhận URL YouTube đầy đủ, TikTok/Facebook và video trong thư viện media', () => {
    expect(validateHomeVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({ valid: true, source: 'youtube' })
    expect(validateHomeVideoUrl('https://www.tiktok.com/@a/video/7412345678901234567')).toMatchObject({ valid: true, source: 'tiktok' })
    expect(validateHomeVideoUrl('https://www.facebook.com/a/videos/1')).toMatchObject({ valid: true, source: 'facebook' })
    expect(validateHomeVideoUrl('/media/videos/demo.mp4')).toMatchObject({ valid: true, source: 'upload' })
  })

  it('từ chối link rút gọn và nền tảng ngoài danh sách', () => {
    expect(validateHomeVideoUrl('https://youtu.be/dQw4w9WgXcQ').valid).toBe(false)
    expect(validateHomeVideoUrl('https://vt.tiktok.com/ZSabc123/').valid).toBe(false)
    expect(validateHomeVideoUrl('https://fb.watch/abc123/').valid).toBe(false)
    expect(validateHomeVideoUrl('https://vimeo.com/123').valid).toBe(false)
    expect(validateHomeVideoUrl('').reason).toBe('required')
  })
})

describe('chính sách ảnh và chuyển hướng theo hợp đồng máy chủ', () => {
  it('chỉ nhận ảnh từ kho media hoặc đường legacy được duyệt', () => {
    expect(validateSafeMediaImageUrl('/media/products/helmet.webp').valid).toBe(true)
    expect(validateSafeMediaImageUrl('/media-proxy/products/helmet.webp').valid).toBe(true)
    expect(validateSafeMediaImageUrl('/wp-content/uploads/legacy.jpg').valid).toBe(true)
    expect(validateSafeMediaImageUrl('https://cdn.example.com/hotlink.jpg').valid).toBe(false)
  })

  it('chỉ nhận đích chuyển hướng nội bộ hoặc cùng tên miền BigBike', () => {
    expect(validateRedirectSource('/san-pham-cu').valid).toBe(true)
    expect(validateRedirectSource('/san-pham-cu?x=1').valid).toBe(false)
    expect(validateRedirectTarget('/san-pham-moi').valid).toBe(true)
    expect(validateRedirectTarget('https://bigbike.vn/san-pham-moi').valid).toBe(true)
    expect(validateRedirectTarget('https://evil.example/x').valid).toBe(false)
    expect(validateRedirectTarget('javascript:alert(1)').valid).toBe(false)
  })
})
