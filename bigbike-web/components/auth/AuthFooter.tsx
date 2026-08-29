import { Container } from "@/components/layout/Container";
import { FooterMenuLinks } from "@/components/layout/FooterMenuLinks";

export function AuthFooter() {
  return (
    <footer data-auth-footer className="w-full bg-footer-top text-white">
      <Container variant="blog" className="px-4! py-3!">
        <FooterMenuLinks variant="privacy" />
      </Container>
    </footer>
  );
}
