import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

function ensureFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error("ffmpeg is required to build demo GIFs. Install ffmpeg and retry.");
  }
}

export function writeGifFromFrames(frames, outputPath, { width = 960, fps = 8 } = {}) {
  ensureFfmpeg();

  const tempDir = mkdtempSync(join(tmpdir(), "bagdrop-demo-gif-"));
  const concatPath = join(tempDir, "frames.txt");

  try {
    const framePaths = frames.map((frame, index) => {
      const framePath = join(tempDir, `frame-${String(index).padStart(3, "0")}.png`);
      writeFileSync(framePath, frame.png);
      return {
        path: framePath,
        durationSec: frame.durationSec ?? 1.4
      };
    });

    const concatLines = [];
    for (const frame of framePaths) {
      concatLines.push(`file '${frame.path}'`);
      concatLines.push(`duration ${frame.durationSec}`);
    }
    concatLines.push(`file '${framePaths[framePaths.length - 1].path}'`);
    writeFileSync(concatPath, `${concatLines.join("\n")}\n`);

    const palettePath = join(tempDir, "palette.png");
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatPath,
        "-vf",
        `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`,
        palettePath
      ],
      { stdio: "ignore" }
    );

    mkdirSync(dirname(outputPath), { recursive: true });
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatPath,
        "-i",
        palettePath,
        "-lavfi",
        `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer`,
        outputPath
      ],
      { stdio: "ignore" }
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
