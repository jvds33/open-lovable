import { useCallback, useEffect, useState } from "react";

import { encryptText } from "@/components/app/(home)/sections/hero/Title/Title";

import HeroScrapingCodeLoading from "./Loading/Loading";
import Code from "@/components/ui/code";

const URL = {
  value: "https://example.com",
  encrypted: "h=t*A:!/z!aap?A-cZz",
};
const MARKDOWN = {
  value: "# Getting Started...",
  encrypted: "# ?0z-ang S*a-Z-a0*9",
};
const TITLE = {
  value: "Guide",
  encrypted: "G!=*?",
};
const SCREENSHOT = {
  value: "https://example.com/hero",
  encrypted: "ht-=*:/?*Za!zl=-?a9?h0-!",
};

export default function HeroScrapingCode({ step }: { step: number }) {
  const [url, setUrl] = useState(URL.encrypted);
  const [markdown, setMarkdown] = useState(MARKDOWN.encrypted);
  const [title, setTitle] = useState(TITLE.encrypted);
  const [screenshot, setScreenshot] = useState(SCREENSHOT.encrypted);

  const reveal = useCallback((value: string, setter: (v: string) => void) => {
    let progress = 0;
    let increaseProgress = -10;

    const animate = () => {
      increaseProgress = (increaseProgress + 1) % 5;

      if (increaseProgress === 4) {
        progress += 0.2;
      }

      if (progress > 1) {
        progress = 1;
        setter(encryptText(value, progress, { randomizeChance: 0.3 }));

        return;
      }

      setter(encryptText(value, progress, { randomizeChance: 0.3 }));

      const interval = 70 + progress * 30;
      setTimeout(animate, interval);
    };

    animate();
  }, []);

  useEffect(() => {
    if (step >= 0 && url === URL.encrypted) reveal(URL.value, setUrl);

    if (step >= 3 && title === TITLE.encrypted) reveal(TITLE.value, setTitle);
    if (step >= 4 && markdown === MARKDOWN.encrypted)
      reveal(MARKDOWN.value, setMarkdown);

    if (step >= 5 && screenshot === SCREENSHOT.encrypted)
      reveal(SCREENSHOT.value, setScreenshot);

    const interval = setInterval(() => {
      if (step < 0) {
        URL.encrypted = encryptText(URL.value, 0, { randomizeChance: 0.3 });
        setUrl(URL.encrypted);
      }

      if (step < 3) {
        TITLE.encrypted = encryptText(TITLE.value, 0, { randomizeChance: 0.3 });
        setTitle(TITLE.encrypted);
      }

      if (step < 4) {
        MARKDOWN.encrypted = encryptText(MARKDOWN.value, 0, {
          randomizeChance: 0.3,
        });
        setMarkdown(MARKDOWN.encrypted);
      }

      if (step < 5) {
        SCREENSHOT.encrypted = encryptText(SCREENSHOT.value, 0, {
          randomizeChance: 0.3,
        });
        setScreenshot(SCREENSHOT.encrypted);
      }
    }, 70);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, reveal]);

  return (
    <div className="h-280 lg:h-310 flex z-[1] w-full relative bg-background-base border border-gray-200 rounded-8 overflow-hidden">
      <div className="flex-1 h-full relative">
        <div className="pl-15 border-b border-gray-200 p-13 flex justify-between items-center bg-gray-50">
          <div className="flex gap-10 items-center">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                className="w-12 h-12 rounded-full bg-gray-300"
                key={index}
              />
            ))}
          </div>

          <div className="text-mono-x-small font-mono text-gray-400">
            [ .JSON ]
          </div>
        </div>

        <div className="overflow-x-scroll hide-scrollbar relative">
          <Code
            code={`[
  {
    "url": "${url}",
    "markdown": "${markdown}",
    "json": { "title": "${title}", "docs": "..." },
    "screenshot": "${screenshot}.png"
  }
]`}
            language="json"
          />
        </div>

        <HeroScrapingCodeLoading finished={step >= 6} />
      </div>
    </div>
  );
}
