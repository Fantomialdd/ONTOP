import { describe, expect, it } from "vitest";
import { BANQUE, genererQuestions } from "./quiz";

describe("genererQuestions", () => {
  it("cache la bonne réponse dans l'énoncé et la place parmi 4 choix", () => {
    const qs = genererQuestions("Le protocole DHCP distribue les adresses automatiquement. Le serveur DNS traduit les domaines en adresses numériques.", 2);
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      expect(q.choix).toHaveLength(4);
      expect(q.enonce).toContain("_____");
      expect(q.enonce).not.toContain(q.choix[q.bonne]!);
    }
  });
  it("utilise la banque SISR quand le cours est trop court", () => {
    expect(BANQUE.map((b) => b.enonce)).toContain(genererQuestions("court", 1)[0]!.enonce);
  });
});
