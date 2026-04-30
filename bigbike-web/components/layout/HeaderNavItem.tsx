"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Tippy from "@tippyjs/react/headless";
import { useEffect, useId, useRef, useState } from "react";
import type { Instance, Props } from "tippy.js";

import type { PublicMenuItem } from "@/lib/contracts/public";
import { normalizeMenuUrl, isActivePath } from "@/lib/utils/nav";

export type HeaderNavNode = PublicMenuItem & { children: HeaderNavNode[] };

type HeaderNavItemProps = {
  node: HeaderNavNode;
};

function isNodeActive(pathname: string | null, node: HeaderNavNode): boolean {
  if (isActivePath(pathname, normalizeMenuUrl(node.url))) return true;
  return node.children.some((child) => isNodeActive(pathname, child));
}

function ChevronIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const megaMenuDelay: [number, number] = [80, 120];

const megaMenuPopperOptions: NonNullable<Props["popperOptions"]> = {
  strategy: "fixed",
  modifiers: [
    {
      name: "flip",
      enabled: false,
    },
    {
      name: "preventOverflow",
      options: {
        padding: 0,
        rootBoundary: "viewport",
      },
    },
    {
      name: "bigbikeMegaPanelRoot",
      enabled: true,
      phase: "beforeWrite",
      requires: ["computeStyles"],
      fn({ state }) {
        state.elements.popper.setAttribute("data-bigbike-mega", "true");
        Object.assign(state.styles.popper, {
          left: "0",
          right: "0",
          top: "var(--bb-header-stack)",
          transform: "none",
          width: "100vw",
        });
      },
      effect({ state }) {
        state.elements.popper.setAttribute("data-bigbike-mega", "true");
        return () => {
          state.elements.popper.removeAttribute("data-bigbike-mega");
        };
      },
    },
  ],
};

export function HeaderNavItem({ node }: HeaderNavItemProps) {
  const pathname = usePathname();
  const href = normalizeMenuUrl(node.url);
  const hasChildren = node.children.length > 0;
  const active = isNodeActive(pathname, node);
  const linkClass = ["wp-nav-link", node.cssClass, active ? "active" : null]
    .filter(Boolean)
    .join(" ");

  const [open, setOpen] = useState(false);
  const tippyInstanceRef = useRef<Instance | null>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    tippyInstanceRef.current?.hide();
  }, [pathname]);

  function closeMenu() {
    tippyInstanceRef.current?.hide();
    setOpen(false);
  }

  function closeMenuReturnFocus() {
    closeMenu();
    triggerRef.current?.focus();
  }

  if (!hasChildren) {
    return (
      <Link
        href={href}
        className={linkClass}
        target={node.openInNewTab ? "_blank" : undefined}
        rel={node.openInNewTab ? "noreferrer" : undefined}
        aria-current={active ? "page" : undefined}
      >
        {node.label}
      </Link>
    );
  }

  const megaPanel = (
    <div
      id={panelId}
      ref={panelRef}
      className="wp-mega-panel"
      role="menu"
      aria-label={node.label}
      aria-hidden={!open}
      data-open={open ? "true" : "false"}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeMenuReturnFocus();
        }
      }}
    >
      <div className="bb-container wp-mega-panel-inner">
        {node.children.map((column) => (
          <div key={column.id} className="wp-mega-column">
            <Link
              href={normalizeMenuUrl(column.url)}
              className="wp-mega-column-title"
              role="menuitem"
              onClick={closeMenu}
            >
              {column.label}
            </Link>
            {column.children.length > 0 && (
              <ul className="wp-mega-sublist">
                {column.children.map((leaf) => (
                  <li key={leaf.id}>
                    <Link
                      href={normalizeMenuUrl(leaf.url)}
                      className="wp-mega-sublink"
                      role="menuitem"
                      onClick={closeMenu}
                    >
                      {leaf.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Tippy
      delay={megaMenuDelay}
      duration={[140, 120]}
      hideOnClick
      interactive
      interactiveBorder={10}
      maxWidth="none"
      offset={[0, 0]}
      placement="bottom-start"
      popperOptions={megaMenuPopperOptions}
      render={(attrs) => (
        <div className="wp-mega-tippy" tabIndex={-1} {...attrs}>
          {megaPanel}
        </div>
      )}
      trigger="mouseenter focusin"
      onClickOutside={closeMenu}
      onCreate={(instance) => {
        tippyInstanceRef.current = instance;
      }}
      onDestroy={() => {
        tippyInstanceRef.current = null;
      }}
      onHide={() => {
        setOpen(false);
      }}
      onShow={() => {
        setOpen(true);
      }}
    >
      <div className="wp-nav-item-has-children">
        <Link
          ref={triggerRef}
          href={href}
          className={linkClass}
          target={node.openInNewTab ? "_blank" : undefined}
          rel={node.openInNewTab ? "noreferrer" : undefined}
          aria-current={active ? "page" : undefined}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={panelId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeMenu();
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              tippyInstanceRef.current?.show();
              setTimeout(() => {
                const firstLink = panelRef.current?.querySelector<HTMLAnchorElement>("a");
                firstLink?.focus();
              }, megaMenuDelay[0] + 20);
            }
          }}
        >
          <span>{node.label}</span>
          <ChevronIcon />
        </Link>
      </div>
    </Tippy>
  );
}
