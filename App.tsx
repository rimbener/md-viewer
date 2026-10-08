/**
 * Markdown viewer: a folder tree of `.md` files on the left, the selected
 * document on the right.
 *
 * @format
 */

import { exists } from '@dr.pogodin/react-native-fs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ColorSchemeProvider } from './src/components/ColorSchemeProvider';
import { DocumentPanel } from './src/components/DocumentPanel';
import { Sidebar } from './src/components/Sidebar';
import {
  applyLoadedHistory,
  canGoBack,
  canGoNext,
  currentHistoryPath,
  emptyFileHistory,
  recordVisit,
  retargetHistory,
  stepBack,
  stepNext,
  type FileHistory,
} from './src/fileHistory';
import {
  askForFolder,
  bookmarkFolder,
  closeFolder,
  openFolder,
} from './src/folderAccess';
import { takeOpenedFile, watchOpenedFile } from './src/openedFile';
import {
  loadFileHistory,
  loadFolderBookmark,
  loadLastFile,
  loadLastFolder,
  loadSidebarVisible,
  moveFileHistory,
  saveFileHistory,
  saveFolderBookmark,
  saveLastFile,
  saveLastFolder,
  saveSidebarVisible,
} from './src/preferences';
import {
  countFiles,
  findFile,
  replaceDirectory,
  scanDirectory,
  scanToFile,
} from './src/scanDirectory';
import { useTheme } from './src/theme';
import type { DirectoryNode, FileNode } from './src/types';

