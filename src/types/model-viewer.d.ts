import type React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        poster?: string;
        alt?: string;
        ar?: boolean | string;
        autoplay?: boolean | string;
        exposure?: string | number;
        "camera-controls"?: boolean | string;
        "interaction-prompt"?: string;
        "shadow-intensity"?: string | number;
      };
    }
  }
}

export {};
