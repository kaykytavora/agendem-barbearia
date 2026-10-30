import { fireEvent, render, screen } from "@testing-library/react";
import { DayPicker } from "@/components/booking/DayPicker";

// Qui 15/10/2026 até Ter 27/10/2026, sem domingos (como uma barbearia fechada no domingo)
const dias = Array.from({ length: 13 }, (_, i) => new Date(2026, 9, 15 + i)).filter((d) => d.getDay() !== 0);

describe("DayPicker", () => {
  it("mostra uma semana por vez, sem rolagem, e troca de semana pelas setas", () => {
    render(<DayPicker dates={dias} selected={null} onSelect={() => {}} />);

    const grupo = screen.getByRole("group", { name: "Dias disponíveis" });
    expect(grupo.querySelectorAll("button")).toHaveLength(7);
    expect(grupo.className).not.toContain("overflow-x-auto");
    expect(screen.getByRole("button", { name: "Semana anterior" })).toBeDisabled();

    // Semana de 11 a 17/10: só qui, sex e sáb estão disponíveis
    expect(screen.getByRole("button", { name: /segunda-feira, 12 de outubro, indisponível/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /quinta-feira, 15 de outubro$/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima semana" }));
    expect(screen.getByRole("button", { name: /domingo, 18 de outubro, indisponível/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /segunda-feira, 19 de outubro$/ })).toBeEnabled();
  });

  it("abre na semana do dia já escolhido e avisa a escolha", () => {
    const onSelect = vi.fn();
    render(<DayPicker dates={dias} selected={dias[dias.length - 1]} onSelect={onSelect} />);

    const escolhido = screen.getByRole("button", { name: /terça-feira, 27 de outubro$/ });
    expect(escolhido).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Próxima semana" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /segunda-feira, 26 de outubro$/ }));
    expect(onSelect).toHaveBeenCalledWith(new Date(2026, 9, 26));
  });
});
