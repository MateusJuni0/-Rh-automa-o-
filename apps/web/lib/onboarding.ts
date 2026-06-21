import type { MemoryFactKind } from "./assistant/memory";

/**
 * Onboarding (Tela 11, ASSISTENTE-PESSOAL §4.1): lista CONVERSACIONAL de 1º uso. Cada resposta vira
 * um `recruiter_memory_fact` (não é formulário rígido). Cobre estilo/comunicação, clientes, como
 * trabalha e PESSOAL (quanto mais melhor). Saltável e editável; a Vera mostra o que guardou.
 */
export interface OnboardingQuestion {
  /** Id estável (vai como `sourceRef` do facto). */
  id: string;
  /** A pergunta conversacional mostrada à recrutadora. */
  prompt: string;
  /** Categoria do facto na memória durável. */
  kind: MemoryFactKind;
  /** Exemplo no input para dar o tom. */
  placeholder: string;
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "assinatura",
    kind: "style",
    prompt: 'Como assinas os teus emails? (ex.: "Abraço, Filipa")',
    placeholder: "Abraço, Filipa",
  },
  {
    id: "tom-parecer",
    kind: "style",
    prompt: "Como gostas que os pareceres soem — diretos ao ponto, ou mais detalhados?",
    placeholder: "Diretos, com a conclusão primeiro",
  },
  {
    id: "valoriza-candidato",
    kind: "preference",
    prompt: 'Que tipo de candidato te faz dizer "este sim"?',
    placeholder: "Quem mostra o que fez, não só o que sabe",
  },
  {
    id: "red-flag",
    kind: "preference",
    prompt: "O que te faz logo desconfiar de um candidato?",
    placeholder: "Respostas vagas, sem exemplos concretos",
  },
  {
    id: "processo",
    kind: "pattern",
    prompt: "Tens algum passo que segues SEMPRE antes de enviar ao cliente?",
    placeholder: "Confirmo sempre a pretensão salarial e a disponibilidade",
  },
  {
    id: "template-email",
    kind: "template",
    prompt: "Tens um modelo de email de apresentação ao cliente? Cola aqui o essencial.",
    placeholder: "Olá {cliente}, segue o perfil da {candidato}…",
  },
  {
    id: "pessoal",
    kind: "preference",
    prompt: "Algo pessoal teu que a Vera deva saber? (quanto mais souber, melhor te ajuda)",
    placeholder: "Trabalho melhor de manhã; evito reuniões depois das 18h",
  },
];
