import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// Mock tanstack router navigation, state, and links
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/student" }),
  useRouterState: ({ select }: any) =>
    select ? select({ location: { pathname: "/student" } }) : { location: { pathname: "/student" } },
  Link: ({ children, to, ...props }: any) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="portal-outlet-content">Protected Outlet Content</div>,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import * as supabaseAuth from "@/lib/supabase-auth";
import { DemoStoreProvider } from "@/lib/demo-store";
import { StudentLayout } from "@/routes/student";
import { AdminLayout } from "@/routes/admin";
import { Login } from "@/routes/login";
import { AdminLogin } from "@/routes/admin-login";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <DemoStoreProvider>{children}</DemoStoreProvider>;
}

describe("FixLens AI — Portal Route Guards & Login Separation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
  });

  describe("Student Portal Route Guard (StudentLayout)", () => {
    it("Strictly denies access to Administrator accounts and redirects to /login", async () => {
      // Mock that the current session belongs to an Administrator
      vi.spyOn(supabaseAuth, "getAdminAuthState").mockResolvedValue({
        isAuthenticated: true,
        email: "adminfix@gmail.com",
        role: "Campus Maintenance Administrator",
      });
      vi.spyOn(supabaseAuth, "getStudentAuthState").mockResolvedValue({
        isAuthenticated: false,
      });

      render(
        <Wrapper>
          <StudentLayout />
        </Wrapper>,
      );

      // Verify Access Restricted message is displayed
      await waitFor(() => {
        expect(screen.getByText("Access Restricted")).toBeDefined();
        expect(
          screen.getByText(/The Student Portal is restricted to verified student accounts/i),
        ).toBeDefined();
      });

      // Verify protected outlet content is NOT rendered
      expect(screen.queryByTestId("portal-outlet-content")).toBeNull();

      // Verify navigation was triggered to /login
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
    });

    it("Grants access to verified Student accounts and renders portal outlet", async () => {
      vi.spyOn(supabaseAuth, "getAdminAuthState").mockResolvedValue({
        isAuthenticated: false,
      });
      vi.spyOn(supabaseAuth, "getStudentAuthState").mockResolvedValue({
        isAuthenticated: true,
        user: {
          id: "student-uuid-1",
          email: "student@campus.edu",
          name: "Zainab Ali",
          department: "Computer Science",
          role: "student",
        },
      });

      render(
        <Wrapper>
          <StudentLayout />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("portal-outlet-content")).toBeDefined();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("Administrator Portal Route Guard (AdminLayout)", () => {
    it("Strictly denies access to Student accounts and redirects to /admin-login", async () => {
      vi.spyOn(supabaseAuth, "getAdminAuthState").mockResolvedValue({
        isAuthenticated: false,
      });

      render(
        <Wrapper>
          <AdminLayout />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Access Restricted")).toBeDefined();
        expect(
          screen.getByText(/The administrator portal requires verified authentication/i),
        ).toBeDefined();
      });

      expect(screen.queryByTestId("portal-outlet-content")).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin-login" });
    });

    it("Grants access to designated Administrator and renders portal outlet", async () => {
      vi.spyOn(supabaseAuth, "getAdminAuthState").mockResolvedValue({
        isAuthenticated: true,
        email: "adminfix@gmail.com",
        role: "Campus Maintenance Administrator",
      });

      render(
        <Wrapper>
          <AdminLayout />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("portal-outlet-content")).toBeDefined();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("Login Pages Independence & Clean Presentation", () => {
    it("Opening Student Login while an Admin session exists shows clean login form and does NOT auto-redirect to student portal", async () => {
      vi.spyOn(supabaseAuth, "getAdminAuthState").mockResolvedValue({
        isAuthenticated: true,
        email: "adminfix@gmail.com",
        role: "Campus Maintenance Administrator",
      });
      vi.spyOn(supabaseAuth, "getStudentAuthState").mockResolvedValue({
        isAuthenticated: false,
      });

      const { container } = render(
        <Wrapper>
          <Login />
        </Wrapper>,
      );

      // Verify Student Login form is displayed cleanly
      expect(container.querySelector("input#email")).toBeDefined();
      expect(container.querySelector("input#password")).toBeDefined();

      // Verify no intrusive session banners are rendered
      expect(screen.queryByTestId("admin-session-active-banner")).toBeNull();
      expect(screen.queryByTestId("student-session-active-banner")).toBeNull();

      // Crucial: Must NOT automatically navigate to /student
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/student" });
    });

    it("Opening Admin Login while a Student session exists shows clean login form and does NOT grant admin access", async () => {
      vi.spyOn(supabaseAuth, "getStudentAuthState").mockResolvedValue({
        isAuthenticated: true,
        user: {
          id: "student-uuid-9",
          email: "student9@campus.edu",
          name: "Student Nine",
          department: "Mechanical",
          role: "student",
        },
      });
      vi.spyOn(supabaseAuth, "getAdminAuthState").mockResolvedValue({
        isAuthenticated: false,
      });

      const { container } = render(
        <Wrapper>
          <AdminLogin />
        </Wrapper>,
      );

      // Verify Administrator Login form is displayed cleanly
      expect(container.querySelector("input#email")).toBeDefined();

      // Verify no intrusive session banners are rendered
      expect(screen.queryByTestId("admin-session-active-banner")).toBeNull();
      expect(screen.queryByTestId("student-session-active-banner")).toBeNull();

      // Crucial: Must NOT automatically navigate to /admin
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/admin" });
    });
  });
});
