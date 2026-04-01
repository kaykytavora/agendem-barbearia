import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { describe, it, expect } from "vitest";

// Agrupa os testes para o componente ThemeToggle
describe("ThemeToggle", () => {
	// Teste específico: verifica se o botão é renderizado
	it("should render the toggle button", () => {
		// Renderiza o componente dentro dos Providers necessários
		render(
			<BrowserRouter>
				<AuthProvider>
					<ThemeProvider>
						<ThemeToggle />
					</ThemeProvider>
				</AuthProvider>
			</BrowserRouter>
		);

		// Procura por um elemento que tenha o "role" de "button"
		const button = screen.getByRole("button");

		// A asserção: esperamos que o botão esteja no documento (na tela)
		expect(button).toBeInTheDocument();
	});
}); 