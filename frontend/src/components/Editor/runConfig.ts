// Pure helpers for the "Run" (F5 / Play) feature. Kept free of React/Monaco
// imports so they can be unit-tested directly.

export interface RunConfig {
  command: string;
  displayName: string;
  cwd: string;
}

/**
 * Resolve a run/compile command for the active file, or null if the file type
 * is not runnable. `cwd` is the workspace-relative directory to run in.
 */
export function getRunConfig(activeTabPath: string, workspace: string): RunConfig | null {
  const parts = activeTabPath.split('/');
  const filename = parts[parts.length - 1];
  const fileDir = parts.slice(0, -1).join('/') || workspace;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const base = filename.substring(0, filename.lastIndexOf('.')) || filename;

  if (filename === 'package.json') {
    return { command: 'npm run dev', displayName: 'npm dev', cwd: fileDir };
  }

  const runners: Record<string, { command: string; displayName: string }> = {
    py:   { command: `python3 -u "${filename}"`,                       displayName: `Python: ${filename}` },
    js:   { command: `node "${filename}"`,                             displayName: `Node: ${filename}` },
    mjs:  { command: `node "${filename}"`,                             displayName: `Node: ${filename}` },
    cjs:  { command: `node "${filename}"`,                             displayName: `Node: ${filename}` },
    ts:   { command: `npx --yes tsx "${filename}"`,                    displayName: `tsx: ${filename}` },
    tsx:  { command: `npx --yes tsx "${filename}"`,                    displayName: `tsx: ${filename}` },
    cpp:  { command: `g++ -Wall -O2 -o "${base}" "${filename}" && "./${base}"`, displayName: `C++: ${filename}` },
    cxx:  { command: `g++ -Wall -O2 -o "${base}" "${filename}" && "./${base}"`, displayName: `C++: ${filename}` },
    cc:   { command: `g++ -Wall -O2 -o "${base}" "${filename}" && "./${base}"`, displayName: `C++: ${filename}` },
    c:    { command: `gcc -Wall -O2 -o "${base}" "${filename}" && "./${base}"`, displayName: `C: ${filename}` },
    go:   { command: `go run "${filename}"`,                           displayName: `Go: ${filename}` },
    rs:   { command: `rustc "${filename}" -o "${base}" && "./${base}"`, displayName: `Rust: ${filename}` },
    sh:   { command: `bash "${filename}"`,                             displayName: `Shell: ${filename}` },
    bash: { command: `bash "${filename}"`,                             displayName: `Shell: ${filename}` },
    rb:   { command: `ruby "${filename}"`,                             displayName: `Ruby: ${filename}` },
    php:  { command: `php "${filename}"`,                              displayName: `PHP: ${filename}` },
    java: { command: `java "${filename}"`,                             displayName: `Java: ${filename}` },
  };

  const runner = runners[ext];
  if (!runner) return null;
  return { ...runner, cwd: fileDir };
}

/**
 * Build the full shell command to send to the interactive terminal: a `cd`
 * into the file's directory (relative to the terminal's $WORKSPACE_DIR) followed
 * by the run command. Returns null for non-runnable files.
 */
export function buildRunCommand(
  activeTabPath: string,
  workspace: string,
): { command: string; displayName: string } | null {
  const config = getRunConfig(activeTabPath, workspace);
  if (!config) return null;

  let relDir: string;
  if (config.cwd === workspace) {
    relDir = '.';
  } else if (config.cwd.startsWith(workspace + '/')) {
    relDir = config.cwd.substring(workspace.length + 1);
  } else {
    relDir = config.cwd;
  }

  return {
    command: `cd "$WORKSPACE_DIR/${relDir}" && ${config.command}`,
    displayName: config.displayName,
  };
}
