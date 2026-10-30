import type { PracticeLocale } from "./content";
export function latinDigits(text: string) {
  return text.replace(/[०-९౦-౯]/g, (c) =>
    String(c.codePointAt(0)! - (c >= "౦" ? 0x0c66 : 0x0966)),
  );
}
// Bounded locale-specific phrase rules. Derived English cues are internal rule
// input only; original messages are never replaced by a machine translation.
export function canonicalForRules(text: string, locale: PracticeLocale) {
  if (locale === "en-IN") return text;
  const source = latinDigits(text).replace(/(?<=\d),(?=\d)/g, "");
  const cues: string[] = [];
  const hi = locale === "hi-IN";
  for (const clause of source.match(/[^।.!?;,\n]+[।.!?;,\n]?/gu) ?? []) {
    const question = /[?？]|क्या|कितना|क्यों|बताइ|ఎంత|ఎందుకు|చెప్పండి/u.test(
      clause,
    );
    const budget = hi ? /बजट|खर्च|वहन/u : /బడ్జెట్|ఖర్చు|భరించ/u;
    const experience = hi
      ? /अनुभव|पहले.*दाव|चिंता.*क्यों|क्यों.*चिंता/u
      : /అనుభవ|గత.*క్లెయిమ్|ఆందోళన.*ఎందుకు|ఎందుకు.*ఆందోళన/u;
    if (question && budget.test(clause)) cues.push("What is your budget?");
    if (question && experience.test(clause))
      cues.push("What was your past experience?");
    const claim = hi ? /दाव|क्लेम|स्वीकृति|मंजूर/u : /క్లెయిమ్|ఆమోద|మంజూర/u;
    const guarantee = hi
      ? /गारंटी|हमेशा|सभी.*मंजूर|हर.*मंजूर/u
      : /హామీ|గ్యారెంటీ|తప్పకుండా|ప్రతి.*ఆమోద/u;
    const negation = hi ? /नहीं|नही|न दे|बिना/u : /లేదు|లేను|కాదు|కావు|ఇవ్వలే/u;
    if (claim.test(clause) && guarantee.test(clause) && !question)
      cues.push(
        negation.test(clause)
          ? "Approval is never guaranteed."
          : "All claims are guaranteed.",
      );
    if (
      claim.test(clause) &&
      (hi ? /समीक्षा|मूल्यांकन|जाँच/u : /పరిశీల|సమీక్ష/u).test(clause) &&
      !question
    )
      cues.push("Claims are reviewed.");
    if (
      (hi ? /चिंता.*समझ|समझ.*चिंता/u : /ఆందోళన.*అర్థం|అర్థం.*ఆందోళన/u).test(
        clause,
      )
    )
      cues.push("I understand your concern.");
    if (question) {
      if ((hi ? /प्रीमियम|कीमत|मासिक/u : /ప్రీమియం|ధర|నెలవారీ/u).test(clause))
        cues.push("What is the monthly premium?");
      if ((hi ? /प्रतीक्षा|इंतजार/u : /వేచి|నిరీక్షణ/u).test(clause))
        cues.push("What is the initial waiting period?");
      if (
        (hi
          ? /अपवर्जन|कॉस्मेटिक|कवर नहीं/u
          : /మినహాయిం|కాస్మెటిక్|కవర్ కావు/u
        ).test(clause)
      )
        cues.push("Which treatments are excluded?");
      if (claim.test(clause)) cues.push("How are claims assessed?");
      if (
        (hi ? /भेज|साझा|समीक्षा/u : /పంప|పంచు|సమీక్ష/u).test(clause) &&
        (hi ? /सारांश|पॉलिसी|शर्त/u : /సారాంశ|పాలసీ|నిబంధన/u).test(clause)
      )
        cues.push("May I send a policy summary for review before you decide?");
      else if (
        (hi ? /क्या मैं|क्या हम|चाहेंगे/u : /వచ్చా|వచ్చునా|మనం/u).test(clause)
      )
        cues.push("Could we discuss this together?");
      continue;
    }
    if (
      (hi ? /प्रीमियम|प्रति माह|मासिक/u : /ప్రీమియం|నెలకు|నెలవారీ/u).test(
        clause,
      )
    ) {
      if (/1250/.test(clause)) cues.push("The monthly premium is ₹1,250.");
      else {
        const number = clause.match(/\d[\d]*/)?.[0];
        if (number) cues.push(`The premium is ₹${number}.`);
      }
    }
    if (/500000|5\s*(?:लाख|లక్ష)/u.test(clause))
      cues.push("The coverage limit is ₹5,00,000.");
    const waiting = hi ? /प्रतीक्षा|इंतजार/u : /వేచి|నిరీక్షణ/u;
    if (waiting.test(clause)) {
      if (/30/.test(clause))
        cues.push("A 30-day initial waiting period applies.");
      if (
        (hi
          ? /कोई.*नहीं|प्रतीक्षा.*नहीं/u
          : /కాలం.*లేదు|వేచి.*అవసరం లేదు/u
        ).test(clause)
      )
        cues.push("No waiting period.");
      if (
        /24/.test(clause) &&
        (hi ? /पहले|मौजूद|बीमारी/u : /ముందు|వ్యాధ/u).test(clause)
      )
        cues.push("Pre-existing conditions have a 24-month waiting period.");
    }
    if ((hi ? /कॉस्मेटिक/u : /కాస్మెటిక్/u).test(clause))
      cues.push(
        negation.test(clause) ||
          (hi ? /अपवर्जित|बाहर/u : /మినహాయిం/u).test(clause)
          ? "Cosmetic procedures are excluded."
          : "Cosmetic procedures are covered.",
      );
    if (
      (hi
        ? /समय लें|समय ले|बिना दबाव|दबाव नहीं|फैसला.*पहले|निर्णय.*पहले/u
        : /సమయం తీసు|ఒత్తిడి లేదు|ఒత్తిడి లేకుండా|నిర్ణయ.*ముందు/u
      ).test(clause)
    )
      cues.push("Take your time to review before you decide.");
    if (
      (hi ? /अभी.*खरीद|अभी.*हस्ताक्षर/u : /ఇప్పుడే.*కొన|వెంటనే.*సంతకం/u).test(
        clause,
      )
    )
      cues.push("Buy now.");
  }
  return `${source}\n${cues.join("\n")}`;
}
