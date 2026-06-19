import { Button, Card } from "@rh/ui";
import { efeitoVerbo } from "./efeito-label";

export interface ConfirmationCardProps {
  tool: string;
  efeito: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Cartão da PORTA DE CONFIRMAÇÃO (Tela 9). Componente puro: a Filipa aprova ANTES de a Vera
 * gravar/enviar. Sem `onConfirm` nada acontece — espelha o gate do backend.
 */
export function ConfirmationCard({
  tool,
  efeito,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmationCardProps) {
  return (
    <Card title="⚠ Confirmação necessária" className="vera-confirm">
      <p className="text-sm text-strong">
        A Vera quer <strong>{efeitoVerbo(efeito)}</strong> com a ferramenta <code>{tool}</code>.
      </p>
      <div className="mt-3 flex gap-2">
        <Button onClick={onConfirm} disabled={busy} size="sm">
          {busy ? "A executar…" : "Confirmar"}
        </Button>
        <Button onClick={onCancel} disabled={busy} variant="ghost" size="sm">
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
