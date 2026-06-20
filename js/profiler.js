// ─── ORION LOCAL PROFILER ENGINE ─────────────────────────────────────────────
// Analyzes person trait vectors client-side to generate deterministic psychological profiles.

export function analyzePersonality(p) {
  const traits = p.traits || {};
  const n = traits.narzissmus ?? 5;
  const e = traits.empathie ?? 5;
  const d = traits.dominanz ?? 5;
  const m = traits.manipulation ?? 5;
  const l = traits.loyalitaet ?? 5;
  const i = traits.impulsivitaet ?? 5;
  const s = traits.stressresistenz ?? 5;
  const h = traits.ehrlichkeit ?? 5;
  
  // 1. Archetype Assessment
  let archetype = "Ausgeglichener Typus";
  let description = "Zeigt ausgeglichene Charaktereigenschaften ohne extreme Tendenzen. Das Verhalten ist flexibel, meist rational und stark von der jeweiligen Situation und dem Umfeld geprägt.";
  let riskAssessment = "Geringes bis moderates Risiko. Verhält sich unter normalen Bedingungen loyal und berechenbar.";
  
  if (n >= 7 && e <= 4 && m >= 7) {
    archetype = "Der Machiavellist (Schatten-Stratege)";
    description = "Nutzt strategic Manipulation bei gleichzeitig niedriger emotionaler Empathie. Richtet Handlungen primär nach dem eigenen Vorteil, Macht und Status aus. Verträge und schriftliche Vereinbarungen sind im Umgang zwingend erforderlich.";
    riskAssessment = "Hoch. Neigt dazu, Vereinbarungen zu brechen, wenn sich ein deutlicher persönlicher Vorteil bietet. Misstrauen ist angebracht.";
  } else if (e >= 7 && l >= 7 && m <= 3) {
    archetype = "Der loyale Altruist (Unterstützer)";
    description = "Sehr empathisch, kooperativ und loyal. Sucht Harmonie und arbeitet gerne im Team. Reagiert stark positiv auf Vertrauensbeweise, Wertschätzung und ein faires Miteinander.";
    riskAssessment = "Sehr niedrig. Handelt aus Überzeugung moralisch und loyal. Kann jedoch bei anhaltender Ausbeutung abrupt den Kontakt abbrechen.";
  } else if (d >= 7 && i >= 7) {
    archetype = "Der impulsive Konfrontationstyp";
    description = "Stark dominanzorientiert mit geringer Impulskontrolle. Neigt bei Stress oder empfundener Missachtung zu defensiven oder aggressiven Ausbrüchen. Verhandlungen sollten absolut ruhig geführt werden.";
    riskAssessment = "Mittel bis hoch. Unberechenbar in emotionalen Ausnahmesituationen. Erhöhte Gefahr von verbalen Eskalationen.";
  } else if (s >= 8 && d >= 7 && e <= 4) {
    archetype = "Der kühle Pragmatiker (Analytiker)";
    description = "Extrem stressresistent, hochgradig rational und kontrolliert. Lässt sich nicht von Emotionen beeinflussen. Geht Verhandlungen rein datenbasiert und lösungsorientiert an.";
    riskAssessment = "Moderat. Loyalität existiert meist nur auf rationaler/vertraglicher Basis. Wechselt die Seiten, wenn die Logik es gebietet.";
  } else if (s <= 3 && e >= 6) {
    archetype = "Der sensible Vermittler";
    description = "Sehr feinfühlig und harmoniebedürftig, aber extrem stressanfällig. Zieht sich bei Konflikten sofort zurück. Benötigt ein ruhiges Umfeld und psychologische Sicherheit.";
    riskAssessment = "Niedrig (eher Eigenrisiko). Bricht unter Druck zusammen oder zieht sich zurück, stellt aber selten eine aktive Gefahr dar.";
  } else if (m >= 7 && e >= 6) {
    archetype = "Der charismatische Manipulator";
    description = "Besitzt hohe soziale Intelligenz und Empathie, nutzt diese jedoch gezielt, um die Emotionen anderer für eigene Zwecke zu steuern. Wirkt oft äußerst charmant und hilfsbereit.";
    riskAssessment = "Hoch. Gefährlich, da Manipulationen oft sehr spät erkannt werden. Erzeugt künstliche Abhängigkeiten.";
  }
  
  // 2. Tactical Behavioral Rules
  const doList = [];
  const dontList = [];
  
  if (i >= 6) {
    doList.push("Bleibe bei Impulsausbrüchen absolut ruhig, neutral und leise.");
    dontList.push("Lass dich nicht auf emotionale Wortgefechte oder Provokationen ein.");
  }
  if (m >= 6) {
    doList.push("Dokumentiere Vereinbarungen schriftlich (z.B. per E-Mail nach Gesprächen).");
    dontList.push("Verlasse dich nicht auf mündliche Versprechungen oder Zusagen.");
  }
  if (h <= 4) {
    doList.push("Hinterfrage Fakten und hole Zweitmeinungen oder Belege ein.");
    dontList.push("Glaube ungeprüften Rechtfertigungen oder Entschuldigungen nicht blind.");
  }
  if (n >= 6) {
    doList.push("Verpacke Kritik als Verbesserungsvorschlag für gemeinsame Ziele.");
    dontList.push("Kritisiere diese Person niemals direkt vor anderen oder verletze ihr Ego.");
  }
  if (e >= 7) {
    doList.push("Zeige ehrliches Interesse an ihren Ansichten und baue Rapport auf.");
    dontList.push("Behandle die Person nicht wie eine reine Ressource oder Nummer.");
  }
  if (s <= 3) {
    doList.push("Sorge in Gesprächen für eine entspannte, angstfreie Atmosphäre.");
    dontList.push("Setze keine aggressiven Deadlines oder unvorhergesehenen Druckmittel ein.");
  }
  
  // Fallbacks if lists are empty
  if (doList.length === 0) doList.push("Kommuniziere offen, klar und direkt.", "Halte Vereinbarungen beidseitig ein.");
  if (dontList.length === 0) dontList.push("Vermeide unklare Signale oder vage Aussagen.", "Hintergehe nicht das Vertrauen der Person.");

  // 3. Negotiation Strategy
  let setting = "Informelles, entspanntes Gespräch unter vier Augen";
  let argumentsList = [
    "Gemeinsamen Nutzen und Win-Win hervorheben",
    "Sicherheit und langfristige Stabilität betonen"
  ];
  
  if (d >= 7) {
    setting = "Formelles Meeting mit klarer Agenda";
    argumentsList = [
      "Ihre Entscheidungsfreiheit und Kontrollmöglichkeiten betonen",
      "Faktenbasierte und logische Vorteile präsentieren"
    ];
  } else if (n >= 7) {
    setting = "Exklusiver Rahmen (z.B. Geschäftsessen)";
    argumentsList = [
      "Den Reputationsgewinn und Statuszuwachs hervorheben",
      "Ihren persönlichen Beitrag als essenziell darstellen"
    ];
  } else if (s <= 3) {
    setting = "Sicheres, gewohntes Umfeld ohne Zeitdruck";
    argumentsList = [
      "Risikofreiheit und Absicherung bei Annahme betonen",
      "Konkrete Entlastung und Unterstützung anbieten"
    ];
  }
  
  return {
    archetype,
    description,
    riskAssessment,
    dos: doList,
    donts: dontList,
    negotiation: {
      setting,
      arguments: argumentsList
    }
  };
}

