/** Génération de questions de combat à partir du texte d'un cours. Logique pure. */
export type Question = { enonce: string; choix: string[]; bonne: number };

const VIDES = new Set(["alors", "avoir", "cette", "comme", "entre", "leurs", "nous", "pour", "quand", "toute", "toutes", "votre", "notre", "elles", "aussi", "depuis", "encore", "après", "avant", "chaque", "autre", "autres", "celui", "celle", "faire", "ainsi", "lorsque", "parce", "permet", "était", "peuvent", "plusieurs", "souvent", "toujours", "selon"]);
const MOT = /[A-Za-zÀ-ÿ0-9-]{5,}/g;

export const BANQUE: Question[] = [
  { enonce: "Quel protocole attribue automatiquement une adresse IP ?", choix: ["DHCP", "DNS", "FTP", "SMTP"], bonne: 0 },
  { enonce: "Le masque /24 correspond à…", choix: ["255.255.0.0", "255.255.255.0", "255.0.0.0", "255.255.255.128"], bonne: 1 },
  { enonce: "Quel port utilise HTTPS ?", choix: ["80", "21", "443", "22"], bonne: 2 },
  { enonce: "Quelle couche OSI gère le routage IP ?", choix: ["Physique", "Liaison", "Transport", "Réseau"], bonne: 3 },
  { enonce: "Quel service traduit un nom de domaine en IP ?", choix: ["DNS", "NAT", "VLAN", "ARP"], bonne: 0 },
  { enonce: "Quel protocole sert à l'administration à distance sécurisée ?", choix: ["Telnet", "SSH", "SNMP", "TFTP"], bonne: 1 },
  { enonce: "Un VLAN permet de…", choix: ["Chiffrer un disque", "Segmenter un réseau", "Sauvegarder des fichiers", "Accélérer le Wi-Fi"], bonne: 1 },
  { enonce: "Quel RAID offre la mise en miroir ?", choix: ["RAID 0", "RAID 1", "RAID 5", "JBOD"], bonne: 1 },
];

export function melange<T>(a: readonly T[], rnd = Math.random): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j]!, r[i]!]; }
  return r;
}

const utiles = (s: string) => (s.match(MOT) ?? []).filter((m) => !VIDES.has(m.toLowerCase()));

export function genererQuestions(texte: string, n = 5, rnd = Math.random): Question[] {
  const phrases = texte.split(/(?<=[.!?\n])\s+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 5);
  const mots = [...new Set(utiles(texte))];
  const qs: Question[] = [];
  if (mots.length >= 4) {
    for (const ph of melange(phrases, rnd)) {
      if (qs.length >= n) break;
      const cand = utiles(ph);
      if (!cand.length) continue;
      const rep = cand[Math.floor(rnd() * cand.length)]!;
      const faux = melange(mots.filter((m) => m.toLowerCase() !== rep.toLowerCase()), rnd).slice(0, 3);
      if (faux.length < 3) continue;
      const choix = melange([rep, ...faux], rnd);
      const enonce = ph.replace(rep, "_____");
      qs.push({ enonce: enonce.length > 240 ? enonce.slice(0, 237) + "…" : enonce, choix, bonne: choix.indexOf(rep) });
    }
  }
  return qs.length ? qs : melange(BANQUE, rnd).slice(0, n);
}
