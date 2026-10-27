"use client";

export function SkipLink() {
  return (
    <a
      href="#page-content"
      className="skip-link"
      onClick={(event) => {
        const main = document.getElementById("page-content");
        if (main) {
          event.preventDefault();
          main.focus();
          main.scrollIntoView({ behavior: "instant", block: "start" });
        }
      }}
    >
      Skip to content
    </a>
  );
}
