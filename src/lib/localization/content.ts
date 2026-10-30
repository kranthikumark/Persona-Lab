import { publicScenario } from "@/lib/scenarios/public";
export type PracticeLocale = "en-IN" | "hi-IN" | "te-IN";
export const localizedContent = {
  "en-IN": {
    title: publicScenario.title,
    description: publicScenario.description,
    persona: publicScenario.character.persona,
    opening: publicScenario.opening,
    objectives: [...publicScenario.objectives],
    facts: publicScenario.approvedFacts.map((f) => ({ ...f })),
    labels: {
      begin: "Begin practice",
      brief: "Scenario brief",
      response: "Your response to Priya",
      send: "Send response",
      language: "Practice language",
      words: "words",
      remaining: "words remaining",
      fallback:
        "Interface and coaching are currently in English. Original responses are preserved.",
      review: "Awaiting language review",
      status: "Practice settings",
    },
    samples: [
      "The monthly premium is fixed at ₹1,250. What is your budget?",
      "Claims are reviewed; approval is never guaranteed. A 30-day initial waiting period applies except for covered accidents.",
      "Cosmetic procedures and non-prescribed treatments are excluded. Pre-existing conditions have a 24-month waiting period.",
      "Coverage is up to ₹5,00,000 per policy year for eligible covered hospitalization, subject to terms. May I send a summary for you to review before deciding?",
      "Thank you. Take your time reviewing the exclusions before deciding.",
    ],
  },
  "hi-IN": {
    title: "भरोसे की बातचीत",
    description:
      "एक सतर्क ग्राहक, एक जटिल पॉलिसी और बिना बढ़ा-चढ़ाकर वादा किए भरोसा बनाने का अवसर।",
    persona:
      "प्रिया विचारशील, संशयशील और स्पष्ट बोलने वाली संभावित ग्राहक है। उसे अपवर्जनों, अस्वीकृत दावों और खर्च की चिंता है। विनम्र, स्वाभाविक हिन्दी में बात करें।",
    opening:
      "मैंने कुछ पॉलिसियाँ देखी हैं। जब तक दावा करने की जरूरत नहीं पड़ती, सभी भरोसेमंद लगती हैं। मैं कैसे जानूँ कि यह पॉलिसी अलग होगी?",
    objectives: [
      "समझें कि प्रिया के लिए क्या महत्वपूर्ण है",
      "काल्पनिक पॉलिसी की शर्तें सही ढंग से समझाएँ",
      "बिना दबाव के एक उचित अगले कदम पर सहमति बनाएँ",
    ],
    facts: [
      {
        id: "price",
        title: "मासिक प्रीमियम",
        detail:
          "इस अभ्यास की काल्पनिक योजना का प्रीमियम ₹1,250 प्रति माह है। इस अभ्यास में कीमत निश्चित है।",
      },
      {
        id: "limit",
        title: "कवरेज की सीमा",
        detail:
          "शर्तों के अधीन, पात्र और कवर किए गए अस्पताल में भर्ती के खर्चों के लिए प्रति पॉलिसी वर्ष अधिकतम ₹5,00,000 का कवरेज है।",
      },
      {
        id: "waiting",
        title: "प्रतीक्षा अवधि",
        detail:
          "कवर की गई दुर्घटनाओं को छोड़कर, 30 दिन की शुरुआती प्रतीक्षा अवधि लागू होती है।",
      },
      {
        id: "exclusions",
        title: "अपवर्जन",
        detail:
          "कॉस्मेटिक प्रक्रियाएँ और डॉक्टर द्वारा निर्धारित न किए गए उपचार कवर नहीं हैं। पहले से मौजूद बीमारियों के लिए 24 महीने की प्रतीक्षा अवधि है।",
      },
      {
        id: "claims",
        title: "दावों की समीक्षा",
        detail:
          "हर दावे का मूल्यांकन पॉलिसी की शर्तों और आवश्यक दस्तावेजों के आधार पर होता है। स्वीकृति की कभी गारंटी नहीं दी जाती।",
      },
    ],
    labels: {
      begin: "अभ्यास शुरू करें",
      brief: "परिदृश्य का विवरण",
      response: "प्रिया को आपका जवाब",
      send: "जवाब भेजें",
      language: "अभ्यास की भाषा",
      words: "शब्द",
      remaining: "शब्द बाकी",
      fallback:
        "इंटरफ़ेस और प्रतिक्रिया फिलहाल अंग्रेज़ी में हैं। आपके मूल जवाब सुरक्षित रखे जाते हैं।",
      review: "भाषा समीक्षा बाकी है",
      status: "अभ्यास की सेटिंग",
    },
    samples: [
      "मासिक प्रीमियम ₹1,250 तय है। आपका बजट कितना है?",
      "दावों की समीक्षा होती है; स्वीकृति की गारंटी नहीं है। कवर की गई दुर्घटनाओं को छोड़कर 30 दिन की शुरुआती प्रतीक्षा अवधि लागू होती है।",
      "कॉस्मेटिक प्रक्रियाएँ और डॉक्टर द्वारा निर्धारित न किए गए उपचार कवर नहीं हैं। पहले से मौजूद बीमारियों के लिए 24 महीने की प्रतीक्षा अवधि है।",
      "शर्तों के अधीन पात्र अस्पताल में भर्ती के लिए प्रति पॉलिसी वर्ष अधिकतम ₹5,00,000 का कवरेज है। क्या मैं आपके निर्णय से पहले समीक्षा के लिए पॉलिसी का सारांश भेज सकता हूँ?",
      "धन्यवाद। फैसला करने से पहले अपवर्जनों को पढ़ने के लिए समय लें।",
    ],
  },
  "te-IN": {
    title: "నమ్మకాన్ని పెంచే సంభాషణ",
    description:
      "జాగ్రత్తగా ఆలోచించే కస్టమర్, క్లిష్టమైన పాలసీ, అతిశయమైన హామీలు ఇవ్వకుండా నమ్మకం సంపాదించే అవకాశం.",
    persona:
      "ప్రియ ఆలోచనాత్మకంగా, సందేహాలను స్పష్టంగా అడిగే కస్టమర్. మినహాయింపులు, తిరస్కరించిన క్లెయిమ్‌లు, ఖర్చు గురించి ఆమెకు ఆందోళన ఉంది. మర్యాదపూర్వకమైన సహజ తెలుగులో మాట్లాడండి.",
    opening:
      "నేను కొన్ని పాలసీలు చూశాను. క్లెయిమ్ చేయాల్సి వచ్చేంతవరకు అన్నీ భరోసాగా అనిపిస్తాయి. ఈ పాలసీ భిన్నంగా ఉంటుందని నాకు ఎలా తెలుస్తుంది?",
    objectives: [
      "ప్రియకు ముఖ్యమైన విషయాలను తెలుసుకోండి",
      "కల్పిత పాలసీ నిబంధనలను సరిగ్గా వివరించండి",
      "ఒత్తిడి లేకుండా తగిన తదుపరి చర్యను నిర్ణయించండి",
    ],
    facts: [
      {
        id: "price",
        title: "నెలవారీ ప్రీమియం",
        detail:
          "ఈ అభ్యాసంలోని కల్పిత ప్లాన్ ప్రీమియం నెలకు ₹1,250. ఈ అభ్యాసంలో ధర స్థిరంగా ఉంటుంది.",
      },
      {
        id: "limit",
        title: "కవరేజ్ పరిమితి",
        detail:
          "నిబంధనలకు లోబడి, అర్హత ఉన్న కవర్ అయ్యే ఆసుపత్రి చికిత్సకు ప్రతి పాలసీ సంవత్సరంలో గరిష్ఠంగా ₹5,00,000 వరకు కవరేజ్ ఉంటుంది.",
      },
      {
        id: "waiting",
        title: "వేచి ఉండే కాలం",
        detail:
          "కవర్ అయ్యే ప్రమాదాలకు మినహా, ప్రారంభంలో 30 రోజుల వేచి ఉండే కాలం వర్తిస్తుంది.",
      },
      {
        id: "exclusions",
        title: "మినహాయింపులు",
        detail:
          "కాస్మెటిక్ చికిత్సలు, వైద్యుడు సూచించని చికిత్సలు కవర్ కావు. ముందుగా ఉన్న వ్యాధులకు 24 నెలల వేచి ఉండే కాలం ఉంటుంది.",
      },
      {
        id: "claims",
        title: "క్లెయిమ్‌ల సమీక్ష",
        detail:
          "ప్రతి క్లెయిమ్‌ను పాలసీ నిబంధనలు, అవసరమైన పత్రాల ఆధారంగా పరిశీలిస్తారు. ఆమోదానికి ఎప్పుడూ హామీ ఉండదు.",
      },
    ],
    labels: {
      begin: "అభ్యాసం ప్రారంభించండి",
      brief: "సన్నివేశ వివరాలు",
      response: "ప్రియకు మీ సమాధానం",
      send: "సమాధానం పంపండి",
      language: "అభ్యాస భాష",
      words: "పదాలు",
      remaining: "పదాలు మిగిలాయి",
      fallback:
        "ఇంటర్‌ఫేస్, సూచనలు ప్రస్తుతం ఆంగ్లంలో ఉంటాయి. మీ అసలు సమాధానాలు అలాగే భద్రపరుస్తాం.",
      review: "భాషా సమీక్ష పెండింగ్‌లో ఉంది",
      status: "అభ్యాస సెట్టింగ్‌లు",
    },
    samples: [
      "నెలవారీ ప్రీమియం ₹1,250 స్థిరంగా ఉంటుంది. మీ బడ్జెట్ ఎంత?",
      "క్లెయిమ్‌లను పరిశీలిస్తారు; ఆమోదానికి హామీ లేదు. కవర్ అయ్యే ప్రమాదాలకు మినహా ప్రారంభంలో 30 రోజుల వేచి ఉండే కాలం వర్తిస్తుంది.",
      "కాస్మెటిక్ చికిత్సలు, వైద్యుడు సూచించని చికిత్సలు కవర్ కావు. ముందుగా ఉన్న వ్యాధులకు 24 నెలల వేచి ఉండే కాలం ఉంటుంది.",
      "నిబంధనలకు లోబడి అర్హత ఉన్న ఆసుపత్రి చికిత్సకు ప్రతి పాలసీ సంవత్సరంలో గరిష్ఠంగా ₹5,00,000 కవరేజ్ ఉంటుంది. నిర్ణయానికి ముందు సమీక్ష కోసం పాలసీ సారాంశాన్ని పంపవచ్చా?",
      "ధన్యవాదాలు. నిర్ణయించే ముందు మినహాయింపులు చదవడానికి సమయం తీసుకోండి.",
    ],
  },
} as const;
export type LocalePresentation = {
  title: string;
  description: string;
  persona: string;
  opening: string;
  objectives: readonly string[];
  facts: readonly { id: string; title: string; detail: string }[];
  labels: { [K in keyof (typeof localizedContent)["en-IN"]["labels"]]: string };
};
export function presentationFor(locale: PracticeLocale): LocalePresentation {
  const { samples: _samples, ...presentation } = localizedContent[locale];
  void _samples;
  return structuredClone(presentation) as LocalePresentation;
}
