"use client";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import type { ProductFaq } from "@/lib/contracts/public";

/**
 * Product FAQ accordion. Each answer keeps author line breaks (whitespace-pre-line)
 * since FAQ answers are plain text, not rich HTML.
 */
export function ProductFaqSection({ faqs }: { faqs: ProductFaq[] }) {
  if (faqs.length === 0) return null;

  return (
    <Accordion type="single" collapsible className="border-t border-border">
      {faqs.map((faq, index) => (
        <AccordionItem key={index} value={`faq-${index}`}>
          <AccordionTrigger className="text-left text-sm normal-case sm:text-base">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
