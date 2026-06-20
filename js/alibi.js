// ─── ORION ALIBI-PRÜFER ─────────────────────────────────────────────────────
// Analysiert die zeitlichen Überschneidungen und Widersprüche zwischen
// den Interaktionen aller Personen im System.

import { Interactions, Persons, Relationships } from './db.js';

// Zeitfenster (in ms) in dem zwei Ereignisse als "gleichzeitig" gelten
const SIMULTANEOUS_WINDOW_MS = 60 * 60 * 1000; // 1 Stunde
// Maximale geografische Distanz (km) für "an einem anderen Ort"
const MIN_DISTANCE_KM = 15;

/**
 * Hauptfunktion: Lädt alle Daten und führt alle Prüfungen durch.
 * @returns {Promise<AlibiReport>}
 */
export async function runAlibiScan() {
  const [allInteractions, allPersons] = await Promise.all([
    Interactions.listAll(),
    Persons.list(),
  ]);

  if (allInteractions.length < 2) {
    return { conflicts: [], stats: buildStats([], allInteractions, allPersons) };
  }

  const conflicts = [];

  // ─── Check 1: Ortskonflikt ────────────────────────────────────────────────
  // Eine Person kann nicht gleichzeitig an zwei verschiedenen Orten sein.
  const locationConflicts = detectLocationConflicts(allInteractions, allPersons);
  conflicts.push(...locationConflicts);

  // ─── Check 2: Gegenseitiger Alibi-Widerspruch ────────────────────────────
  // Person A behauptet, Person B zu einem Zeitpunkt getroffen zu haben,
  // aber Person B hat zur selben Zeit eine andere Interaktion an einem anderen Ort.
  const mutualConflicts = detectMutualAlibiConflicts(allInteractions, allPersons);
  conflicts.push(...mutualConflicts);

  // ─── Check 3: Sequenz-Anomalie ──────────────────────────────────────────
  // Eine Person wurde an zwei sehr weit entfernten Orten in unmöglicher Zeit gesehen.
  const sequenceConflicts = detectSequenceAnomalies(allInteractions, allPersons);
  conflicts.push(...sequenceConflicts);

  // Deduplizieren nach ID-Paar
  const seen = new Set();
  const unique = conflicts.filter(c => {
    const key = [c.personAId, c.personBId, c.type, Math.round(c.timeA / 3600000)].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sortieren: kritischste zuerst
  unique.sort((a, b) => b.severity - a.severity);

  return {
    conflicts: unique,
    stats: buildStats(unique, allInteractions, allPersons),
  };
}

/**
 * Führt den Alibi-Scan nur für eine einzelne Person durch.
 */
export async function runAlibiScanForPerson(personId) {
  const result = await runAlibiScan();
  result.conflicts = result.conflicts.filter(
    c => c.personAId === personId || c.personBId === personId
  );
  return result;
}

// ─── Detection Algorithms ────────────────────────────────────────────────────

function detectLocationConflicts(interactions, persons) {
  const conflicts = [];
  // Gruppiere nach personId
  const byPerson = groupBy(interactions, 'personId');

  for (const [personId, ixs] of Object.entries(byPerson)) {
    const person = persons.find(p => p.id === personId);
    if (!person) continue;

    // Nur Interaktionen mit Geo-Koordinaten
    const geoIxs = ixs.filter(i => i.lat != null && i.lng != null);
    if (geoIxs.length < 2) continue;

    // Paarvergleich innerhalb der selben Person
    for (let a = 0; a < geoIxs.length; a++) {
      for (let b = a + 1; b < geoIxs.length; b++) {
        const ia = geoIxs[a], ib = geoIxs[b];
        const timeDiff = Math.abs(new Date(ia.date) - new Date(ib.date));
        if (timeDiff > SIMULTANEOUS_WINDOW_MS) continue;

        const dist = haversineKm(ia.lat, ia.lng, ib.lat, ib.lng);
        if (dist < MIN_DISTANCE_KM) continue;

        conflicts.push({
          id: crypto.randomUUID(),
          type: 'LOCATION_CONFLICT',
          severity: dist > 100 ? 3 : dist > 50 ? 2 : 1,
          personAId: personId,
          personAName: person.name,
          personBId: personId, // same person
          personBName: person.name,
          timeA: new Date(ia.date).getTime(),
          timeB: new Date(ib.date).getTime(),
          label: '📍 Ortskonflikt',
          headline: `${person.name}: Zwei Orte gleichzeitig?`,
          detail: `Interaktion "${ia.type}" am ${formatDateTime(ia.date)} ${ia.location ? 'in ' + ia.location : `(${ia.lat?.toFixed(3)}, ${ia.lng?.toFixed(3)})`} und "${ib.type}" am ${formatDateTime(ib.date)} ${ib.location ? 'in ' + ib.location : `(${ib.lat?.toFixed(3)}, ${ib.lng?.toFixed(3)})`} — Distanz: ~${Math.round(dist)} km, Zeitdifferenz: ${formatDiff(timeDiff)}.`,
          colorVar: '--red',
          interactionA: ia,
          interactionB: ib,
        });
      }
    }
  }
  return conflicts;
}

function detectMutualAlibiConflicts(interactions, persons) {
  const conflicts = [];
  // Interaktionen mit involvedPersonId = gemeinsame Treffen
  const meetings = interactions.filter(i => i.involvedPersonId);

  for (const meeting of meetings) {
    const personA = persons.find(p => p.id === meeting.personId);
    const personB = persons.find(p => p.id === meeting.involvedPersonId);
    if (!personA || !personB) continue;

    const meetingTime = new Date(meeting.date).getTime();

    // Prüfe ob Person B in einem ähnlichen Zeitfenster etwas anderes hatte
    const bIxs = interactions.filter(i =>
      i.personId === meeting.involvedPersonId &&
      i.id !== meeting.id &&
      Math.abs(new Date(i.date).getTime() - meetingTime) < SIMULTANEOUS_WINDOW_MS
    );

    for (const bIx of bIxs) {
      // Wenn beide Koordinaten vorhanden sind und weit auseinander
      if (meeting.lat != null && bIx.lat != null) {
        const dist = haversineKm(meeting.lat, meeting.lng, bIx.lat, bIx.lng);
        if (dist < MIN_DISTANCE_KM) continue;

        conflicts.push({
          id: crypto.randomUUID(),
          type: 'MUTUAL_ALIBI_CONFLICT',
          severity: 3,
          personAId: personA.id,
          personAName: personA.name,
          personBId: personB.id,
          personBName: personB.name,
          timeA: meetingTime,
          timeB: new Date(bIx.date).getTime(),
          label: '🤝 Alibi-Widerspruch',
          headline: `Treffen mit ${personB.name} widerspricht ${personB.name}s eigenem Protokoll`,
          detail: `Laut ${personA.name}s Protokoll trafen sie sich am ${formatDateTime(meeting.date)}. Gleichzeitig hat ${personB.name} eine andere Interaktion ("${bIx.type}") am selben Zeitpunkt hinterlegt (~${Math.round(dist)} km entfernt).`,
          colorVar: '--gold',
          interactionA: meeting,
          interactionB: bIx,
        });
      } else {
        // Kein Geo, aber klarer Typ-Widerspruch
        if (['Lüge', 'Konflikt', 'Drohung'].includes(bIx.type)) {
          conflicts.push({
            id: crypto.randomUUID(),
            type: 'MUTUAL_ALIBI_SOFT',
            severity: 1,
            personAId: personA.id,
            personAName: personA.name,
            personBId: personB.id,
            personBName: personB.name,
            timeA: meetingTime,
            timeB: new Date(bIx.date).getTime(),
            label: '⚠ Zeitliche Überschneidung',
            headline: `${personB.name}: Konflikt-Ereignis zeitgleich mit dokumentiertem Treffen`,
            detail: `${personA.name} dokumentierte ein Treffen mit ${personB.name} am ${formatDateTime(meeting.date)}. Zur selben Zeit ist bei ${personB.name} ein "${bIx.type}"-Ereignis erfasst.`,
            colorVar: '--gold',
            interactionA: meeting,
            interactionB: bIx,
          });
        }
      }
    }
  }
  return conflicts;
}

function detectSequenceAnomalies(interactions, persons) {
  const conflicts = [];
  const byPerson = groupBy(interactions, 'personId');

  for (const [personId, ixs] of Object.entries(byPerson)) {
    const person = persons.find(p => p.id === personId);
    if (!person) continue;

    const geoIxs = ixs
      .filter(i => i.lat != null && i.lng != null)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    for (let i = 0; i < geoIxs.length - 1; i++) {
      const ia = geoIxs[i], ib = geoIxs[i + 1];
      const timeDiff = new Date(ib.date) - new Date(ia.date); // in ms
      if (timeDiff <= 0) continue;

      const dist = haversineKm(ia.lat, ia.lng, ib.lat, ib.lng);
      if (dist < MIN_DISTANCE_KM) continue;

      // Geschwindigkeit in km/h — über 900 km/h ist physisch unmöglich ohne Flugzeug
      const speedKmh = dist / (timeDiff / 3600000);
      if (speedKmh < 900) continue;

      conflicts.push({
        id: crypto.randomUUID(),
        type: 'SEQUENCE_ANOMALY',
        severity: speedKmh > 5000 ? 3 : 2,
        personAId: personId,
        personAName: person.name,
        personBId: personId,
        personBName: person.name,
        timeA: new Date(ia.date).getTime(),
        timeB: new Date(ib.date).getTime(),
        label: '🚨 Bewegungs-Anomalie',
        headline: `${person.name}: Physikalisch unmögliche Bewegung`,
        detail: `${Math.round(dist)} km in ${formatDiff(timeDiff)} — erfordert ~${Math.round(speedKmh)} km/h. Dies ist physikalisch nicht möglich (Flugzeug ~900 km/h). Ereignis "${ia.type}" am ${formatDateTime(ia.date)}, dann "${ib.type}" am ${formatDateTime(ib.date)}.`,
        colorVar: '--red',
        interactionA: ia,
        interactionB: ib,
      });
    }
  }
  return conflicts;
}

// ─── Stats Builder ───────────────────────────────────────────────────────────

function buildStats(conflicts, allInteractions, allPersons) {
  const personIds = new Set(conflicts.flatMap(c => [c.personAId, c.personBId]));
  return {
    totalConflicts: conflicts.length,
    criticalCount: conflicts.filter(c => c.severity >= 3).length,
    warningCount: conflicts.filter(c => c.severity === 2).length,
    infoCount: conflicts.filter(c => c.severity === 1).length,
    affectedPersons: personIds.size,
    scannedInteractions: allInteractions.length,
    scannedPersons: allPersons.length,
  };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * Math.PI / 180; }

function formatDateTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDiff(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
