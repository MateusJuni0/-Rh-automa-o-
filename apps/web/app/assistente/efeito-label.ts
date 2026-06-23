/**
 * A linguagem humana da PORTA: traduz o efeito canónico no que a ação vai mesmo fazer.
 * Pura (sem JSX) para ser testável em node — partilhada pelo cartão de confirmação (Tela 9).
 */
export function efeitoVerbo(efeito: string): string {
  if (efeito === "enviar_fora") {
    return "enviar algo para fora (email/agenda/bot na call)";
  }
  if (efeito === "gravar") {
    return "gravar de forma durável (registo/memória)";
  }
  return "executar esta ação";
}
