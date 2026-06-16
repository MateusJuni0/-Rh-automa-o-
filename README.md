# RH Automação — Copiloto de IA para Recrutamento

Copiloto de IA que apoia o recrutador **antes e durante** a entrevista técnica — sem substituir o humano, só tirando o peso de preparação e avaliação de cima dele.

## Documentos de planeamento

| Documento | O que é |
|-----------|---------|
| [`PLANO.md`](./PLANO.md) | Problema, ideia, fases, stack e decisões técnicas |
| [`DIA-A-DIA-RECRUTADOR.md`](./DIA-A-DIA-RECRUTADOR.md) | Dores reais do recrutador → features por ordem de prioridade |
| [`UI-DESIGN.md`](./UI-DESIGN.md) | Princípios de UI do copiloto ao vivo + esboços de ecrãs |
| [`DECISOES-E-MVP.md`](./DECISOES-E-MVP.md) | Continuação do raciocínio: escopo do MVP, stack, modelos Claude, modelo de dados e log de decisões |
| [`ARQUITETURA-TEMPO-REAL.md`](./ARQUITETURA-TEMPO-REAL.md) | **Como funciona o copiloto ao vivo** — captura, transcrição+diarização, análise em tempo real, sessões de 2h |

## Estado actual

Fase 0 — Pensar antes de codar. Os docs acima definem o problema e o design antes de qualquer linha de código.

**Decidido:** MVP = jornada completa com **copiloto ao vivo** (tempo real, transcrição com diarização, análise durante a entrevista). Detalhes em [`ARQUITETURA-TEMPO-REAL.md`](./ARQUITETURA-TEMPO-REAL.md).

**Próxima decisão:** como o bot capta o áudio da reunião ([`ARQUITETURA-TEMPO-REAL.md §5`](./ARQUITETURA-TEMPO-REAL.md)).