function Viewer() {
  const theme = useTheme();

  const [root, setRoot] = useState<DirectoryNode | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Same folder, new walk: the tree is otherwise only rebuilt when the path changes.
  const [scanNonce, setScanNonce] = useState(0);
  // Until the stored session has been read there is nothing to show but a
  // folder dialog that may turn out to be unnecessary.
  const [isRestoring, setIsRestoring] = useState(true);
  /** A stored file path waiting for the scan that can resolve it to a node. */
  const pendingFilePath = useRef<string | null>(null);
  // The tree shows by default; hiding it is how you get a full-width read.
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const hasChosenSidebar = useRef(false);
  const [history, setHistory] = useState(emptyFileHistory());
  const [historyFolder, setHistoryFolder] = useState<string | null>(null);
  const historyRef = useRef(history);
  const revealTicket = useRef(0);
  const rootPathRef = useRef(rootPath);
  rootPathRef.current = rootPath;
  /** Set while Finder's file is on screen, so a folder restore cannot replace it. */
  const externalFile = useRef<string | null>(null);

  if (rootPath !== historyFolder) {
    setHistoryFolder(rootPath);
    setHistory(emptyFileHistory());
    historyRef.current = emptyFileHistory();
  }

  // The write stays out of the state updater, which React may call twice.
  const toggleSidebar = useCallback(() => {
    hasChosenSidebar.current = true;
    const next = !isSidebarVisible;
    setIsSidebarVisible(next);
    saveSidebarVisible(next);
  }, [isSidebarVisible]);

  useEffect(() => {
    let cancelled = false;
    loadSidebarVisible().then(stored => {
      // Someone who toggled while the read was in flight outranks the store.
      if (!cancelled && stored !== null && !hasChosenSidebar.current) {
        setIsSidebarVisible(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseFolder = useCallback(async () => {
    try {
      const directory = await askForFolder();
      if (directory === null) {
        return; // The user cancelled the dialog.
      }
      const currentRoot = rootPathRef.current;
      const resume = currentHistoryPath(
        directory === currentRoot
          ? historyRef.current
          : await loadFileHistory(directory),
      );
      pendingFilePath.current = resume;
      setSelectedFile(null);
      saveLastFile(resume);
      // The panel's grant is live now, which is the only moment a bookmark for
      // it can be made.
      closeFolder();
      saveFolderBookmark(await bookmarkFolder(directory));
      externalFile.current = null;
      setRootPath(directory);
      saveLastFolder(directory);
      setScanNonce(previous => previous + 1);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not open that folder.',
      );
    }
  }, []);

  const remember = useCallback(
    (next: FileHistory) => {
      if (next === historyRef.current) {
        return false;
      }
      historyRef.current = next;
      setHistory(next);
      if (rootPath !== null) {
        saveFileHistory(rootPath, next);
      }
      return true;
    },
    [rootPath],
  );

  const reveal = useCallback(
    (path: string) => {
      saveLastFile(path);
      const found = root === null ? null : findFile(root, path);
      if (found !== null) {
        setSelectedFile(found);
        return;
      }
      if (rootPath === null) {
        return;
      }
      const ticket = (revealTicket.current += 1);
      scanToFile(rootPath, path)
        .then(tree => {
          if (ticket !== revealTicket.current) {
            return;
          }
          setRoot(tree);
          setSelectedFile(findFile(tree, path));
        })
        .catch(() => {});
    },
    [root, rootPath],
  );

  const selectFile = useCallback(
    (file: FileNode) => {
      setSelectedFile(file);
      if (rootPath === null) {
        return;
      }
      saveLastFile(file.path);
      remember(recordVisit(historyRef.current, file.path));
    },
    [remember, rootPath],
  );

  const showOpenedFile = useCallback((path: string) => {
    if (externalFile.current === path) {
      return;
    }
    externalFile.current = path;
    pendingFilePath.current = null;
    closeFolder();
    const opened = treeForOpenedFile(path);
    setError(null);
    setIsScanning(false);
    setIsRestoring(false);
    setRootPath(null);
    setRoot(opened.root);
    setSelectedFile(opened.file);
  }, []);

  const goBack = useCallback(() => {
    const next = stepBack(historyRef.current);
    if (!remember(next)) {
      return;
    }
    const path = currentHistoryPath(next);
    if (path !== null) {
      reveal(path);
    }
  }, [remember, reveal]);

  const goNext = useCallback(() => {
    const next = stepNext(historyRef.current);
    if (!remember(next)) {
      return;
    }
    const path = currentHistoryPath(next);
    if (path !== null) {
      reveal(path);
    }
  }, [remember, reveal]);

  const reloadFolder = useCallback(() => {
    setScanNonce(previous => previous + 1);
  }, []);

  const selectDirectory = useCallback((directory: DirectoryNode) => {
    if (rootPathRef.current === null) {
      return;
    }
    scanDirectory(directory.path)
      .then(branch => {
        setRoot(current =>
          current === null ? current : replaceDirectory(current, branch),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSelectedFile(current => {
      if (current === null || root === null) {
        return current;
      }
      return findFile(root, current.path) === null ? null : current;
    });
  }, [root]);

  useEffect(() => {
    if (rootPath === null) {
      return;
    }
    let cancelled = false;
    const openedAt = pendingFilePath.current;
    loadFileHistory(rootPath).then(stored => {
      if (cancelled) {
        return;
      }
      const next = applyLoadedHistory(stored, historyRef.current, openedAt);
      if (next !== historyRef.current) {
        historyRef.current = next;
        setHistory(next);
      }
      if (next !== stored) {
        saveFileHistory(rootPath, next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  useEffect(() => {
    if (rootPath === null) {
      return;
    }

    let cancelled = false;
    setIsScanning(true);
    setError(null);

    const target = pendingFilePath.current;
    const walk =
      target === null ? scanDirectory(rootPath) : scanToFile(rootPath, target);

    walk
      .then(tree => {
        if (cancelled || externalFile.current !== null) {
          return;
        }
        setRoot(tree);

        // A restored file only becomes selectable once the tree holding it
        // exists, and it may have been deleted in the meantime.
        pendingFilePath.current = null;
        if (target !== null) {
          const restored = findFile(tree, target);
          if (restored !== null) {
            setSelectedFile(restored);
          }
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled && externalFile.current === null) {
          setRoot(null);
          setError(
            cause instanceof Error ? cause.message : 'Could not read folder.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsScanning(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rootPath, scanNonce]);

  const fileCount = useMemo(() => (root ? countFiles(root) : 0), [root]);

  // A file from Finder wins over the stored folder. With neither, ask for one.
  useEffect(() => {
    let cancelled = false;
    const stopWatch = watchOpenedFile(path => {
      if (!cancelled) {
        showOpenedFile(path);
      }
    });

    (async () => {
      const opened = await takeOpenedFile();
      if (cancelled || externalFile.current !== null) {
        return;
      }
      if (opened !== null) {
        showOpenedFile(opened);
        return;
      }

      const folder = await restoreFolder();
      const isUsable = folder !== null && (await folderExists(folder));
      if (cancelled || externalFile.current !== null) {
        return;
      }

      if (folder !== null && isUsable) {
        pendingFilePath.current = await loadLastFile();
        if (cancelled) {
          return;
        }
        if (externalFile.current !== null) {
          pendingFilePath.current = null;
          return;
        }
        setRootPath(folder);
        setIsRestoring(false);
        return;
      }

      setIsRestoring(false);
      chooseFolder();
    })();

    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [chooseFolder, showOpenedFile]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isSidebarVisible ? (
        <Sidebar
          root={root}
          selectedPath={selectedFile?.path ?? null}
          isScanning={isScanning || isRestoring}
          error={error}
          fileCount={fileCount}
          onChooseFolder={chooseFolder}
          onReloadFolder={reloadFolder}
          onSelectFile={selectFile}
          onSelectDirectory={selectDirectory}
        />
      ) : null}
      <DocumentPanel
        file={selectedFile}
        isSidebarVisible={isSidebarVisible}
        onToggleSidebar={toggleSidebar}
        canGoBack={canGoBack(history)}
        canGoNext={canGoNext(history)}
        onBack={goBack}
        onNext={goNext}
      />
    </View>
  );
}

/**
 * The folder of the last session, with its access restored. The bookmark is
 * the authority on where the folder is, because it follows a folder that moved;
 * the stored path is the fallback for a build that never made one.
 */
async function restoreFolder(): Promise<string | null> {
  const stored = await loadLastFolder();
  const bookmark = await loadFolderBookmark();
  if (bookmark === null) {
    return stored;
  }

  const opened = await openFolder(bookmark);
  if (opened === null) {
    return stored;
  }
  if (stored !== null && opened.path !== stored) {
    saveLastFolder(opened.path);
    const last = await loadLastFile();
    if (last !== null && last.startsWith(`${stored}/`)) {
      saveLastFile(`${opened.path}${last.slice(stored.length)}`);
    }
    const moved = retargetHistory(
      await loadFileHistory(stored),
      stored,
      opened.path,
    );
    if (moved.paths.length > 0) {
      moveFileHistory(stored, opened.path, moved);
    }
  }
  if (opened.isStale) {
    bookmarkFolder(opened.path).then(saveFolderBookmark);
  }
  return opened.path;
}

/** One file, under its parent folder name. The parent is not read. */
function treeForOpenedFile(path: string): {
  root: DirectoryNode;
  file: FileNode;
} {
  const slash = path.lastIndexOf('/');
  const name = slash < 0 ? path : path.slice(slash + 1);
  const directoryPath = slash <= 0 ? '/' : path.slice(0, slash);
  const directorySlash = directoryPath.lastIndexOf('/');
  const directoryTail =
    directorySlash < 0
      ? directoryPath
      : directoryPath.slice(directorySlash + 1);
  const file: FileNode = { kind: 'file', name, path };
  return {
    file,
    root: {
      kind: 'directory',
      name: directoryTail.length > 0 ? directoryTail : directoryPath,
      path: directoryPath,
      children: [file],
    },
  };
}

/** A folder that has been moved or deleted since last launch is not usable. */
async function folderExists(path: string): Promise<boolean> {
  try {
    return await exists(path);
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
});

function App() {
  return (
    <ColorSchemeProvider>
      <Viewer />
    </ColorSchemeProvider>
  );
}

export default App;
