"use client";

import { useEffect } from "react";

export function ArticleTableOfContents() {
  useEffect(() => {
    const toc = document.getElementById("table-of-content");
    const content = document.querySelector(".blog .blog-content");
    if (!toc || !content) {
      return undefined;
    }

    toc.innerHTML = "";
    toc.classList.remove("expanded");

    const headings = Array.from(content.querySelectorAll<HTMLHeadingElement>("h2, h3, h4"));
    if (headings.length <= 1) {
      toc.style.display = "none";
      return undefined;
    }

    toc.style.display = "";

    const title = document.createElement("div");
    title.className = "toc-title";
    title.append(document.createTextNode("Mục lục "));

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "btn-toggle";
    toggleButton.textContent = "[hiện]";
    title.appendChild(toggleButton);

    const list = document.createElement("ul");
    list.className = "table-of-content-list";

    let h2Count = 0;
    let h3Count = 0;
    let h4Count = 0;

    headings.forEach((heading, index) => {
      const level = heading.tagName.toLowerCase();
      let number = "";

      if (level === "h2") {
        h2Count += 1;
        h3Count = 0;
        h4Count = 0;
        number = `${h2Count}.`;
      } else if (level === "h3") {
        h3Count += 1;
        h4Count = 0;
        number = `${h2Count || 1}.${h3Count}.`;
      } else {
        h4Count += 1;
        number = `${h2Count || 1}.${h3Count || 1}.${h4Count}.`;
      }

      const headingId = `heading-${index}`;
      heading.id = headingId;

      const item = document.createElement("li");
      item.className = `heading-${level}`;

      const link = document.createElement("a");
      link.href = `#${headingId}`;
      link.textContent = `${number} ${heading.textContent?.trim() ?? ""}`;
      item.appendChild(link);
      list.appendChild(item);
    });

    const handleToggle = () => {
      const expanded = toc.classList.toggle("expanded");
      toggleButton.textContent = expanded ? "[ẩn]" : "[hiện]";
    };

    const handleListClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest<HTMLAnchorElement>("a[href^='#heading-']");
      if (!link) {
        return;
      }

      const heading = document.getElementById(link.hash.slice(1));
      if (!heading) {
        return;
      }

      event.preventDefault();
      const top = heading.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.14;
      window.scrollTo({ top, behavior: "smooth" });
    };

    toggleButton.addEventListener("click", handleToggle);
    list.addEventListener("click", handleListClick);
    toc.append(title, list);

    return () => {
      toggleButton.removeEventListener("click", handleToggle);
      list.removeEventListener("click", handleListClick);
      toc.innerHTML = "";
      toc.classList.remove("expanded");
      toc.style.display = "";
    };
  }, []);

  return <div id="table-of-content" />;
}
