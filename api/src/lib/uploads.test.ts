// Tests for working out which stored file a photo link points to. Run with: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
const { cloudinaryPublicId } = await import("./uploads.js");

describe("cloudinaryPublicId", () => {
  it("reads the id from a normal upload link", () => {
    assert.equal(
      cloudinaryPublicId("https://res.cloudinary.com/demo-cloud/image/upload/v1732540000/epikaizo/abc123.jpg"),
      "epikaizo/abc123",
    );
  });

  it("works without a version number and with a transformation in the link", () => {
    assert.equal(cloudinaryPublicId("https://res.cloudinary.com/demo-cloud/image/upload/epikaizo/x9.webp"), "epikaizo/x9");
    assert.equal(
      cloudinaryPublicId("https://res.cloudinary.com/demo-cloud/image/upload/c_limit,w_1600/v17/epikaizo/room-1.png"),
      "epikaizo/room-1",
    );
  });

  it("ignores links that are not our Cloudinary photos", () => {
    assert.equal(cloudinaryPublicId("https://placehold.co/1600x1067?text=Room"), null);
    assert.equal(cloudinaryPublicId("https://epikaizo-api.onrender.com/uploads/1732-abc.jpg"), null);
    assert.equal(cloudinaryPublicId("https://res.cloudinary.com/demo-cloud/image/upload/v1/other-site/a.jpg"), null);
  });
});
