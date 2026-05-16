// ─── ORION AI MODULE — Prompt Generator ─────────────────────────────────────
// Generates rich context prompts to be copied into external AI tools (ChatGPT, Gemini, etc.)

import { calcAge } from './persons.js';

export function buildPersonContext(person, interactions = []) {
  const traits = person.traits || {};
  return `
=== PERSON PROFIL ===
Name: ${person.name || '–'}
Alter: ${person.birthday ? calcAge(person.birthday) + ' J.' : (person.age ? person.age + ' J.' : '–')}  Beruf: ${person.job || '–'}  Standort: ${person.location || '–'}
Risiko-Level: ${person.riskLevel || '–'}  Vertrauen: ${person.trustLevel ?? '–'}/10  Einfluss: ${person.influenceLevel ?? '–'}/10
Persönlichkeitstyp: ${person.personalityType || '–'}

=== TRAIT-MATRIX (0-10) ===
Narzissmus: ${traits.narzissmus ?? '–'}  |  Empathie: ${traits.empathie ?? '–'}  |  Dominanz: ${traits.dominanz ?? '–'}
Manipulation: ${traits.manipulation ?? '–'}  |  Loyalität: ${traits.loyalitaet ?? '–'}  |  Impulsivität: ${traits.impulsivitaet ?? '–'}
Stressresistenz: ${traits.stressresistenz ?? '–'}  |  Ehrlichkeit: ${traits.ehrlichkeit ?? '–'}  |  Introvert↔Extravert: ${traits.introvert ?? '–'}
Denkweise: ${(person.denkweise || []).join(', ') || '–'}
Motivationen: ${(person.motivationen || []).join(', ') || '–'}

=== STATUS ===
Status: ${person.status || '–'}  |  Wichtigkeit: ${person.importance ?? '–'}/10
Notizen: ${person.notes || '–'}

${interactions.length > 0 ? `=== LETZTE INTERAKTIONEN (${interactions.length}) ===\n${interactions.slice(0, 15).map(i => `[${i.type} | ${new Date(i.date).toLocaleDateString('de-DE')}] ${i.content}`).join('\n')}` : ''}
`.trim();
}

export function quickAnalysis(person) {
  return `Du bist ein psychologischer Berater und Kommunikationsexperte.
Analysiere diese Person und gib präzise, direkte Antworten auf Deutsch.

${buildPersonContext(person)}

Gib mir:
• WER ist diese Person in einem Satz
• WAS will sie (tatsächliche Motivation)
• WIE kommuniziert man optimal mit ihr (3 konkrete Tipps)
• WAS sollte VERMIEDEN werden (2 Punkte)
• VERSTECKTE AGENDA (wahrscheinlichste Hintergedanken)

Antwort: strukturiert mit Bullet-Points, max. 300 Wörter.`;
}

export function deepAnalysis(person, interactions = []) {
  return `Du bist ein forensischer Psychologe und Intelligence-Analyst.
Erstelle eine TIEFENANALYSE auf Deutsch.

${buildPersonContext(person, interactions)}

Analysiere strukturiert:

## 1. PSYCHOLOGISCHES KERN-PROFIL
Hauptpersönlichkeitsstruktur, dominante Verhaltenstendenzen

## 2. SCHWACHSTELLEN & DRUCKPUNKTE
Psychologische Trigger, Unsicherheiten, Wunden

## 3. MOTIVATIONSSTRUKTUR
Tatsächliche vs. vorgegebene Motivationen, unbewusste Antreiber

## 4. EMOTIONALE MUSTER
Reaktionsmuster unter Stress, emotionale Regulationsstrategien

## 5. MÖGLICHE VERSTECKTE ABSICHTEN
Wahrscheinlichste Hintergedanken basierend auf dem Profil

## 6. MANIPULATIONSSTRATEGIEN
Wie manipuliert diese Person andere? Welche Taktiken nutzt sie?

Antwort: detailliert, präzise, max. 500 Wörter.`;
}

export function conflictRisk(person, interactions = []) {
  return `Du bist ein Risiko- und Verhaltensanalyst.
Bewerte das Konflikt- und Verratrisiko für diese Person (Deutsch).

${buildPersonContext(person, interactions)}

Gib mir:
• VERRATRISIKO: Einschätzung & Begründung
• KONFLIKTRISIKO: Einschätzung & Begründung
• LOYALITÄTSEINSCHÄTZUNG: realistisch und direkt
• TOP 3 WARNSIGNALE die beobachtet werden müssen
• EMPFOHLENE STRATEGIE für den Umgang

Antwort: klar, präzise.`;
}

export function negotiationAdvice(person, context = '') {
  return `Du bist ein Verhandlungsexperte und strategischer Berater.
Erstelle eine Verhandlungsstrategie auf Deutsch.

${buildPersonContext(person)}

Verhandlungsziel/Kontext: ${context || 'Nicht spezifiziert. Bitte generelle Verhandlungstipps geben.'}

Gib mir:
• 3 ARGUMENTE die wahrscheinlich funktionieren (warum sie bei dieser Person wirken)
• 2 ARGUMENTE/ANSÄTZE die vermieden werden sollen
• OPTIMALER ZEITPUNKT & SETTING für das Gespräch
• UMGANG MIT ABLEHNUNG — was tun wenn sie Nein sagen?
• STÄRKSTES ARGUMENT in einem Satz

Antwort: umsetzbar, konkret, max. 300 Wörter.`;
}

export function strategyMode(person) {
  return `Du bist ein strategischer Berater und Kommunikationsexperte.
Erstelle eine Kommunikations- & Umgangsstrategie auf Deutsch.

${buildPersonContext(person)}

Erstelle einen strukturierten Strategieplan:

## KOMMUNIKATIONSSTIL
Wie, wann, wo und in welchem Ton kommunizieren?

## VERTRAUENSAUFBAU
Konkrete Schritte um Vertrauen zu gewinnen

## DEESKALATIONSSTRATEGIEN
Was bei Konflikten oder Aggressionen tun?

## LANGFRISTIGE POSITIONIERUNG
Wie sich strategisch gut aufstellen?

## WANN DISTANZIERUNG BESSER IST
Klare Signale zum Rückzug

Antwort: praktisch, umsetzbar, max. 400 Wörter.`;
}

export function detectContradictions(person, interactions = []) {
  const log = interactions.map(i => `[${i.type} | ${new Date(i.date).toLocaleDateString('de-DE')}] ${i.content}`).join('\n');
  return `Du bist ein Verhaltens- und Lügenanalyst.
Analysiere diese Interaktionen auf Widersprüche und Anomalien (Deutsch).

Person: ${person.name}

Interaktions-Log:
${log}

Identifiziere:
• DIREKTE WIDERSPRÜCHE in Aussagen (mit Datum und Zitat wenn möglich)
• VERHALTENSÄNDERUNGEN über Zeit (wann und wie hat sich die Person verändert?)
• VERDÄCHTIGE MUSTER (wiederkehrende Verhaltensweisen die auffällig sind)
• WAHRSCHEINLICHE LÜGEN/AUSLASSUNGEN (mit Begründung)
• GESAMTEINSCHÄTZUNG der Glaubwürdigkeit

Antwort: analytisch, konkret, max. 400 Wörter.`;
}
