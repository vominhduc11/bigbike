export function toBrandPayload(form) {
  const payload = {
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    showOnHomepage: Boolean(form.showOnHomepage),
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
