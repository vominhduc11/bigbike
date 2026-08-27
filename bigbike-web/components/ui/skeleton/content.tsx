/**
 * Content, static-page & auth skeletons: article detail, generic CMS page, auth
 * card, contact, guide. Compose the shared primitives. Re-exported via
 * components/ui/Skeletons.tsx.
 */

"use client";

import { Card } from "@/components/ui/card";
import { Container } from "@/components/layout/Container";
import { skelStack } from "@/lib/ui-classes";
import { SkeletonRoot, SkelBlock, SkelButton, SkelText, SkelTitle } from "./primitives";

/** Auth (login/register/forgot-password) — centered form placeholder */
export function AuthSkeleton() {
  return (
    <SkeletonRoot labelKey="auth">
      <section className="px-4 py-15 sm:px-6">
        <div className="mx-auto w-full max-w-92.5">
          <Card className="border-t-4 border-t-primary p-6">
            <div className={skelStack}>
              <SkelTitle w="60%" h="1.8em" />
              <div style={{ height: 8 }} />
              <SkelText w="40%" />
              <SkelBlock w="100%" h={42} />
              <SkelText w="40%" />
              <SkelBlock w="100%" h={42} />
              <SkelButton w="100%" />
              <SkelText w="55%" />
            </div>
          </Card>
        </div>
      </section>
    </SkeletonRoot>
  );
}

/** Static / CMS page — h1 + body paragraphs */
export function StaticPageSkeleton({ title = "Loading content" }: { title?: string }) {
  return (
    <SkeletonRoot label={title}>
      <section className="bb-page">
        <Container>
          <header style={{ marginBottom: 24 }}>
            <SkelTitle w="55%" h="2.2em" />
          </header>
          <div className={skelStack}>
            <SkelText w="100%" />
            <SkelText w="92%" />
            <SkelText w="98%" />
            <SkelText w="60%" />
            <SkelText w="100%" />
            <SkelText w="78%" />
            <SkelText w="92%" />
          </div>
        </Container>
      </section>
    </SkeletonRoot>
  );
}

/** Contact page — hero + 2-col (info blocks / map) */
export function ContactSkeleton() {
  return (
    <SkeletonRoot labelKey="contact">
      <section className="bb-page">
        <SkelBlock w="100%" h={300} />
        <Container>
          <div
            style={{
              display: "grid",
              gap: 60,
              gridTemplateColumns: "1fr 1fr",
              paddingTop: 50,
              paddingBottom: 60,
            }}
          >
            <div className={skelStack}>
              <SkelTitle w="55%" h="1.6em" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: 16, paddingTop: 16, paddingBottom: 16 }}
                >
                  <SkelBlock w={28} h={28} />
                  <div style={{ flex: 1 }}>
                    <SkelText w="40%" />
                    <SkelText w="80%" />
                  </div>
                </div>
              ))}
            </div>
            <div className={skelStack}>
              <SkelTitle w="55%" h="1.6em" />
              <SkelBlock w="100%" h={420} />
              <SkelBlock w="100%" h={48} />
            </div>
          </div>
        </Container>
      </section>
    </SkeletonRoot>
  );
}

/** Guide landing — sidebar nav + content */
export function GuideSkeleton({ label = "Loading guide" }: { label?: string }) {
  return (
    <SkeletonRoot label={label}>
      <section className="bb-page">
        <Container>
          <div style={{ display: "grid", gap: 28, gridTemplateColumns: "260px 1fr" }}>
            <aside className={skelStack}>
              <SkelTitle w="60%" />
              {Array.from({ length: 6 }).map((_, i) => (
                <SkelBlock key={i} w="100%" h={36} />
              ))}
            </aside>
            <div>
              <SkelTitle w="50%" h="2em" />
              <div className={skelStack} style={{ marginTop: 20 }}>
                <SkelText w="100%" />
                <SkelText w="92%" />
                <SkelText w="98%" />
                <SkelText w="80%" />
                <SkelText w="60%" />
              </div>
            </div>
          </div>
        </Container>
      </section>
    </SkeletonRoot>
  );
}
