// ─── ORION PDF EXPORT ────────────────────────────────────────────────────
export async function exportPersonPDF(person, interactions, relationships, returnBlob = false) {
  // Lazy-load jsPDF
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const M = 20; // margin
  let y = M;

  const col = { bg: [13,15,20], panel: [23,27,38], cyan: [0,229,255], red: [255,45,85], gold: [255,215,0], text: [232,234,240], muted: [136,146,164] };

  // Background
  doc.setFillColor(...col.bg);
  doc.rect(0, 0, W, H, 'F');

  // Header bar
  doc.setFillColor(...col.panel);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFillColor(...col.cyan);
  doc.rect(0, 0, 4, 28, 'F');

  // Logo text
  doc.setTextColor(...col.cyan);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ORION', M, 12);
  doc.setFontSize(7);
  doc.setTextColor(...col.muted);
  doc.text('INTELLIGENCE SYSTEM', M, 18);

  // Report type
  doc.setFontSize(8);
  doc.setTextColor(...col.muted);
  doc.text('PERSON DOSSIER', W - M, 10, { align: 'right' });
  doc.setFontSize(7);
  doc.text(new Date().toLocaleDateString('de-DE', { year:'numeric', month:'long', day:'numeric' }), W - M, 17, { align: 'right' });

  y = 38;

  // Person name
  doc.setTextColor(...col.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(person.name || 'Unbekannt', M, y);
  y += 6;

  if (person.job) {
    doc.setFontSize(10);
    doc.setTextColor(...col.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(person.job + (person.location ? ' · ' + person.location : ''), M, y);
    y += 5;
  }

  // Risk badge
  const riskColor = person.riskLevel === 'kritisch' ? col.red : person.riskLevel === 'hoch' ? col.gold : col.cyan;
  doc.setFillColor(...riskColor);
  doc.roundedRect(M, y + 2, 28, 6, 1, 1, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text((person.riskLevel || 'UNBEKANNT').toUpperCase(), M + 2, y + 6.5);
  y += 14;

  // Divider
  doc.setDrawColor(...col.cyan);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 8;

  // Section: Grunddaten
  sectionHeader(doc, 'GRUNDDATEN', M, y, W, col);
  y += 8;
  const fields = [
    ['Name', person.name], ['Alter', person.age ? person.age + ' Jahre' : '–'],
    ['Beruf', person.job || '–'], ['Standort', person.location || '–'],
    ['Status', person.status || '–'], ['Wichtigkeit', (person.importance || 0) + '/10'],
    ['Vertrauen', (person.trustLevel || 0) + '/10'], ['Einfluss', (person.influenceLevel || 0) + '/10'],
    ['Aliase', person.aliases || '–'], ['Kontakt', person.contact || '–'],
  ];
  fields.forEach(([label, val]) => {
    doc.setFontSize(7);
    doc.setTextColor(...col.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(label.toUpperCase(), M, y);
    doc.setTextColor(...col.text);
    doc.text(String(val || '–'), M + 35, y);
    y += 5;
  });
  y += 4;

  // Section: Persönlichkeit
  doc.setDrawColor(...col.panel);
  doc.line(M, y, W - M, y);
  y += 6;
  sectionHeader(doc, 'PERSÖNLICHKEIT', M, y, W, col);
  y += 8;
  if (person.traits) {
    const traitNames = { narzissmus:'Narzissmus', empathie:'Empathie', dominanz:'Dominanz', manipulation:'Manipulation', loyalitaet:'Loyalität', ehrlichkeit:'Ehrlichkeit', stressresistenz:'Stressresistenz', impulsivitaet:'Impulsivität' };
    Object.entries(traitNames).forEach(([key, label]) => {
      const val = person.traits[key] ?? 5;
      doc.setFontSize(7);
      doc.setTextColor(...col.muted);
      doc.text(label, M, y);
      // Bar
      doc.setFillColor(...col.panel);
      doc.rect(M + 40, y - 3, 60, 3, 'F');
      doc.setFillColor(...col.cyan);
      doc.rect(M + 40, y - 3, 60 * (val / 10), 3, 'F');
      doc.setTextColor(...col.text);
      doc.text(String(val) + '/10', M + 104, y);
      y += 5;
    });
  }
  if (person.motivationen?.length) {
    y += 2;
    doc.setFontSize(7);
    doc.setTextColor(...col.muted);
    doc.text('MOTIVATIONEN', M, y);
    doc.setTextColor(...col.text);
    doc.text(person.motivationen.join(', '), M + 35, y);
    y += 5;
  }
  y += 4;

  // Section: Timeline
  if (interactions?.length > 0) {
    if (y > H - 70) { doc.addPage(); doc.setFillColor(...col.bg); doc.rect(0,0,W,H,'F'); y = M; }
    doc.setDrawColor(...col.panel);
    doc.line(M, y, W - M, y);
    y += 6;
    sectionHeader(doc, 'LETZTE INTERAKTIONEN', M, y, W, col);
    y += 8;
    interactions.slice(0, 10).forEach(i => {
      if (y > H - 20) { doc.addPage(); doc.setFillColor(...col.bg); doc.rect(0,0,W,H,'F'); y = M + 8; }
      doc.setFontSize(7);
      doc.setTextColor(...col.muted);
      doc.text(`${new Date(i.date).toLocaleDateString('de-DE')} · ${i.type}`, M, y);
      y += 4;
      doc.setTextColor(...col.text);
      const lines = doc.splitTextToSize(i.content || '', W - M * 2);
      lines.slice(0,3).forEach(l => { doc.text(l, M, y); y += 4; });
      y += 2;
    });
  }

  // Section: Notes
  if (person.notes) {
    if (y > H - 50) { doc.addPage(); doc.setFillColor(...col.bg); doc.rect(0,0,W,H,'F'); y = M; }
    y += 4;
    sectionHeader(doc, 'NOTIZEN', M, y, W, col);
    y += 8;
    doc.setFontSize(8);
    doc.setTextColor(...col.text);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(person.notes, W - M * 2);
    noteLines.forEach(l => { doc.text(l, M, y); y += 5; });
  }

  // Footer
  doc.setFillColor(...col.panel);
  doc.rect(0, H - 12, W, 12, 'F');
  doc.setFontSize(7);
  doc.setTextColor(...col.muted);
  doc.text('ORION INTELLIGENCE · STRENG VERTRAULICH · LOKALES DOKUMENT', W / 2, H - 4, { align: 'center' });

  const filename = `${(person.name || 'Person').replace(/\\s+/g,'_')}_Dossier_${new Date().toISOString().slice(0,10)}.pdf`;
  if (returnBlob) {
    return { filename, blob: doc.output('blob') };
  } else {
    doc.save(filename);
  }
}

function sectionHeader(doc, title, x, y, W, col) {
  doc.setFillColor(...col.cyan);
  doc.rect(x, y - 4, 3, 6, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...col.cyan);
  doc.text(title, x + 6, y);
}
