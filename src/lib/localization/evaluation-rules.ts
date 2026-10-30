import type { PracticeLocale } from "./content";
import { latinDigits } from "./rules";

// Evaluation v2 adapter. Sentence boundaries preserve coordinated exclusion
// lists; absence of an exclusion is never converted into affirmative coverage.
// This intentionally does not change the saved simulation runtime or v4 scores.
export function evaluationCues(text: string, locale: PracticeLocale) {
  if (locale === "en-IN") return text;
  const hi = locale === "hi-IN";
  const source = latinDigits(text).normalize("NFC");
  const cues: string[] = [];
  for (const sentence of source.match(/[^।.!?\n]+[।.!?\n]?/gu) ?? []) {
    const question = /[?？]|क्या|कितना|बताइ|ఎంత|ఏమిటి|ఎదురైందా|చెప్పండి/u.test(
      sentence,
    );
    const claim = hi ? /दाव|क्लेम|स्वीकृति|मंजूर/u : /క్లెయిమ్|ఆమోద|మంజూర/u;
    const guarantee = hi ? /गारंटी|हमेशा/u : /హామీ|గ్యారెంటీ/u;
    const noGuarantee = hi
      ? /गारंटी\s*(?:नहीं|नही)|गारंटी.*न.*दी/u
      : /హామీ\s*(?:లేదు|లే[దన]|ఇవ్వలే|ఉండదు|కాదు)|హామీ.*(?:కాదు|ఇవ్వలేదు)/u;
    if (claim.test(sentence) && guarantee.test(sentence) && !question) {
      if (noGuarantee.test(sentence))
        cues.push("Approval is never guaranteed.");
      else if (
        (hi ? /गारंटी (?:है|दे)/u : /హామీ (?:ఉంది|ఇస్తా)/u).test(sentence)
      )
        cues.push("All claims are guaranteed.");
    }
    if (
      claim.test(sentence) &&
      (hi
        ? /समीक्षा|मूल्यांकन|जाँच|शर्तों.*आधार/u
        : /పరిశీల|సమీక్ష|నిబంధనల.*ఆధార|ఆధారంగా.*నిర్ణయ/u
      ).test(sentence) &&
      !question
    )
      cues.push("Claims are reviewed.");
    if (
      (hi
        ? /चिंता.*समझ|समझ.*चिंता|संदेह.*(?:सही|उचित)|चिंता.*(?:सही|जायज़)/u
        : /ఆందోళన.*అర్థ[ంమ]|సందేహం.*సరైన|అనుమానం.*సమంజస/u
      ).test(sentence)
    )
      cues.push("I understand your concern.");
    if (
      question &&
      (hi ? /बजट|वहन|खर्च.*कितना/u : /బడ్జెట్|భరించ|ఖర్చు.*ఎంత/u).test(sentence)
    )
      cues.push("What is your budget?");
    if (
      question &&
      (hi
        ? /पहले|पिछल|अनुभव|चिंता.*क्यों/u
        : /గత.*(?:అనుభవ|క్లెయిమ్)|క్లెయిమ్.*ఇబ్బంది.*ఎదురైందా|ఆందోళన.*ఎందుకు/u
      ).test(sentence)
    )
      cues.push("What was your past experience?");
    const waiting = hi
      ? /प्रतीक्षा|इंतजार|वेटिंग/u
      : /వేచి|నిరీక్షణ|వెయిటింగ్/u;
    if (!question && waiting.test(sentence)) {
      if (
        /30/.test(sentence) &&
        !(hi ? /30.*(?:नहीं|लागू नहीं)/u : /30.*(?:వర్తించదు|లేదు)/u).test(
          sentence,
        )
      )
        cues.push("A 30-day initial waiting period applies.");
      if (
        /24/.test(sentence) &&
        (hi ? /पहले|मौजूद|बीमारी/u : /ముందు|వ్యాధ/u).test(sentence)
      )
        cues.push("Pre-existing conditions have a 24-month waiting period.");
      if (
        /36/.test(sentence) &&
        (hi ? /पहले|मौजूद|बीमारी/u : /ముందు|వ్యాధ/u).test(sentence) &&
        !(hi ? /सामान्य|अधिकतम|इस.*24/u : /సాధారణ|గరిష్ఠ|ఈ.*24/u).test(sentence)
      )
        cues.push("No waiting period."); // conflicting pinned term
    }
    if ((hi ? /कॉस्मेटिक/u : /కాస్మెటిక్/u).test(sentence) && !question) {
      const excluded = hi
        ? /कवर नहीं|अपवर्ज|बाहर/u
        : /కవర్ కావు|కవరేజ్ ఉండదు|మినహాయింపుల/u;
      const conditional = hi ? /यदि|अगर/u : /పేర్కొంటే/u;
      if (excluded.test(sentence) && !conditional.test(sentence))
        cues.push("Cosmetic procedures are excluded.");
      else if (
        (hi ? /कवर (?:हैं|है)|शामिल हैं/u : /కవర్ అవుతా|కవరేజ్ ఉంటుంది/u).test(
          sentence,
        ) &&
        !excluded.test(sentence)
      )
        cues.push("Cosmetic procedures are covered.");
    }
    if (
      (hi
        ? /क्या मैं|क्या हम|चाहेंगे|अनुमति/u
        : /వచ్చా|వచ్చునా|కలిసి.*(?:చర్చ|పరిశీల)|మీ అనుమతి/u
      ).test(sentence)
    )
      cues.push("Could we discuss this together?");
    const review = hi ? /समीक्षा|पढ़|देख|जाँच/u : /పరిశీల|చదవ|సమీక్ష|ధృవీకర/u;
    const document = hi
      ? /सारांश|पॉलिसी|दस्तावेज|शर्त/u
      : /సారాంశ|పాలసీ|పత్ర|నిబంధన/u;
    if (review.test(sentence) && document.test(sentence))
      cues.push("Review the policy terms.");
    if (
      (hi
        ? /समय लें|बिना दबाव|दबाव नहीं|निर्णय.*पहले|फैसल.*पहले|बाद.*निर्णय/u
        : /సమయం తీసు|ఒత్తిడి (?:లేదు|చేయను)|నిర్ణయ.*ముందు|పరిశీలించిన తర్వాతే.*నిర్ణయ|అర్థం చేసుకున్న తర్వాతే.*నిర్ణయ/u
      ).test(sentence)
    )
      cues.push("Take your time to review before you decide.");
    if (
      question &&
      review.test(sentence) &&
      document.test(sentence) &&
      (hi ? /भेज|साझा/u : /పంప|పంచు/u).test(sentence)
    )
      cues.push("May I send a policy summary for review before you decide?");
    if (
      (hi
        ? /अभी.*(?:खरीद|हस्ताक्षर)/u
        : /ఇప్పుడే.*(?:కొన|తీసుకో)|వెంటనే.*సంతకం/u
      ).test(sentence) &&
      !(hi ? /नहीं|मत/u : /చేయను|వద్దు|అవసరం లేదు/u).test(sentence)
    )
      cues.push("Buy now.");
  }
  // Return only rule cues: raw/code-switched text is checked separately for
  // English patterns without letting source words accidentally alter a cue.
  return `${text}\n${cues.join("\n")}`;
}

