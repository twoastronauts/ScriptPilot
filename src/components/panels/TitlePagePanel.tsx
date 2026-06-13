import { FileText } from 'lucide-react';
import { useWorkspace } from '@/store/workspace';

export function TitlePagePanel() {
  const { document, updateSettings, updateTitlePage } = useWorkspace();
  const titlePage = document.titlePage;

  return (
    <section className="panel title-page-panel">
      <div className="panel-title">
        <span>Title Page</span>
        <small>Industry layout</small>
      </div>

      <div className="title-page-preview" aria-label="Title page preview">
        <div className="title-page-preview__center">
          <strong>{titlePage.title || document.title}</strong>
          <span>{titlePage.byline ?? 'Written by'}</span>
          <em>{titlePage.author || document.author || 'Writer Name'}</em>
        </div>
        <div className="title-page-preview__footer">
          <span>{titlePage.contact || 'Contact / representation'}</span>
          <span>{titlePage.draftDate || 'Draft date'}</span>
        </div>
      </div>

      <div className="settings-list title-page-fields">
        <label>
          <span>Title</span>
          <input value={titlePage.title} onChange={(event) => updateTitlePage({ title: event.target.value })} />
        </label>
        <label>
          <span>Author</span>
          <input value={titlePage.author} onChange={(event) => updateTitlePage({ author: event.target.value })} />
        </label>
        <label>
          <span>Contact</span>
          <textarea value={titlePage.contact ?? ''} onChange={(event) => updateTitlePage({ contact: event.target.value })} />
        </label>
        <label>
          <span>Draft date</span>
          <input value={titlePage.draftDate ?? ''} onChange={(event) => updateTitlePage({ draftDate: event.target.value })} />
        </label>
        <label>
          <span>Source</span>
          <input value={titlePage.source ?? ''} onChange={(event) => updateTitlePage({ source: event.target.value })} />
        </label>
        <label>
          <span>Export title page</span>
          <input
            type="checkbox"
            checked={document.settings.exportIncludeTitlePage}
            onChange={(event) => updateSettings({ exportIncludeTitlePage: event.target.checked })}
          />
        </label>
      </div>

      <div className="title-page-note">
        <FileText size={14} />
        <span>PDF export uses this page before the script when enabled.</span>
      </div>
    </section>
  );
}
