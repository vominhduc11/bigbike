"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { Container } from "@/components/layout/Container";

/* eslint-disable @next/next/no-img-element */

export type PageHeroCrumb = {
  label: string;
  href?: string;
  altHref?: string;
  labelNode?: ReactNode;
};

const DEFAULT_BG = "/brand/page-title-bg.png";
const DEFAULT_ILLUSTRATION = "/brand/page-title-illustration.png";

export function PageHero({
  title,
  titleNode,
  breadcrumb,
  bgUrl,
  mobileBgUrl,
  illustrationUrl,
  illustrationAlt,
  focusId,
}: {
  title: string;
  titleNode?: ReactNode;
  breadcrumb: PageHeroCrumb[];
  bgUrl?: string | null;
  mobileBgUrl?: string | null;
  illustrationUrl?: string | null;
  illustrationAlt?: string | null;
  focusId?: string;
}) {
  const locale = useLocale();
  const background = bgUrl?.trim() || DEFAULT_BG;
  const mobileBackground = mobileBgUrl?.trim() || null;
  const illustration = illustrationUrl?.trim() || DEFAULT_ILLUSTRATION;

  return (
    <section
      className="relative mb-[90px] min-h-[250px] overflow-hidden bg-cover bg-center bg-no-repeat md:min-h-[450px]"
      style={{ backgroundImage: `url('${background}')` }}
      data-page-hero
      data-bb-focus={focusId}
    >
      {mobileBackground ? (
        <img
          src={mobileBackground}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover md:hidden"
        />
      ) : null}

      <Container className="relative z-10 flex min-h-[250px] items-center md:min-h-[450px]">
        <div className="w-full md:w-1/2">
          <h1 className="m-0 font-cta text-a2-page font-semibold leading-normal text-white!">
            {titleNode ?? title}
          </h1>
          <nav className="mt-2" aria-label="Breadcrumb">
            <ol className="m-0 flex list-none flex-wrap p-0">
              {breadcrumb.map((crumb, index) => {
                const href = locale !== DEFAULT_LOCALE && crumb.altHref ? crumb.altHref : crumb.href;
                return (
                  <li
                    key={`${crumb.label}-${index}`}
                    className="hidden items-center text-a5-meta text-white! before:mx-1 before:content-['/'] first:inline-flex! first:before:hidden last:inline-flex! md:inline-flex!"
                  >
                    {href ? (
                      <Link href={href} className="font-semibold text-white! no-underline! hover:text-brand!">
                        {crumb.labelNode ?? crumb.label}
                      </Link>
                    ) : (
                      <span className="text-white!">{crumb.labelNode ?? crumb.label}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <div className="absolute bottom-0 right-[15px] hidden max-w-[50%] md:block!">
          <img
            src={illustration}
            alt={illustrationAlt ?? title}
            className="max-h-[400px] w-auto object-contain"
          />
        </div>
      </Container>
    </section>
  );
}
