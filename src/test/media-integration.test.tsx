import { describe, it, expect, beforeEach } from "vitest";
import { mediaStore } from "@/lib/media-store";

describe("Media Library ↔ Content Module Shared Architecture", () => {
  beforeEach(() => {
    // Reset store to initial empty state
    mediaStore.reset();
  });

  it("starts with an empty media repository (no mock media)", () => {
    expect(mediaStore.getAll()).toEqual([]);
  });

  it("adds newly uploaded files to the central Media Library store", () => {
    const fakeFile = new File(["dummy content"], "project-hero.png", { type: "image/png" });
    const createdAsset = mediaStore.addFromFile(fakeFile, "Projects", {
      name: "Project Hero",
      description: "Hero banner for project",
      tags: ["hero", "project"],
    });

    const allItems = mediaStore.getAll();
    expect(allItems).toHaveLength(1);
    expect(allItems[0]?.id).toBe(createdAsset.id);
    expect(allItems[0]?.name).toBe("Project Hero");
    expect(allItems[0]?.category).toBe("Projects");
    expect(allItems[0]?.type).toBe("Image");
    expect(allItems[0]?.mimeType).toBe("image/png");
    expect(allItems[0]?.tags).toEqual(["hero", "project"]);
  });

  it("allows multiple modules (Websites, Advertisements, Awards) to store media in the single central store", () => {
    const webFile = new File(["web"], "site-preview.webp", { type: "image/webp" });
    const adFile = new File(["ad"], "banner-ad.jpg", { type: "image/jpeg" });
    const awardFile = new File(["cert"], "first-place.png", { type: "image/png" });

    const webAsset = mediaStore.addFromFile(webFile, "Websites");
    const adAsset = mediaStore.addFromFile(adFile, "Advertisements");
    const awardAsset = mediaStore.addFromFile(awardFile, "Awards");

    const allItems = mediaStore.getAll();
    expect(allItems).toHaveLength(3);
    expect(allItems.map((i) => i.id)).toEqual([awardAsset.id, adAsset.id, webAsset.id]);
  });

  it("removing an asset from a content module DOES NOT delete it from the Media Library", () => {
    const file = new File(["img"], "shared-photo.jpg", { type: "image/jpeg" });
    const asset = mediaStore.addFromFile(file, "Projects");

    // Simulating project form state holding this asset url
    let projectGallery = [asset.thumbnail || asset.url || ""];
    expect(projectGallery).toHaveLength(1);

    // User removes photo from Project gallery
    projectGallery = projectGallery.filter((url) => url !== (asset.thumbnail || asset.url));
    expect(projectGallery).toHaveLength(0);

    // Media library STILL holds the asset
    expect(mediaStore.getAll()).toHaveLength(1);
    expect(mediaStore.getAll()[0]?.id).toBe(asset.id);
  });

  it("actual deletion from Media Library removes it from the central store", () => {
    const file1 = new File(["1"], "img1.png", { type: "image/png" });
    const file2 = new File(["2"], "img2.png", { type: "image/png" });
    const a1 = mediaStore.addFromFile(file1, "Projects");
    const a2 = mediaStore.addFromFile(file2, "Websites");

    expect(mediaStore.getAll()).toHaveLength(2);

    mediaStore.remove(a1.id);
    const remaining = mediaStore.getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(a2.id);

    // Bulk deletion
    mediaStore.removeBulk([a2.id]);
    expect(mediaStore.getAll()).toHaveLength(0);
  });
});
