/** Extraction de texte côté navigateur pour tout type de fichier de cours. */
const TEXTE = /\.(txt|md|markdown|csv|json|xml|html?|rtf|tex|ya?ml|log|ini|conf|sh|ps1|py|js|ts|java|c|cpp|cs|php|sql)$/i;

const nettoyer = (s: string) => s.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

async function pdf(buf: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return out.join("\n");
}

async function zipXml(buf: ArrayBuffer, filtre: RegExp) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const noms = Object.keys(zip.files).filter((n) => filtre.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const parts = await Promise.all(noms.map((n) => zip.file(n)!.async("string")));
  return parts.map((x) => x.replace(/<\/(a:p|text:p|text:h)>/g, "\n").replace(/<[^>]+>/g, " ")).join("\n");
}

export type Extraction = { texte: string } | { besoinIA: true };

export async function extraireTexte(f: File): Promise<Extraction> {
  const nom = f.name.toLowerCase();
  const buf = await f.arrayBuffer();
  let t = "";
  if (nom.endsWith(".pdf") || f.type === "application/pdf") t = await pdf(buf).catch(() => "");
  else if (nom.endsWith(".docx")) t = (await (await import("mammoth")).extractRawText({ arrayBuffer: buf })).value;
  else if (nom.endsWith(".pptx")) t = await zipXml(buf, /^ppt\/slides\/slide\d+\.xml$/);
  else if (nom.endsWith(".xlsx")) t = await zipXml(buf, /^xl\/sharedStrings\.xml$/);
  else if (/\.(odt|odp|ods)$/.test(nom)) t = await zipXml(buf, /^content\.xml$/);
  else if (TEXTE.test(nom) || f.type.startsWith("text/")) {
    t = new TextDecoder().decode(buf);
    if (/\.html?$/.test(nom)) t = new DOMParser().parseFromString(t, "text/html").body.textContent ?? "";
  }
  t = nettoyer(t);
  // PDF scanné, image, ou format inconnu : on confie la lecture à l'IA.
  return t.length >= 30 ? { texte: t } : { besoinIA: true };
}

export const versDataUrl = (f: File) => new Promise<string>((ok, ko) => {
  const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(f);
});
