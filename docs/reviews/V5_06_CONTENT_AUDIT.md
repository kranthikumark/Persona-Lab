# Hindi and Telugu content audit

October 29, 2026. Conducted by Codex as an AI content and engineering review. This is not a fluent-speaker approval or an independent linguistic assessment.

| Canonical exercise fact | Hindi draft | Telugu draft |
| --- | --- | --- |
| ₹1,250 per month, fixed for this exercise | Amount, monthly unit and fixed qualifier present | Amount, monthly unit and fixed qualifier present |
| Up to ₹5,00,000 per policy year for eligible covered hospitalization, subject to terms | Amount, annual unit, eligibility and conditions present | Amount, annual unit, eligibility and conditions present |
| Initial 30-day wait, except covered accidents | Duration, initial qualifier and accident exception present | Duration, initial qualifier and accident exception present |
| Cosmetic and non-prescribed treatments excluded | Both exclusions and negative coverage wording present | Both exclusions and negative coverage wording present |
| Pre-existing conditions have a 24-month wait | Duration and pre-existing qualifier present | Duration and pre-existing qualifier present |
| Claims reviewed against terms/documents; approval never guaranteed | Review and negation present | Review and negation present |

The scenario presentation remains immutable at its existing draft revision. No scenario translation was silently replaced. Coaching/report wording is a separately fingerprinted draft in `V5_06_REVIEW_DIGESTS.json`; the English feedback metadata remains authoritative.

## Findings resolved in software

The earlier Telugu evaluator split coordinated exclusion lists at commas and treated a cosmetic mention as affirmative coverage. It also missed `అర్థమవుతోంది` acknowledgement wording. V5 has sentence-preserving recognition, explicit affirmative-coverage detection, acknowledgement variants, review-before-decision recognition and regression tests. The earlier v4 engine is frozen for saved-report validation.

## Human review record

- Telugu: user volunteered to review on October 29. No corrections, approval or target-reader results have been supplied yet.
- Hindi: no fluent reviewer assigned. No approval recorded.
- No unreviewed draft is marked reviewed or activated for production.

Review the scenario and coaching packets and inspect the sample PDF and Word documents on the reader you intend to use. In particular check idiomatic phrasing, respectful address, negation, conjuncts, screen-reader pronunciation and whether the improvement guidance is understandable. Report approval or exact corrections separately for each language, with the corresponding hash. Generic software passes do not fill this record.
