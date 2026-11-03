import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BuildingCombobox } from "@/components/fixlens/BuildingCombobox";
import { BUILDINGS } from "@/lib/demo-data";

describe("BuildingCombobox & Campus Building List Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("BUILDINGS Constants Verification", () => {
    it("contains all 12 newly added campus locations", () => {
      const requiredNewLocations = [
        "SM Block",
        "Mechanical Science (MS) Block",
        "Electrical Science (ES) Block",
        "Structural Engineering (SE) Block",
        "Life Science (LS) Block",
        "Pharmacy Block",
        "Architecture Block",
        "Basic Science Block",
        "Annexure Block",
        "Main Auditorium",
        "Main Canteen",
        "Convention Centre Block",
      ];

      for (const loc of requiredNewLocations) {
        expect(BUILDINGS).toContain(loc);
      }
    });

    it("retains all 4 required existing locations", () => {
      const retainedLocations = [
        "CS Block",
        "Main Library",
        "Admin Block",
        "Sports Complex",
      ];

      for (const loc of retainedLocations) {
        expect(BUILDINGS).toContain(loc);
      }
    });

    it("has removed the 4 decommissioned locations from the selectable list", () => {
      const removedLocations = [
        "MCA Block",
        "Cafeteria",
        "Boys Hostel",
        "Girls Hostel",
      ];

      for (const loc of removedLocations) {
        expect(BUILDINGS).not.toContain(loc);
      }
    });

    it("has exactly 16 selectable campus buildings in total", () => {
      expect(BUILDINGS.length).toBe(16);
    });
  });

  describe("BuildingCombobox Component UI Interactions", () => {
    it("renders closed with placeholder text", () => {
      render(<BuildingCombobox value="" onChange={vi.fn()} />);

      const trigger = screen.getByRole("combobox");
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent("Select campus block or building...");
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("opens dropdown and displays all buildings when clicked", () => {
      render(<BuildingCombobox value="" onChange={vi.fn()} />);

      const trigger = screen.getByRole("combobox");
      fireEvent.click(trigger);

      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Search campus block or building...")).toBeInTheDocument();

      // Check a few buildings are rendered
      expect(screen.getByText("Mechanical Science (MS) Block")).toBeInTheDocument();
      expect(screen.getByText("CS Block")).toBeInTheDocument();
      expect(screen.getByText("Main Canteen")).toBeInTheDocument();
    });

    it("filters case-insensitively with partial matching for 'mechanical'", () => {
      render(<BuildingCombobox value="" onChange={vi.fn()} />);

      fireEvent.click(screen.getByRole("combobox"));
      const searchInput = screen.getByPlaceholderText("Search campus block or building...");

      fireEvent.change(searchInput, { target: { value: "mechanical" } });

      expect(screen.getByText("Mechanical Science (MS) Block")).toBeInTheDocument();
      expect(screen.queryByText("CS Block")).toBeNull();
      expect(screen.queryByText("Main Library")).toBeNull();
    });

    it("filters using block abbreviations like 'MS'", () => {
      render(<BuildingCombobox value="" onChange={vi.fn()} />);

      fireEvent.click(screen.getByRole("combobox"));
      const searchInput = screen.getByPlaceholderText("Search campus block or building...");

      fireEvent.change(searchInput, { target: { value: "MS" } });

      expect(screen.getByText("Mechanical Science (MS) Block")).toBeInTheDocument();
      expect(screen.queryByText("Admin Block")).toBeNull();
    });

    it("filters for 'canteen' and finds Main Canteen", () => {
      render(<BuildingCombobox value="" onChange={vi.fn()} />);

      fireEvent.click(screen.getByRole("combobox"));
      const searchInput = screen.getByPlaceholderText("Search campus block or building...");

      fireEvent.change(searchInput, { target: { value: "canteen" } });

      expect(screen.getByText("Main Canteen")).toBeInTheDocument();
      expect(screen.queryByText("CS Block")).toBeNull();
    });

    it("filters for 'auditorium' and finds Main Auditorium and Convention Centre Block", () => {
      render(<BuildingCombobox value="" onChange={vi.fn()} />);

      fireEvent.click(screen.getByRole("combobox"));
      const searchInput = screen.getByPlaceholderText("Search campus block or building...");

      fireEvent.change(searchInput, { target: { value: "auditorium" } });

      expect(screen.getByText("Main Auditorium")).toBeInTheDocument();
      expect(screen.getByText("Convention Centre Block")).toBeInTheDocument();
      expect(screen.queryByText("Pharmacy Block")).toBeNull();
    });

    it("displays 'No buildings found' when no search matches", () => {
      render(<BuildingCombobox value="" onChange={vi.fn()} />);

      fireEvent.click(screen.getByRole("combobox"));
      const searchInput = screen.getByPlaceholderText("Search campus block or building...");

      fireEvent.change(searchInput, { target: { value: "nonexistent block xyz" } });

      expect(screen.getByText("No buildings found")).toBeInTheDocument();
      expect(screen.getByText(/Try searching by block name or abbreviation/i)).toBeInTheDocument();
    });

    it("selects an option via mouse click and calls onChange", () => {
      const handleChange = vi.fn();
      render(<BuildingCombobox value="" onChange={handleChange} />);

      fireEvent.click(screen.getByRole("combobox"));
      const option = screen.getByText("Pharmacy Block");
      fireEvent.click(option);

      expect(handleChange).toHaveBeenCalledWith("Pharmacy Block");
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("supports keyboard navigation: ArrowDown and Enter to select", () => {
      const handleChange = vi.fn();
      render(<BuildingCombobox value="" onChange={handleChange} />);

      // Open with ArrowDown
      const trigger = screen.getByRole("combobox");
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText("Search campus block or building...");
      // Filter for architecture
      fireEvent.change(searchInput, { target: { value: "architecture" } });

      // Press Enter to select
      fireEvent.keyDown(searchInput, { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("Architecture Block");
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("closes dropdown on Escape key", () => {
      render(<BuildingCombobox value="" onChange={vi.fn()} />);

      fireEvent.click(screen.getByRole("combobox"));
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText("Search campus block or building...");
      fireEvent.keyDown(searchInput, { key: "Escape" });

      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("displays the selected building name on trigger and allows clearing", () => {
      const handleChange = vi.fn();
      render(<BuildingCombobox value="Structural Engineering (SE) Block" onChange={handleChange} />);

      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveTextContent("Structural Engineering (SE) Block");

      // Click clear button
      const clearBtn = screen.getByRole("button", { name: "Clear selected building" });
      fireEvent.click(clearBtn);

      expect(handleChange).toHaveBeenCalledWith("");
    });
  });
});
