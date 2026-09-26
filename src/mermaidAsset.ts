/**
 * Puts the diagram page on disk beside the bundled Mermaid script.
 *
 * The web view can read that directory. The script is copied out of the app
 * bundle once; each fence then writes its own page next to it.
 */

import {
  CachesDirectoryPath,
  MainBundlePath,
  copyFile,
  exists,
  mkdir,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';

const DIR_NAME = 'md-viewer-mermaid';
const SCRIPT = 'mermaid.min.js';

export type PublishedPage = {
  uri: string;
  /** Directory the web view may read, including the script. */
  readAccessUrl: string;
};

export async function publishMermaidPage(
  html: string,
  name: string,
): Promise<PublishedPage> {
  if (!CachesDirectoryPath || !MainBundlePath) {
    throw new Error('missing path');
  }

  const dir = `${CachesDirectoryPath}/${DIR_NAME}`;
  await mkdir(dir);
  const script = `${dir}/${SCRIPT}`;
  if (!(await exists(script))) {
    // macOS bundlePath is the .app; the script is in Contents/Resources.
    await copyFile(`${MainBundlePath}/Contents/Resources/${SCRIPT}`, script);
  }
  const page = `${dir}/${name}.html`;
  await writeFile(page, html, 'utf8');
  return {
    uri: fileUrl(page),
    readAccessUrl: fileUrl(`${dir}/`),
  };
}

export async function removeMermaidPage(uri: string): Promise<void> {
  await unlink(decodeURI(uri.replace(/^file:\/\//, '')));
}

function fileUrl(path: string): string {
  return `file://${encodeURI(path)}`;
}
