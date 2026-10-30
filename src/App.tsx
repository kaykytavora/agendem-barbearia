import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./providers/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { Loader2 } from "lucide-react";

// Componente de carregamento para o Suspense
const PageLoader = () => (
	<div className="flex h-screen w-full items-center justify-center bg-background">
		<Loader2 className="h-8 w-8 animate-spin text-primary" />
	</div>
);

// Carregamento dinâmico (lazy loading) dos componentes de página
const Index = lazy(() => import("./pages/Index"));
const UserTypeSelection = lazy(() => import("./pages/UserTypeSelection"));
const BarberShops = lazy(() => import("./pages/BarberShops"));
const BarberShopDetails = lazy(() => import("./pages/BarberShopDetails"));
const Booking = lazy(() => import("./pages/Booking"));
const BookingConfirmation = lazy(() => import("./pages/BookingConfirmation"));
const ClientPanel = lazy(() => import("./pages/ClientPanel"));
const Login = lazy(() => import("./pages/Login"));
const ClientLogin = lazy(() => import("./pages/ClientLogin"));
const Register = lazy(() => import("./pages/Register"));
const RegisterBarbershop = lazy(() => import("./pages/RegisterBarbershop"));
const Inicio = lazy(() => import("./pages/Inicio"));
const Services = lazy(() => import("./pages/Services"));
const Team = lazy(() => import("./pages/Team"));
const Appointments = lazy(() => import("./pages/Appointments"));
const NewAppointment = lazy(() => import("./pages/NewAppointment"));
const Settings = lazy(() => import("./pages/Settings"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Feedbacks = lazy(() => import("./pages/Feedbacks"));
const ShareProfile = lazy(() => import("./pages/ShareProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const ClientSettings = lazy(() => import("./pages/ClientSettings"));
const Subscription = lazy(() => import("./pages/Subscription"));
const PersonalSettings = lazy(() => import("./pages/PersonalSettings"));
const MyAppointments = lazy(() => import("./pages/MyAppointments"));
const Ferias = lazy(() => import("./pages/Ferias"));
const Agenda = lazy(() => import("./pages/Agenda"));


const queryClient = new QueryClient();

const App = () => (
	<ErrorBoundary>
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<AuthProvider>
					<TooltipProvider>
						<BrowserRouter>
							<Toaster />
							<Sonner />
							<PWAInstallPrompt />
						<Suspense fallback={<PageLoader />}>
							<Routes>
								<Route path="/" element={<UserTypeSelection />} />
								<Route path="/sobre" element={<Index />} />
								<Route path="/barbearias" element={<BarberShops />} />
								<Route path="/barbearia/:slug" element={<BarberShopDetails />} />
								<Route path="/agendamento" element={<Booking />} />
								<Route
									path="/agendamento-confirmado"
									element={<BookingConfirmation />}
								/>
								<Route path="/login" element={<Login />} />
								<Route path="/client-login" element={<ClientLogin />} />
								<Route path="/register" element={<Register />} />
								<Route
									path="/register-barbershop"
									element={<RegisterBarbershop />}
								/>
								<Route path="/forgot-password" element={<ForgotPassword />} />
								<Route path="/reset-password" element={<ResetPassword />} />

								{/* Protected Routes */}
								<Route
									path="/client-panel"
									element={
										<ProtectedRoute requiredRole="cliente">
											<ClientPanel />
										</ProtectedRoute>
									}
								/>
								<Route
								path="/client-settings"
								element={
									<ProtectedRoute requiredRole="cliente">
										<ClientSettings />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/meus-agendamentos"
								element={
									<ProtectedRoute requiredRole="cliente">
										<MyAppointments />
									</ProtectedRoute>
								}
							/>
								<Route
									path="/dashboard"
									element={
										<ProtectedRoute requiredRole="funcionario">
											<Inicio />
										</ProtectedRoute>
									}
								/>
								{/* A tela "Hoje" virou o Início; o endereço antigo continua funcionando */}
								<Route path="/dashboard/hoje" element={<Navigate to="/dashboard" replace />} />
								<Route
									path="/dashboard/agenda"
									element={
										<ProtectedRoute requiredRole="funcionario">
											<Agenda />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/services"
									element={
										<ProtectedRoute requiredRole="admin">
											<Services />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/servicos"
									element={
										<ProtectedRoute requiredRole="admin">
											<Services />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/team"
									element={
										<ProtectedRoute requiredRole="admin">
											<Team />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/funcionarios"
									element={
										<ProtectedRoute requiredRole="admin">
											<Team />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/appointments"
									element={
										<ProtectedRoute requiredRole="funcionario">
											<Appointments />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/agendamentos"
									element={
										<ProtectedRoute requiredRole="funcionario">
											<Appointments />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/new-appointment"
									element={
										<ProtectedRoute requiredRole="funcionario">
											<NewAppointment />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/settings"
									element={
										<ProtectedRoute requiredRole="admin">
											<Settings />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/feedbacks"
									element={
										<ProtectedRoute requiredRole="funcionario">
											<Feedbacks />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/share-profile"
									element={
										<ProtectedRoute requiredRole="admin">
											<ShareProfile />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/subscription"
									element={
										<ProtectedRoute requiredRole="admin">
											<Subscription />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/personal-settings"
									element={
										<ProtectedRoute requiredRole="funcionario">
											<PersonalSettings />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/dashboard/ferias"
									element={
										<ProtectedRoute requiredRole="admin">
											<Ferias />
										</ProtectedRoute>
									}
								/>
								<Route path="/unauthorized" element={<Unauthorized />} />
								{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
								<Route path="*" element={<NotFound />} />
							</Routes>
						</Suspense>
						</BrowserRouter>
					</TooltipProvider>
				</AuthProvider>
			</ThemeProvider>
		</QueryClientProvider>
	</ErrorBoundary>
);

export default App;
