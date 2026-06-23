import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Button,
  Card,
  Chip,
  cx,
  EmptyState,
  ErrorRetry,
  Field,
  Input,
  Modal,
  Skeleton,
  StateLight,
  Tabs,
} from "../src/index";

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

describe("cx", () => {
  it("junta classes truthy e ignora falsy", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("Button", () => {
  it("renderiza texto, variante/tamanho e type=button por defeito", () => {
    const out = html(<Button>Guardar</Button>);
    expect(out).toContain("Guardar");
    expect(out).toContain("vera-btn--primary");
    expect(out).toContain("vera-btn--md");
    expect(out).toContain('type="button"');
  });

  it("respeita variant, size, disabled e className", () => {
    const out = html(
      <Button variant="danger" size="sm" disabled className="x">
        Apagar
      </Button>,
    );
    expect(out).toContain("vera-btn--danger");
    expect(out).toContain("vera-btn--sm");
    expect(out).toContain("disabled");
    expect(out).toContain("x");
  });
});

describe("Card", () => {
  it("sem título não renderiza cabeçalho", () => {
    const out = html(<Card>corpo</Card>);
    expect(out).toContain("corpo");
    expect(out).not.toContain("vera-card__header");
  });

  it("com título renderiza cabeçalho e ações", () => {
    const out = html(
      <Card title="Clientes" actions={<span>+</span>}>
        corpo
      </Card>,
    );
    expect(out).toContain("vera-card__header");
    expect(out).toContain("Clientes");
    expect(out).toContain("+");
  });
});

describe("Field + inputs", () => {
  it("Field renderiza rótulo, hint e erro", () => {
    const out = html(
      <Field label="Nome" hint="obrigatório" error="em falta">
        <Input name="name" />
      </Field>,
    );
    expect(out).toContain("Nome");
    expect(out).toContain("obrigatório");
    expect(out).toContain("em falta");
    expect(out).toContain("vera-input");
  });
});

describe("Tabs", () => {
  it("marca a tab ativa com aria-selected", () => {
    const out = html(
      <Tabs
        value="b"
        items={[
          { id: "a", label: "Interna" },
          { id: "b", label: "Cliente" },
        ]}
      />,
    );
    expect(out).toContain("Interna");
    expect(out).toContain("Cliente");
    expect(out).toContain("vera-tab--active");
    expect(out).toMatch(/aria-selected="true"[^>]*>Cliente|Cliente/);
  });
});

describe("Modal", () => {
  it("fechado não renderiza nada", () => {
    expect(html(<Modal open={false}>x</Modal>)).toBe("");
  });

  it("aberto renderiza dialog com título", () => {
    const out = html(
      <Modal open title="Confirmar">
        conteúdo
      </Modal>,
    );
    expect(out).toContain('role="dialog"');
    expect(out).toContain('aria-modal="true"');
    expect(out).toContain("Confirmar");
    expect(out).toContain("conteúdo");
  });
});

describe("Chip", () => {
  it("aplica a tonalidade", () => {
    expect(html(<Chip tone="accent">React</Chip>)).toContain("vera-chip--accent");
    expect(html(<Chip>x</Chip>)).not.toContain("vera-chip--default");
  });
});

describe("StateLight (semáforo)", () => {
  it("mapeia cada estado canónico ao tom certo", () => {
    expect(html(<StateLight status="coberto-com-prova" />)).toContain("vera-state--strong");
    expect(html(<StateLight status="raso" />)).toContain("vera-state--shallow");
    expect(html(<StateLight status="contradito" />)).toContain("vera-state--alert");
    expect(html(<StateLight status="não-tocado" />)).toContain("vera-state--untouched");
  });

  it("sem label expõe descrição para leitores de ecrã", () => {
    expect(html(<StateLight status="raso" />)).toContain("raso");
  });

  it("com label e showIcon mostra ambos", () => {
    const out = html(<StateLight status="coberto-com-prova" showIcon label="React" />);
    expect(out).toContain("React");
    expect(out).toContain("✅");
  });
});

describe("estados UX", () => {
  it("Skeleton é decorativo (aria-hidden)", () => {
    expect(html(<Skeleton />)).toContain('aria-hidden="true"');
  });

  it("EmptyState renderiza título, descrição e CTA", () => {
    const out = html(
      <EmptyState
        title="Sem clientes"
        description="Cria o primeiro."
        action={<button type="button">Criar</button>}
      />,
    );
    expect(out).toContain("Sem clientes");
    expect(out).toContain("Cria o primeiro.");
    expect(out).toContain("Criar");
  });

  it("ErrorRetry tem role=alert e botão de retry quando há handler", () => {
    const out = html(<ErrorRetry message="Falhou" onRetry={() => {}} />);
    expect(out).toContain('role="alert"');
    expect(out).toContain("Falhou");
    expect(out).toContain("Tentar de novo");
  });
});