// These bounded contradictions concern the supplied fictional exercise, not
// general insurance regulations. Generic comparisons alone are not penalized.
export function pinnedFactConflicts(
  text: string,
  locale: PracticeLocale,
): string[] {
  const s = latinDigits(text).normalize("NFC");
  const reasons: string[] = [];
  if (locale === "te-IN") {
    if (
      /ఈ\s+(?:ఉదాహరణ|అభ్యాస)\s+ప్లాన్[కు్‌లో\s]{0,8}[^.!?\n]{0,45}(?:నిర్దిష్ట|నిర్ధారిత|నిర్ధారించ|ఖచ్చితమైన)[^.!?\n]{0,30}(?:లేవు|ఇవ్వలేదు|పేర్కొనలేదు|నిర్ధారించలేదు)/u.test(
        s,
      )
    )
      reasons.push(
        "The supplied exercise has fixed facts; this answer says its terms or amounts are unspecified.",
      );
    if (
      /ముందుగా ఉన్న వ్యాధులకు\s*(?:\*\*)?36\s*నెలల/u.test(s) &&
      !/గరిష్ఠ|సాధారణ|24\s*నెలల/u.test(s)
    )
      reasons.push(
        "The exercise sets 24 months for pre-existing conditions, not 36 months.",
      );
    if (/₹1,250[^.!?\n]{0,100}(?:స్థిరమని నిర్ధారించలేం|మారవచ్చు)/u.test(s))
      reasons.push(
        "The exercise premium is fixed at ₹1,250; this answer suggests it varies.",
      );
  } else if (locale === "hi-IN") {
    if (
      /इस\s+(?:अभ्यास|उदाहरण)[^।.!?\n]{0,60}(?:शर्तें|प्रीमियम|राशि)[^।.!?\n]{0,40}(?:तय नहीं|निर्दिष्ट नहीं)/u.test(
        s,
      )
    )
      reasons.push(
        "The supplied exercise has fixed facts; this answer says its terms or amounts are unspecified.",
      );
    if (
      /पहले से मौजूद[^।.!?\n]{0,25}36\s*महीन/u.test(s) &&
      !/अधिकतम|सामान्य|24\s*महीन/u.test(s)
    )
      reasons.push(
        "The exercise sets 24 months for pre-existing conditions, not 36 months.",
      );
  }
  return reasons;
}
