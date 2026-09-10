import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it.each(["primary", "destructive"] as const)(
    "keeps white foreground text on the red %s variant",
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>);

      expect(screen.getByRole("button", { name: variant })).toHaveClass(
        variant === "primary" ? "!text-primary-foreground" : "!text-destructive-foreground",
      );
    },
  );
});
