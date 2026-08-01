declare module "css-tree" {
  type Context = "declarationList" | "stylesheet";

  type DeclarationNode = {
    type: "Declaration";
    property: string;
  };

  type List = {
    remove(item: unknown): void;
  };

  export function parse(css: string, options: { context: Context }): unknown;
  export function generate(ast: unknown): string;
  export function walk(
    ast: unknown,
    options: {
      visit: "Declaration";
      enter(node: DeclarationNode, item: unknown, list: List | null): void;
    },
  ): void;
}
