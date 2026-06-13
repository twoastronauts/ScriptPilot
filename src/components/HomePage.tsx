import { FileInput, FileJson, FolderOpen, Home, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';
import { computeWritingStats } from '@/shared/stats';
import { useWorkspace } from '@/store/workspace';
import type { RecentFile, ScriptDocument } from '@/shared/types';
import scriptPilotIcon from '@/assets/script-pilot-icon.png';

export function HomePage() {
  const { document, setDocument, setProjectPath, setFdxPath, setWorkspaceView, setWarning } = useWorkspace();
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [query, setQuery] = useState('');

  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return recentFiles;
    return recentFiles.filter((file) => `${file.title} ${file.path} ${file.type}`.toLowerCase().includes(normalizedQuery));
  }, [query, recentFiles]);

  const currentStats = useMemo(() => computeWritingStats(document), [document]);

  useEffect(() => {
    window.screenwriter?.listRecentFiles().then((result) => setRecentFiles(result.files)).catch(() => setRecentFiles([]));
  }, []);

  function openDocument(nextDocument: ScriptDocument, paths?: { projectPath?: string; fdxPath?: string }) {
    setDocument(nextDocument, paths);
    setWorkspaceView('editor');
  }

  async function newProject() {
    openDocument(createDocumentFromPlainText('Untitled Script Pilot Script', ''));
  }

  async function openProject() {
    const result = await window.screenwriter?.openProject();
    if (!result || result.canceled) return;
    openDocument(result.data, { projectPath: result.path });
  }

  async function openFdx() {
    const result = await window.screenwriter?.openFdx();
    if (!result || result.canceled) return;
    openDocument(result.data, { fdxPath: result.path });
  }

  async function openRecent(file: RecentFile) {
    const result = await window.screenwriter?.openRecentFile(file.path);
    if (!result || result.canceled) {
      setWarning(`Recent file unavailable: ${file.title}`);
      return;
    }

    if (file.type === 'fdx') {
      setFdxPath(result.path);
      openDocument(result.data, { fdxPath: result.path });
    } else {
      setProjectPath(result.path);
      openDocument(result.data, { projectPath: result.path });
    }
  }

  return (
    <main className="home-screen">
      <aside className="home-rail" aria-label="Home navigation">
        <div className="home-mark">
          <img src={scriptPilotIcon} alt="" />
        </div>
        <button className="is-active" title="Home">
          <Home size={18} />
        </button>
        <button title="New project" onClick={newProject}>
          <Plus size={18} />
        </button>
        <button title="Open project" onClick={openProject}>
          <FolderOpen size={18} />
        </button>
      </aside>

      <section className="home-main">
        <header className="home-topbar">
          <div className="home-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recent scripts" />
          </div>
          <div className="home-user">
            <span>Script Pilot</span>
            <small>Local-first studio</small>
          </div>
        </header>

        <section className="home-hero">
          <div className="home-hero__copy">
            <h1>Write the next scene.</h1>
            <p>{document.title || 'Untitled Script Pilot Script'} is ready with {currentStats.pages} page and {currentStats.words} words.</p>
            <div className="home-actions">
              <button onClick={newProject}>
                <FileJson size={17} />
                <span>New script</span>
              </button>
              <button onClick={openProject}>
                <FolderOpen size={17} />
                <span>Open project</span>
              </button>
              <button onClick={openFdx}>
                <FileInput size={17} />
                <span>Open FDX</span>
              </button>
            </div>
          </div>
          <div className="home-page-preview" aria-hidden="true">
            <div className="preview-line preview-line--heading" />
            <div className="preview-line" />
            <div className="preview-line preview-line--short" />
            <div className="preview-line preview-line--character" />
            <div className="preview-line preview-line--dialogue" />
            <div className="preview-line preview-line--dialogue short" />
          </div>
        </section>

        <section className="home-recents">
          <div className="home-section-title">
            <h2>Recent Files</h2>
            <span>{filteredFiles.length} shown</span>
          </div>
          <div className="recent-table">
            <div className="recent-row recent-row--head">
              <span>Title</span>
              <span>Type</span>
              <span>Last opened</span>
              <span>Metadata</span>
            </div>
            {filteredFiles.map((file) => (
              <button key={file.path} className="recent-row" onClick={() => openRecent(file)}>
                <span className="recent-title">
                  <i style={{ '--recent-color': file.color } as React.CSSProperties} />
                  <strong>{file.title}</strong>
                  <small>{file.path}</small>
                </span>
                <span className="recent-type">{file.type.toUpperCase()}</span>
                <span>{formatDate(file.lastOpenedAt)}</span>
                <span>
                  {file.metadata.pages}p / {file.metadata.scenes} scenes / {file.metadata.characters} chars
                </span>
              </button>
            ))}
            {!filteredFiles.length && (
              <div className="home-empty">
                <strong>No recent files yet</strong>
                <span>Open or save a project and it will appear here with dates, type, color, and script metadata.</span>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}
