import { WebContainer, type FileSystemTree, type DirectoryNode } from "@webcontainer/api";

let webcontainerInstancePromise: Promise<WebContainer> | null = null;

export function getWebContainer(): Promise<WebContainer> {
  if (typeof window === "undefined") {
    // Return a promise that never resolves during SSR
    return new Promise(() => {});
  }

  if (!webcontainerInstancePromise) {
    webcontainerInstancePromise = WebContainer.boot();
  }
  return webcontainerInstancePromise;
}

export async function ensureDirAndWriteFile(wc: WebContainer, path: string, content: string) {
  const parts = path.split("/");
  let currentPath = "";
  for (let i = 0; i < parts.length - 1; i++) {
    currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
    try {
      await wc.fs.mkdir(currentPath);
    } catch (e) {
      // Directory already exists or error creating it
    }
  }
  await wc.fs.writeFile(path, content);
}

export function buildFileSystemTree(files: Record<string, string>): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const [path, content] of Object.entries(files)) {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    const parts = cleanPath.split("/");
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = {
          file: {
            contents: content,
          },
        };
      } else {
        if (!current[part]) {
          current[part] = {
            directory: {},
          };
        }
        const nextNode = current[part];
        if ("directory" in nextNode) {
          current = nextNode.directory;
        } else {
          current[part] = { directory: {} };
          current = (current[part] as DirectoryNode).directory;
        }
      }
    }
  }
  return tree;
}
