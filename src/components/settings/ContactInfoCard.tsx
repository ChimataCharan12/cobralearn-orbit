import { useState } from "react";
import { Linkedin, Twitter, Instagram, Youtube, ExternalLink } from "lucide-react";

export function ContactInfoCard() {
  const [email, setEmail] = useState("support@cobralearn.com");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [address, setAddress] = useState("Hyderabad, India");
  const [linkedin, setLinkedin] = useState("https://www.linkedin.com/company/cobralearn");
  const [twitter, setTwitter] = useState("https://twitter.com/cobralearn");
  const [instagram, setInstagram] = useState("https://instagram.com/cobralearn");
  const [youtube, setYoutube] = useState("https://youtube.com/@cobralearn");

  return (
    <div className="card-interactive rounded-xl border border-brand/20 bg-panel/85 p-4 shadow-lg">
      <div className="pb-3">
        <h3 className="font-display text-[15px] font-bold text-foreground text-glow">Contact Information</h3>
        <p className="text-[12px] text-muted-foreground">
          These details will be shown on your website (footer, contact page, etc.).
        </p>
      </div>

      <div className="space-y-3 pt-1">
        {/* Email & Phone */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">
              Contact Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-foreground/80">Contact Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="text-[11.5px] font-medium text-foreground/80">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand/20 bg-background/70 px-3 py-2 text-[12.5px] text-foreground focus:border-brand-bright focus:outline-none"
          />
        </div>

        {/* Social Media Links */}
        <div>
          <label className="text-[11.5px] font-medium text-foreground/80">Social Media Links</label>
          <div className="mt-1.5 space-y-2">
            {/* LinkedIn */}
            <div className="flex items-center gap-2 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5">
              <Linkedin className="size-4 shrink-0 text-[#0077b5]" />
              <input
                type="text"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                className="flex-1 bg-transparent text-[12px] text-foreground focus:outline-none font-mono"
              />
              <a href={linkedin} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-brand-bright">
                <ExternalLink className="size-3.5" />
              </a>
            </div>

            {/* X (Twitter) */}
            <div className="flex items-center gap-2 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5">
              <Twitter className="size-4 shrink-0 text-foreground/80" />
              <input
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                className="flex-1 bg-transparent text-[12px] text-foreground focus:outline-none font-mono"
              />
              <a href={twitter} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-brand-bright">
                <ExternalLink className="size-3.5" />
              </a>
            </div>

            {/* Instagram */}
            <div className="flex items-center gap-2 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5">
              <Instagram className="size-4 shrink-0 text-[#E1306C]" />
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="flex-1 bg-transparent text-[12px] text-foreground focus:outline-none font-mono"
              />
              <a href={instagram} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-brand-bright">
                <ExternalLink className="size-3.5" />
              </a>
            </div>

            {/* YouTube */}
            <div className="flex items-center gap-2 rounded-lg border border-brand/20 bg-background/70 px-3 py-1.5">
              <Youtube className="size-4 shrink-0 text-[#FF0000]" />
              <input
                type="text"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                className="flex-1 bg-transparent text-[12px] text-foreground focus:outline-none font-mono"
              />
              <a href={youtube} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-brand-bright">
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
