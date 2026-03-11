import { ScrambleText } from "@/components/gsap/scramble-text";
import { Badge } from "@/components/ui/badge";
import { Phone } from "lucide-react";

const SCRAMBLE_CHARS = "XZ#@&01{";

export function Footer() {
  return (
    <footer className="border-t border-border py-10 px-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-6 sm:gap-4 max-w-xl mx-auto text-center sm:text-left">
        {/* Left: The Specialist – overflow-hidden prevents scramble width changes from reflowing the grid */}
        <div className="overflow-hidden">
          <ScrambleText
            chars={SCRAMBLE_CHARS}
            className="text-lg font-bold text-foreground whitespace-nowrap"
          >
            Ben Hinton, MA
          </ScrambleText>
          <ScrambleText
            chars={SCRAMBLE_CHARS}
            className="text-xs uppercase tracking-widest text-muted-foreground whitespace-nowrap"
          >
            Language Specialist
          </ScrambleText>
        </div>

        {/* Center: The Release */}
        <div className="flex justify-center">
          <span className="text-sm text-muted-foreground font-mono">
            Version 12 (Whitefriars)
          </span>
        </div>

        {/* Right: Contact CTA */}
        <div className="flex justify-center sm:justify-end">
          <a href="tel:+61490138807" className="no-underline">
            <Badge
              variant="outline"
              className="cursor-pointer gap-1.5 px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Phone className="h-3 w-3" />
              0490 138 807
            </Badge>
          </a>
        </div>
      </div>
    </footer>
  );
}
