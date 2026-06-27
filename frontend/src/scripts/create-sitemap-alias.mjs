import { constants } from "node:fs";
import { access, copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
const sitemapIndex = join(distDir, "sitemap-index.xml");
const firstSitemap = join(distDir, "sitemap-0.xml");
const sitemapAlias = join(distDir, "sitemap.xml");

try {
  await access(sitemapIndex, constants.R_OK);
  const sitemapIndexXml = await readFile(sitemapIndex, "utf8");
  const childSitemapCount = [...sitemapIndexXml.matchAll(/<loc>.*?<\/loc>/g)].length;

  if (childSitemapCount === 1) {
    await access(firstSitemap, constants.R_OK);
    await copyFile(firstSitemap, sitemapAlias);
    console.log("Created sitemap.xml alias for sitemap-0.xml");
  } else {
    await copyFile(sitemapIndex, sitemapAlias);
    console.log("Created sitemap.xml alias for sitemap-index.xml");
  }
} catch (error) {
  console.warn("Skipped sitemap.xml alias because generated sitemap files were not found.", error);
}
