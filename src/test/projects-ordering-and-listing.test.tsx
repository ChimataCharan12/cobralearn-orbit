import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ProjectTable } from "@/components/projects/ProjectTable";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import type { ProjectItem } from "@/lib/projects-data";

// Mock @tanstack/react-router
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to, onClick, ...props }: any) => (
    <a href={to} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const mockProjects: ProjectItem[] = [
  {
    id: "proj-1",
    name: "Alpha Platform",
    category: "Full Stack",
    description: "First project in the list",
    technologies: ["React", "Node"],
    status: "Published",
    featured: true,
    image: "/images/alpha.jpg",
    order: 1,
    teamSize: "3",
    projectDuration: "3 Months",
    liveUrl: "https://alpha.example.com",
    githubUrl: "https://github.com/example/alpha",
  },
  {
    id: "proj-2",
    name: "Beta System",
    category: "AI",
    description: "Second project in the list",
    technologies: ["Python", "PyTorch"],
    status: "Draft",
    featured: false,
    image: "/images/beta.jpg",
    order: 2,
    teamSize: "2",
    projectDuration: "2 Months",
  },
  {
    id: "proj-3",
    name: "Gamma Engine",
    category: "Cloud",
    description: "Third project in the list",
    technologies: ["Go", "Kubernetes"],
    status: "Archived",
    featured: false,
    image: "/images/gamma.jpg",
    order: 3,
    teamSize: "4",
    projectDuration: "6 Months",
  },
];

describe("Projects Phase 3: Ordering & Listing Tests", () => {
  describe("1. Sorting Comparator Invariants", () => {
    it("sorts by Display Order (order) correctly as default", () => {
      const items = [...mockProjects].reverse();
      items.sort((a, b) => a.order - b.order);
      expect(items.map((i) => i.id)).toEqual(["proj-1", "proj-2", "proj-3"]);
    });

    it("sorts by Name A–Z (name_asc) correctly", () => {
      const items: ProjectItem[] = [mockProjects[1]!, mockProjects[0]!, mockProjects[2]!]; // Beta, Alpha, Gamma
      items.sort((a, b) => {
        const nameDiff = a.name.localeCompare(b.name);
        return nameDiff !== 0 ? nameDiff : a.order - b.order;
      });
      expect(items.map((i) => i.name)).toEqual(["Alpha Platform", "Beta System", "Gamma Engine"]);
    });

    it("sorts by Name Z–A (name_desc) correctly", () => {
      const items = [...mockProjects];
      items.sort((a, b) => {
        const nameDiff = b.name.localeCompare(a.name);
        return nameDiff !== 0 ? nameDiff : a.order - b.order;
      });
      expect(items.map((i) => i.name)).toEqual(["Gamma Engine", "Beta System", "Alpha Platform"]);
    });

    it("sorts by Status correctly with Display Order tie-breaking", () => {
      const items = [...mockProjects];
      items.sort((a, b) => {
        const statusDiff = a.status.localeCompare(b.status);
        return statusDiff !== 0 ? statusDiff : a.order - b.order;
      });
      // Archived ("Archived"), Draft ("Draft"), Published ("Published")
      expect(items.map((i) => i.status)).toEqual(["Archived", "Draft", "Published"]);
    });
  });

  describe("2. ProjectTable Move Controls & Disabled States", () => {
    it("disables Move Up for the first item and Move Down for the last item", () => {
      render(
        <ProjectTable
          projects={mockProjects}
          selectedIds={[]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          canMoveUp={(id) => id !== "proj-1"}
          canMoveDown={(id) => id !== "proj-3"}
          getMoveUpTitle={(id) => (id === "proj-1" ? "Already first in display order" : "Move up")}
          getMoveDownTitle={(id) => (id === "proj-3" ? "Already last in display order" : "Move down")}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onBulkAction={vi.fn()}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
          pageSize={10}
          onPageSizeChange={vi.fn()}
          totalCount={3}
        />
      );

      const moveUpButtons = screen.getAllByRole("button", { name: "Move up" });
      const moveDownButtons = screen.getAllByRole("button", { name: "Move down" });

      expect(moveUpButtons).toHaveLength(3);
      expect(moveDownButtons).toHaveLength(3);

      // Row 1: Move Up disabled, Move Down enabled
      expect(moveUpButtons[0]).toBeDisabled();
      expect(moveUpButtons[0]?.getAttribute("title")).toBe("Already first in display order");
      expect(moveDownButtons[0]).toBeEnabled();

      // Row 2: Both enabled
      expect(moveUpButtons[1]).toBeEnabled();
      expect(moveDownButtons[1]).toBeEnabled();

      // Row 3: Move Up enabled, Move Down disabled
      expect(moveUpButtons[2]).toBeEnabled();
      expect(moveDownButtons[2]).toBeDisabled();
      expect(moveDownButtons[2]?.getAttribute("title")).toBe("Already last in display order");
    });

    it("disables all Move controls and displays explanation when reordering is disabled (search/filter/sort active)", () => {
      const explanation =
        "Reordering is disabled while search, filters, or alternative sorting are active. Clear filters and sort by Display Order to reorder.";

      render(
        <ProjectTable
          projects={mockProjects}
          selectedIds={[]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          canMoveUp={() => false}
          canMoveDown={() => false}
          getMoveUpTitle={() => explanation}
          getMoveDownTitle={() => explanation}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onBulkAction={vi.fn()}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
          pageSize={10}
          onPageSizeChange={vi.fn()}
          totalCount={3}
        />
      );

      const moveUpButtons = screen.getAllByRole("button", { name: "Move up" });
      const moveDownButtons = screen.getAllByRole("button", { name: "Move down" });

      moveUpButtons.forEach((btn) => {
        expect(btn).toBeDisabled();
        expect(btn.getAttribute("title")).toBe(explanation);
      });

      moveDownButtons.forEach((btn) => {
        expect(btn).toBeDisabled();
        expect(btn.getAttribute("title")).toBe(explanation);
      });
    });

    it("disables all Move controls while a reorder request is in flight", () => {
      render(
        <ProjectTable
          projects={mockProjects}
          selectedIds={[]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          canMoveUp={() => false}
          canMoveDown={() => false}
          getMoveUpTitle={() => "Updating project order..."}
          getMoveDownTitle={() => "Updating project order..."}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onBulkAction={vi.fn()}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
          pageSize={10}
          onPageSizeChange={vi.fn()}
          totalCount={3}
        />
      );

      const moveUpButtons = screen.getAllByRole("button", { name: "Move up" });
      moveUpButtons.forEach((btn) => {
        expect(btn).toBeDisabled();
        expect(btn.getAttribute("title")).toBe("Updating project order...");
      });
    });
  });

  describe("3. ProjectGrid Move Controls & Disabled States", () => {
    it("disables Move Up for first card and Move Down for last card", () => {
      render(
        <ProjectGrid
          projects={mockProjects}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          canMoveUp={(id) => id !== "proj-1"}
          canMoveDown={(id) => id !== "proj-3"}
          getMoveUpTitle={(id) => (id === "proj-1" ? "Already first in display order" : "Move up")}
          getMoveDownTitle={(id) => (id === "proj-3" ? "Already last in display order" : "Move down")}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const moveUpButtons = screen.getAllByRole("button", { name: "Move up" });
      const moveDownButtons = screen.getAllByRole("button", { name: "Move down" });

      expect(moveUpButtons[0]).toBeDisabled();
      expect(moveDownButtons[0]).toBeEnabled();

      expect(moveUpButtons[1]).toBeEnabled();
      expect(moveDownButtons[1]).toBeEnabled();

      expect(moveUpButtons[2]).toBeEnabled();
      expect(moveDownButtons[2]).toBeDisabled();
    });

    it("disables all Move controls on Grid when reordering is disabled", () => {
      render(
        <ProjectGrid
          projects={mockProjects}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          canMoveUp={() => false}
          canMoveDown={() => false}
          getMoveUpTitle={() => "Reordering disabled"}
          getMoveDownTitle={() => "Reordering disabled"}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const moveUpButtons = screen.getAllByRole("button", { name: "Move up" });
      const moveDownButtons = screen.getAllByRole("button", { name: "Move down" });

      moveUpButtons.forEach((btn) => expect(btn).toBeDisabled());
      moveDownButtons.forEach((btn) => expect(btn).toBeDisabled());
    });
  });

  describe("4. Visible-Page Tri-State Selection Checkbox", () => {
    it("reflects checked state in both header and footer when all page items are selected", () => {
      render(
        <ProjectTable
          projects={mockProjects}
          selectedIds={["proj-1", "proj-2", "proj-3", "other-page-proj-4"]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onBulkAction={vi.fn()}
          currentPage={1}
          totalPages={2}
          onPageChange={vi.fn()}
          pageSize={3}
          onPageSizeChange={vi.fn()}
          totalCount={6}
        />
      );

      const headerCheckbox = screen.getByRole("checkbox", { name: "Select all projects" });
      const footerCheckbox = screen.getByRole("checkbox", { name: "Select all" });

      expect(headerCheckbox.getAttribute("aria-checked")).toBe("true");
      expect(footerCheckbox.getAttribute("aria-checked")).toBe("true");
    });

    it("reflects indeterminate (mixed) state in header and footer when some page items are selected", () => {
      render(
        <ProjectTable
          projects={mockProjects}
          selectedIds={["proj-1", "other-page-proj-4"]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onBulkAction={vi.fn()}
          currentPage={1}
          totalPages={2}
          onPageChange={vi.fn()}
          pageSize={3}
          onPageSizeChange={vi.fn()}
          totalCount={6}
        />
      );

      const headerCheckbox = screen.getByRole("checkbox", { name: "Select all projects" });
      const footerCheckbox = screen.getByRole("checkbox", { name: "Select all" });

      expect(headerCheckbox.getAttribute("aria-checked")).toBe("mixed");
      expect(footerCheckbox.getAttribute("aria-checked")).toBe("mixed");
    });

    it("reflects unchecked (false) state when no visible items on current page are selected", () => {
      render(
        <ProjectTable
          projects={mockProjects}
          selectedIds={["other-page-proj-4", "other-page-proj-5"]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onBulkAction={vi.fn()}
          currentPage={1}
          totalPages={2}
          onPageChange={vi.fn()}
          pageSize={3}
          onPageSizeChange={vi.fn()}
          totalCount={6}
        />
      );

      const headerCheckbox = screen.getByRole("checkbox", { name: "Select all projects" });
      const footerCheckbox = screen.getByRole("checkbox", { name: "Select all" });

      expect(headerCheckbox.getAttribute("aria-checked")).toBe("false");
      expect(footerCheckbox.getAttribute("aria-checked")).toBe("false");
    });
  });

  describe("5. Technologies Column Removed from Admin Table Only", () => {
    it("does not render the Technologies column header or cell tags in ProjectTable", () => {
      render(
        <ProjectTable
          projects={mockProjects}
          selectedIds={[]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onBulkAction={vi.fn()}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
          pageSize={10}
          onPageSizeChange={vi.fn()}
          totalCount={3}
        />
      );

      // Verify header does not exist
      expect(screen.queryByRole("columnheader", { name: /technologies/i })).toBeNull();

      // Verify headers count is 7: Checkbox, #, Project, Description, Status, Order, Actions
      const headers = screen.getAllByRole("columnheader");
      expect(headers).toHaveLength(7);
      expect(headers[1]?.textContent).toBe("#");
      expect(headers[2]?.textContent).toBe("Project");
      expect(headers[3]?.textContent).toBe("Description");
      expect(headers[4]?.textContent).toBe("Status");
      expect(headers[5]?.textContent).toBe("Order");
      expect(headers[6]?.textContent).toBe("Actions");
    });

    it("renders empty state with colSpan of 7 when no projects match", () => {
      render(
        <ProjectTable
          projects={[]}
          selectedIds={[]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onBulkAction={vi.fn()}
          currentPage={1}
          totalPages={1}
          onPageChange={vi.fn()}
          pageSize={10}
          onPageSizeChange={vi.fn()}
          totalCount={0}
        />
      );

      const emptyCell = screen.getByText("No projects match your filter criteria.");
      expect(emptyCell.getAttribute("colspan")).toBe("7");
    });

    it("preserves technologies tags in ProjectGrid while table does not render them", () => {
      render(
        <ProjectGrid
          projects={mockProjects}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      // Technologies tags must still be rendered in grid cards
      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("Node")).toBeInTheDocument();
      expect(screen.getByText("Python")).toBeInTheDocument();
      expect(screen.getByText("PyTorch")).toBeInTheDocument();
      expect(screen.getByText("Go")).toBeInTheDocument();
      expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    });
  });

  describe("6. Scoped ProjectGrid Hover Styling", () => {
    it("applies project-grid-card class and removes excessive hover scaling", () => {
      const { container } = render(
        <ProjectGrid
          projects={mockProjects}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onView={vi.fn()}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const cards = container.querySelectorAll(".project-grid-card");
      expect(cards.length).toBe(3);
      cards.forEach((card) => {
        expect(card.classList.contains("project-grid-card")).toBe(true);
        expect(card.classList.contains("accent-green")).toBe(true);
        // Does not inherit bloated accent-card neon bloom
        expect(card.classList.contains("accent-card")).toBe(false);
        // Does not use excessive scaling
        expect(card.classList.contains("hover:scale-[1.015]")).toBe(false);
      });
    });
  });
});
