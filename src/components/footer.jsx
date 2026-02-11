import { ScrambleText } from "@/components/gsap/scramble-text";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";

const SCRAMBLE_CHARS = "XZ#@&01{";

const MAILTO_LINK =
  "mailto:vce.specialist@icloud.com?subject=VCE%20Inquiry%20-%20Whitefriars&body=Hi%20Ben,%20I'm%20using%20your%20VCE%20website%20and%20would%20love%20to%20chat%20about%20tutoring.";

export function Footer() {
  return (
    <footer className="border-t border-border py-10 px-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-6 sm:gap-4 max-w-xl mx-auto text-center sm:text-left">
        {/* Left: The Specialist */}
        <div className="flex flex-col items-center sm:items-start">
          <ScrambleText
            chars={SCRAMBLE_CHARS}
            className="text-lg font-bold text-foreground"
          >
            Ben Hinton, MA
          </ScrambleText>
          <ScrambleText
            chars={SCRAMBLE_CHARS}
            className="text-xs uppercase tracking-widest text-muted-foreground"
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
          <a href={MAILTO_LINK} className="no-underline">
            <Badge
              variant="outline"
              className="cursor-pointer gap-1.5 px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Mail className="h-3 w-3" />
              vce.specialist@icloud.com
            </Badge>
          </a>
        </div>
      </div>
    </footer>
  );
}
