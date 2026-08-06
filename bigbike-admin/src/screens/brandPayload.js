export function toBrandPayload(form) {
  const payload = {
    slug: form.slug.trim(),
    name: form.name.trim(),
    // Luôn gửi mô tả, kể cả khi rỗng: backend dùng presence-flag (thiếu khóa = giữ
    // nguyên giá trị cũ, chuỗi rỗng = xóa). Bỏ khóa khi rỗng khiến admin không thể
    // xóa mô tả cũ — mô tả tiếng Anh đã gửi null nên hai bên phải nhất quán.
    description: form.description.trim(),
    showOnHomepage: Boolean(form.showOnHomepage),
  }

  // Gửi kèm alt: form có ô nhập alt cho logo/banner, nếu payload bỏ alt thì backend
  // ghi null và nội dung admin vừa nhập bị mất ngay ở lần lưu đó.
  payload.logo = {
    url: form.logoUrl.trim(),
    alt: form.logoAlt?.trim() || null,
  }

  payload.banner = {
    url: form.bannerUrl.trim(),
    alt: form.bannerAlt?.trim() || null,
  }

  payload.seo = {
    title: form.seoTitle.trim() || null,
    description: form.seoDescription.trim() || null,
    // SEO_RULE_003: canonical tự sinh từ slug ở tầng web — không gửi từ form nữa.
    noIndex: Boolean(form.seoNoIndex),
    noIndexEn: Boolean(form.seoNoIndexEn),
    ogImage: form.seoOgImageUrl.trim()
      ? {
          url: form.seoOgImageUrl.trim(),
          alt: form.seoOgImageAlt.trim() || null,
        }
      : null,
  }

  payload.translations = {
    en: {
      description: form.translations?.en?.description?.trim() || null,
      seoTitle: form.translations?.en?.seoTitle?.trim() || null,
      seoDescription: form.translations?.en?.seoDescription?.trim() || null,
    },
  }

  return payload
}

export function getBrandRequiredProgress(form) {
  const requiredValues = [
    form.slug,
    form.name,
  ]
  return {
    total: requiredValues.length,
    filled: requiredValues.filter((value) => Boolean(value?.trim())).length,
  }
}
