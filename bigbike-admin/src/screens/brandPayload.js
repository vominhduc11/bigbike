export function toBrandPayload(form) {
  const payload = {
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    visible: Boolean(form.visible),
  }

  payload.logo = form.logoUrl.trim()
    ? { url: form.logoUrl.trim() }
    : { url: '' }

  payload.banner = form.bannerUrl.trim()
    ? { url: form.bannerUrl.trim() }
    : { url: '' }

  payload.seo = {
    title: form.seoTitle.trim() || null,
    description: form.seoDescription.trim() || null,
    canonicalUrl: form.seoCanonicalUrl.trim() || null,
    ogImage: form.seoOgImageUrl.trim()
      ? {
          url: form.seoOgImageUrl.trim(),
          alt: form.seoOgImageAlt.trim() || null,
        }
      : null,
  }

  payload.translations = {
    en: {
      // BRAND_RULE_003: brand slug is shared across VI/EN.
      // Send null so older backend builds clear/ignore the legacy slug_en value.
      slug: null,
      // BRAND_RULE_001: brand names are proper nouns and use one shared value.
      // Keep sending it for compatibility with backend builds that still expect this field.
      name: form.name.trim() || null,
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
