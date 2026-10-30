import { Keyboard } from "lucide-react";
import type { PracticeLocale } from "@/lib/localization/content";

export function TypingHelp({ locale }: { locale: PracticeLocale }) {
  const language =
    locale === "hi-IN"
      ? "Hindi"
      : locale === "te-IN"
        ? "Telugu"
        : "your language";
  return (
    <details className="typing-help">
      <summary>
        <Keyboard size={16} aria-hidden="true" /> Type in {language}
      </summary>
      <div className="typing-help-body">
        <p>
          Use English letters to type the sounds of a word, then choose its
          native-script suggestion with Google Input Tools.
        </p>
        <ol>
          <li>
            Open this practice in Google Chrome and install{" "}
            <a
              href="https://chromewebstore.google.com/detail/google-input-tools/mclkkofklkfljcocdinagocijmpgbhab"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Input Tools (opens a new tab)
            </a>
            .
          </li>
          <li>
            In the extension’s options, add{" "}
            {language === "your language"
              ? "your preferred language"
              : language}{" "}
            transliteration. Select it from the extension menu.
          </li>
          <li>
            Return to the response box, type a word and choose a suggestion.
            Finish choosing words before sending your answer.
          </li>
        </ol>
        <p>
          Using the in-app browser, another browser or a phone?{" "}
          <a
            href="https://www.google.com/inputtools/try/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Google’s online typing tool (new tab)
          </a>
          , select {language}, type there, then copy and paste your answer here.
          You can also use your device’s language keyboard.
        </p>
        <p className="typing-help-note">
          Setup is manual. Persona Lab does not install or detect extensions,
          switch your keyboard, or automatically send drafts to Google. Text
          entered through Google’s tools is handled by Google. Review the final
          wording here before sending; your practice language stays unchanged.
        </p>
      </div>
    </details>
  );
}
