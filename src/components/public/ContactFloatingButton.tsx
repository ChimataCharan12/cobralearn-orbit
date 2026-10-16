import { Link, useRouterState } from "@tanstack/react-router";
import { MessageSquareText } from "lucide-react";

export function ContactFloatingButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Hide floating button on admin portal
  if (pathname.startsWith("/admin")) {
    return null;
  }

  const isContactActive = pathname === "/contact" || pathname === "/contact/";

  return (
    <Link
      to="/contact"
      aria-label="Contact CobraLearn Innotechcore"
      className={`floating-contact-btn group ${isContactActive ? "is-active" : ""}`}
    >
      {/* Top chat icon with subtle glow */}
      <span className="floating-contact-icon">
        <MessageSquareText className="size-4 text-[#00ff87] group-hover:scale-110 transition-transform duration-200" />
      </span>

      {/* Vertical Text */}
      <span className="floating-contact-label font-display">
        CONTACT
      </span>

      {/* Bottom glowing amber accent orb */}
      <span className="floating-contact-dot" />
    </Link>
  );
}
