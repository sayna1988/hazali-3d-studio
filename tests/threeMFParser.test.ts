import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { parse3MF } from "../src/services/ThreeMFParser.ts";

async function create3MF(files: Record<string, string>) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  const bytes = await zip.generateAsync({ type: "uint8array" });
  Object.defineProperties(bytes, {
    name: { value: "test.3mf" },
    size: { value: bytes.byteLength },
  });
  return bytes as unknown as File;
}

test("negeert Bambu default filamentkleur als echte printkleur", async () => {
  const file = await create3MF({
    "Metadata/project_settings.config": JSON.stringify({
      filament_colour: ["#000000"],
      default_filament_colour: ["#018001"],
      filament_type: ["PLA"],
      total_weight: "12.5",
    }),
    "3D/3dmodel.model": "<model unit=\"millimeter\"><resources /></model>",
  });

  const result = await parse3MF(file);

  assert.deepEqual(result.filamentKleuren, ["#000000"]);
  assert.equal(result.filamenten.length, 1);
  assert.equal(result.filamenten[0].kleur, "#000000");
  assert.equal(result.kleurBron, "3mf-metadata");
});

test("filtert ongebruikte filament-slots uit MakerWorld metadata", async () => {
  const file = await create3MF({
    "Metadata/project_settings.config": JSON.stringify({
      filament_colour: ["#018001", "#000000"],
      filament_type: ["PLA", "PLA"],
      total_weight: "12.5",
    }),
    "Metadata/model_settings.config": `
      <config>
        <object id="1">
          <metadata key="extruder" value="2" />
        </object>
      </config>
    `,
    "3D/3dmodel.model": "<model unit=\"millimeter\"><resources /></model>",
  });

  const result = await parse3MF(file);

  assert.deepEqual(result.filamentKleuren, ["#000000"]);
  assert.equal(result.filamenten.length, 1);
  assert.equal(result.filamenten[0].kleur, "#000000");
});

test("importeert geen donkergroen uit alleen default filamentmetadata", async () => {
  const file = await create3MF({
    "Metadata/project_settings.config": JSON.stringify({
      default_filament_colour: ["#018001"],
      filament_type: ["PLA"],
    }),
    "3D/3dmodel.model": "<model unit=\"millimeter\"><resources /></model>",
  });

  const result = await parse3MF(file);

  assert.deepEqual(result.filamentKleuren, []);
  assert.equal(result.filamenten.length, 0);
  assert.equal(result.kleurBron, "geen");
});
