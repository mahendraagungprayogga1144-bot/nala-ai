import { readFileSync } from "fs";
import { join } from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

type BrandFontBytes = { serif: Uint8Array; sans: Uint8Array; sansBold: Uint8Array };

let cachedBytes: BrandFontBytes | null | undefined;

function fontPath(file: string) {
  return join(process.cwd(), "lib/henima-sales/fonts", file);
}

export function brandFontBytes(): BrandFontBytes | null {
  if (cachedBytes !== undefined) return cachedBytes;
  try {
    cachedBytes = {
      serif: new Uint8Array(readFileSync(fontPath("PlayfairDisplay-Bold.ttf"))),
      sans: new Uint8Array(readFileSync(fontPath("SourceSans3-Regular.ttf"))),
      sansBold: new Uint8Array(readFileSync(fontPath("SourceSans3-Semibold.ttf"))),
    };
  } catch {
    cachedBytes = null;
  }
  return cachedBytes;
}

export async function embedBrandFonts(doc: PDFDocument): Promise<{
  serif: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}> {
  const files = brandFontBytes();
  if (files) {
    try {
      doc.registerFontkit(fontkit);
      const [serif, sans, sansBold] = await Promise.all([
        doc.embedFont(files.serif),
        doc.embedFont(files.sans),
        doc.embedFont(files.sansBold),
      ]);
      return { serif, sans, sansBold };
    } catch {
      /* fall through to built-in fonts */
    }
  }
  const [sans, sansBold, serif] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.TimesRomanBold),
  ]);
  return { serif, sans, sansBold };
}
