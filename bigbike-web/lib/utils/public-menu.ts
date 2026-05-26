import type { PublicMenuItem } from "@/lib/contracts/public";

export type PublicMenuTreeNode = PublicMenuItem & {
  children: PublicMenuTreeNode[];
};

export function buildPublicMenuTree(items: PublicMenuItem[]): PublicMenuTreeNode[] {
  const map = new Map<string, PublicMenuTreeNode>();

  items.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  const roots: PublicMenuTreeNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
      return;
    }

    roots.push(node);
  });

  const sortRecursive = (nodes: PublicMenuTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((node) => sortRecursive(node.children));
  };

  sortRecursive(roots);
  return roots;
}

export function flattenPublicMenuTree(
  nodes: PublicMenuTreeNode[],
): PublicMenuTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenPublicMenuTree(node.children)]);
}