export function detectLocalContradictions(p, interactions = []) {
  const lies = interactions.filter(i => i.type === 'Lüge');
  const threats = interactions.filter(i => i.type === 'Drohung');
  const promises = interactions.filter(i => i.type === 'Versprechen');
  const conflicts = interactions.filter(i => i.type === 'Konflikt');

  const issues = [];
  if (lies.length > 0) {
    issues.push({
      type: 'Glaubwürdigkeit',
      title: 'Dokumentierte Falschaussagen (Lügen)',
      desc: `Es wurden ${lies.length} Fälle von bewussten Falschaussagen erfasst. Die Glaubwürdigkeit der Person ist stark kompromittiert.`,
      severity: 'red',
      items: lies.map(l => `[${new Date(l.date).toLocaleDateString('de-DE')}] ${l.content}`)
    });
  }
  if (threats.length > 0) {
    issues.push({
      type: 'Sicherheit',
      title: 'Aggressives Verhalten (Drohungen)',
      desc: `Die Person hat in ${threats.length} Fällen direkte oder indirekte Drohungen geäußert. Der Umgang erfordert erhöhte Sicherheitsvorkehrungen.`,
      severity: 'red',
      items: threats.map(t => `[${new Date(t.date).toLocaleDateString('de-DE')}] ${t.content}`)
    });
  }
  if (promises.length > 0) {
    issues.push({
      type: 'Zuverlässigkeit',
      title: 'Gegebene Versprechen',
      desc: `Es wurden ${promises.length} Zusagen oder Versprechen erfasst. Überprüfe, ob diese eingehalten wurden.`,
      severity: 'gold',
      items: promises.map(p => `[${new Date(p.date).toLocaleDateString('de-DE')}] ${p.content}`)
    });
  }
  if (conflicts.length > 0) {
    issues.push({
      type: 'Stabilität',
      title: 'Konfliktsituationen',
      desc: `Es gab ${conflicts.length} dokumentierte Konflikte mit dieser Person.`,
      severity: 'gold',
      items: conflicts.map(c => `[${new Date(c.date).toLocaleDateString('de-DE')}] ${c.content}`)
    });
  }

  return issues;
}
