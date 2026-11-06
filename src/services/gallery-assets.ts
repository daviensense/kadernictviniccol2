const importedAssets = import.meta.glob<string>(
  "../../gallery/*.{webp,jpg,jpeg,png,gif,avif}",
  {
    eager: true,
    import: "default",
    query: "?url",
  },
);

const assets = new Map(
  Object.entries(importedAssets).map(([path, url]) => [
    path.split("/").pop()?.toLowerCase() ?? "",
    url,
  ]),
);

export function galleryAsset(fileName: string): string {
  if (
    !fileName ||
    fileName !== fileName.trim() ||
    fileName !== fileName.split(/[\\/]/).pop() ||
    !/\.(?:webp|jpe?g|png|gif|avif)$/i.test(fileName)
  ) {
    throw new Error("Manifest galerie obsahuje neplatný název fotografie.");
  }
  const url = assets.get(fileName.toLowerCase());
  if (!url) throw new Error(`Fotografie „${fileName}“ v galerii neexistuje.`);
  return url;
}

export function preferredGalleryAsset(
  fileName: string,
  allFiles: Set<string>,
): string {
  const webp = fileName.replace(/\.(?:jpe?g|png)$/i, ".webp");
  return allFiles.has(webp.toLowerCase()) ? webp : fileName;
}
