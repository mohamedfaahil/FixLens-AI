import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  isDataUrl,
  isBlobUrl,
  formatFileSize,
  dataUrlToFile,
} from "../lib/image-utils";
import { toDisplayableImageUrl, createComplaintInSupabase } from "../lib/supabase-data";
import { ComplaintSummary } from "../components/fixlens/ComplaintDetail";
import { DemoStoreProvider } from "../lib/demo-store";
import { supabase } from "@/integrations/supabase/client";
import type { Complaint } from "../lib/demo-data";

describe("FixLens AI — Photo Upload, Compression & Admin Display", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Image Utilities", () => {
    it("correctly identifies base64 data URLs", () => {
      expect(isDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
      expect(isDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
      expect(isDataUrl("blob:http://localhost:5173/abc-123")).toBe(false);
      expect(isDataUrl("https://example.com/photo.jpg")).toBe(false);
      expect(isDataUrl("")).toBe(false);
      expect(isDataUrl(null)).toBe(false);
    });

    it("correctly identifies browser blob URLs", () => {
      expect(isBlobUrl("blob:http://localhost:5173/abc-123")).toBe(true);
      expect(isBlobUrl("blob:https://campus.fixlens.ai/987")).toBe(true);
      expect(isBlobUrl("data:image/jpeg;base64,abc")).toBe(false);
      expect(isBlobUrl("user-123/photo.jpg")).toBe(false);
      expect(isBlobUrl(undefined)).toBe(false);
    });

    it("formats file sizes cleanly", () => {
      expect(formatFileSize(500)).toBe("500 B");
      expect(formatFileSize(1024 * 115)).toBe("115 KB");
      expect(formatFileSize(1024 * 1024 * 2.4)).toBe("2.4 MB");
    });

    it("converts a data URL back to a File object", () => {
      // 1x1 transparent PNG data URL
      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAAElFTkSuQmCC";
      const file = dataUrlToFile(dataUrl, "test_defect.png");

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe("test_defect.png");
      expect(file.type).toBe("image/png");
      expect(file.size).toBeGreaterThan(0);
    });
  });

  describe("toDisplayableImageUrl", () => {
    it("returns resolved signed URLs when available", () => {
      const signedUrl = "https://snwcmuptrvmpniuevofj.supabase.co/storage/v1/object/sign/complaint-images/user/test.jpg?token=abc";
      expect(toDisplayableImageUrl(signedUrl, "user/test.jpg")).toBe(signedUrl);
    });

    it("returns data URLs directly", () => {
      const dataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      expect(toDisplayableImageUrl(undefined, dataUrl)).toBe(dataUrl);
    });

    it("rejects raw storage paths when signed URL cannot be created to prevent 404 broken images", () => {
      expect(toDisplayableImageUrl(undefined, "user-123/1730000000-chair.jpg")).toBeUndefined();
    });
  });

  describe("createComplaintInSupabase photo fallback handling", () => {
    it("falls back to base64 Data URL and never saves dead blob URLs when storage upload fails", async () => {
      // Storage upload fails (e.g. missing bucket)
      vi.spyOn(supabase.storage, "from").mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "The resource was not found / bucket missing" },
        }),
      } as any);

      let insertedPayload: any = null;
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "complaints") {
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedPayload = payload;
              return Promise.resolve({ error: null });
            }),
          } as any;
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      });

      const fakeDataUrl = "data:image/jpeg;base64,mockJpegDataString==";
      const fakeBlobUrl = "blob:http://localhost:5173/transient-id";

      await createComplaintInSupabase(
        {
          title: "Broken Bench",
          description: "Bench broken in courtyard",
          category: "Furniture",
          building: "CS Block",
          room: "101",
          urgency: "Medium",
          affected: 5,
          priority: "Medium",
          image: fakeDataUrl,
        },
        { id: "student-user-123", name: "Test Student" },
      );

      expect(insertedPayload).not.toBeNull();
      // Should save the resilient Data URL, not null or dead blob
      expect(insertedPayload.image_url).toBe(fakeDataUrl);
      expect(insertedPayload.image_url).not.toBe(fakeBlobUrl);
    });

    it("saves image_url as null when student does not attach any photo", async () => {
      let insertedPayload: any = null;
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "complaints") {
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedPayload = payload;
              return Promise.resolve({ error: null });
            }),
          } as any;
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      });

      await createComplaintInSupabase(
        {
          title: "Flickering Light",
          description: "Tube light flickering in hallway",
          category: "Electrical",
          building: "Admin Block",
          room: "Corridor",
          urgency: "Low",
          affected: 1,
          priority: "Low",
          image: undefined,
        },
        { id: "student-user-123", name: "Test Student" },
        undefined, // No file
      );

      expect(insertedPayload).not.toBeNull();
      expect(insertedPayload.image_url).toBeNull();
    });
  });

  describe("ComplaintDetail View Photo Rendering", () => {
    const mockComplaint: Complaint = {
      id: "FX-17300000000001",
      title: "Broken Lab Stool",
      description: "Lab stool broken leg in Chemistry Lab",
      category: "Furniture",
      building: "Science Block",
      room: "Lab 2",
      urgency: "Medium",
      affected: 2,
      priority: "Medium",
      status: "Submitted",
      date: "2026-11-05",
      reporter: "Mohamed Anwar",
      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAAElFTkSuQmCC",
      timeline: [
        {
          status: "Submitted",
          date: "2026-11-05",
          note: "Complaint submitted.",
          by: "Mohamed Anwar",
        },
      ],
    };

    it("renders the attached photo and provides a full-size zoom option", () => {
      render(
        <DemoStoreProvider>
          <ComplaintSummary c={mockComplaint} />
        </DemoStoreProvider>,
      );

      expect(screen.getByText(/Attached Campus Photo/i)).toBeInTheDocument();
      expect(screen.getByText(/View Full Size/i)).toBeInTheDocument();
      const img = screen.getByAltText("Attached by reporter");
      expect(img).toBeInTheDocument();
    });

    it("gracefully displays fallback message when image load fails instead of broken icon", () => {
      render(
        <DemoStoreProvider>
          <ComplaintSummary c={mockComplaint} />
        </DemoStoreProvider>,
      );

      const img = screen.getByAltText("Attached by reporter");
      fireEvent.error(img);

      expect(screen.getByText(/Attachment Preview Unavailable/i)).toBeInTheDocument();
    });
  });
});
