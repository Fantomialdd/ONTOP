import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Question } from "./quiz";

const MODELE = "openai/gpt-6-astra";

async function appelIA(instructions: string, content: Array<Record<string, unknown>>) {
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText } = await import("ai");
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Clé IA manquante.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses(MODELE),
    instructions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: content as any }],
    providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
  });
  return await result.text;
}

function extraireJson(t: string): unknown {
  const a = t.indexOf("["), b = t.lastIndexOf("]");
  if (a < 0 || b < a) return [];
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return []; }
}

export const genererQuizIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { texte: string; n?: number }) => ({ texte: String(d.texte).slice(0, 12000), n: Math.min(10, Math.max(3, d.n ?? 6)) }))
  .handler(async ({ data }): Promise<{ questions: Question[]; erreur?: string }> => {
    try {
      const txt = await appelIA(
        `Tu es professeur. À partir du cours fourni, crée exactement ${data.n} questions QCM en français, variées (définitions, compréhension, application), avec 4 choix courts dont un seul correct. Réponds UNIQUEMENT par un tableau JSON : [{"enonce":"...","choix":["a","b","c","d"],"bonne":0}] où bonne est l'index (0-3) de la bonne réponse.`,
        [{ type: "text", text: data.texte }],
      );
      const brut = extraireJson(txt);
      const qs = (Array.isArray(brut) ? brut : []).filter((q): q is Question =>
        q && typeof q.enonce === "string" && Array.isArray(q.choix) && q.choix.length === 4 && q.choix.every((c: unknown) => typeof c === "string") &&
        Number.isInteger(q.bonne) && q.bonne >= 0 && q.bonne < 4,
      ).map((q) => ({ enonce: q.enonce.slice(0, 300), choix: q.choix.map((c) => c.slice(0, 120)), bonne: q.bonne }));
      return { questions: qs };
    } catch (e) {
      console.error("genererQuizIA", e);
      return { questions: [], erreur: "L'IA n'a pas pu générer de questions." };
    }
  });

/** Lit un fichier que le navigateur ne sait pas lire (image, scan…) et renvoie son texte. */
export const lireFichierIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dataUrl: string; mime: string; nom: string }) => {
    if (typeof d.dataUrl !== "string" || d.dataUrl.length > 14_000_000) throw new Error("Fichier trop lourd (max 10 Mo).");
    return { dataUrl: d.dataUrl, mime: String(d.mime || "application/octet-stream"), nom: String(d.nom).slice(0, 100) };
  })
  .handler(async ({ data }): Promise<{ texte: string; erreur?: string }> => {
    try {
      const fichier = data.mime.startsWith("image/")
        ? { type: "image", image: data.dataUrl, mediaType: data.mime }
        : { type: "file", data: data.dataUrl, mediaType: data.mime, filename: data.nom };
      const texte = await appelIA(
        "Retranscris fidèlement en français le contenu pédagogique de ce document (texte, schémas décrits brièvement). Réponds uniquement avec le texte du cours, sans commentaire.",
        [{ type: "text", text: `Fichier : ${data.nom}` }, fichier],
      );
      return { texte: texte.trim().slice(0, 12000) };
    } catch (e) {
      console.error("lireFichierIA", e);
      return { texte: "", erreur: "Impossible de lire ce fichier avec l'IA." };
    }
  });
