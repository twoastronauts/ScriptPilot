import { useState } from 'react';
import { useWorkspace } from '@/store/workspace';
import { TextFormatControls, textStyleToReactStyle } from './TextFormatControls';
import type * as React from 'react';
import type { TextStyle } from '@/shared/types';

type TitleField = 'title' | 'byline' | 'author' | 'source' | 'contact' | 'draftDate';

const titleFields: Array<{ id: TitleField; label: string }> = [
  { id: 'title', label: 'Title' },
  { id: 'byline', label: 'Byline' },
  { id: 'author', label: 'Writer' },
  { id: 'source', label: 'Source' },
  { id: 'contact', label: 'Contact' },
  { id: 'draftDate', label: 'Draft Date' }
];

export function TitlePageEditor() {
  const { document, updateTitlePage, updateTitlePageStyle } = useWorkspace();
  const titlePage = document.titlePage;
  const activeRevision = document.revisions.find((revision) => revision.active);
  const [activeField, setActiveField] = useState<TitleField>('title');

  function commit(field: TitleField, value: string) {
    updateTitlePage({ [field]: value } as Partial<typeof titlePage>);
  }

  return (
    <section className="title-page-main" aria-label="Editable title page">
      <div className="title-page-tools">
        <select aria-label="Title page field" value={activeField} onChange={(event) => setActiveField(event.target.value as TitleField)}>
          {titleFields.map((field) => (
            <option key={field.id} value={field.id}>
              {field.label}
            </option>
          ))}
        </select>
        <TextFormatControls
          style={titlePage.styles?.[activeField]}
          onPatch={(patch) => updateTitlePageStyle(activeField, patch)}
          compact
          includeBackground
        />
      </div>
      <div className="title-page-sheet">
        <div className="title-page-sheet__center">
          <EditableBlock
            className="title-page-sheet__title"
            value={titlePage.title || document.title}
            placeholder="TITLE"
            active={activeField === 'title'}
            style={titlePage.styles?.title}
            onFocus={() => setActiveField('title')}
            onCommit={(value) => commit('title', value)}
          />
          <EditableBlock
            className="title-page-sheet__byline"
            value={titlePage.byline ?? 'Written by'}
            placeholder="Written by"
            active={activeField === 'byline'}
            style={titlePage.styles?.byline}
            onFocus={() => setActiveField('byline')}
            onCommit={(value) => commit('byline', value)}
          />
          <EditableBlock
            className="title-page-sheet__author"
            value={titlePage.author || document.author}
            placeholder="Writer Name"
            active={activeField === 'author'}
            style={titlePage.styles?.author}
            onFocus={() => setActiveField('author')}
            onCommit={(value) => commit('author', value)}
          />
          <EditableBlock
            className="title-page-sheet__source"
            value={titlePage.source ?? ''}
            placeholder="Based on, if applicable"
            active={activeField === 'source'}
            style={titlePage.styles?.source}
            onFocus={() => setActiveField('source')}
            onCommit={(value) => commit('source', value)}
          />
        </div>

        {activeRevision && (
          <div className="title-page-sheet__revision" style={{ '--revision-color': activeRevision.color } as React.CSSProperties}>
            {activeRevision.name} - {new Date(activeRevision.date).toLocaleDateString()}
          </div>
        )}

        <div className="title-page-sheet__footer">
          <EditableBlock
            className="title-page-sheet__contact"
            value={titlePage.contact ?? ''}
            placeholder="Contact / representation"
            active={activeField === 'contact'}
            style={titlePage.styles?.contact}
            onFocus={() => setActiveField('contact')}
            onCommit={(value) => commit('contact', value)}
          />
          <EditableBlock
            className="title-page-sheet__date"
            value={titlePage.draftDate ?? ''}
            placeholder="Draft date"
            active={activeField === 'draftDate'}
            style={titlePage.styles?.draftDate}
            onFocus={() => setActiveField('draftDate')}
            onCommit={(value) => commit('draftDate', value)}
          />
        </div>
      </div>
    </section>
  );
}

function EditableBlock({
  className,
  value,
  placeholder,
  active,
  style,
  onFocus,
  onCommit
}: {
  className: string;
  value: string;
  placeholder: string;
  active: boolean;
  style?: TextStyle;
  onFocus: () => void;
  onCommit: (value: string) => void;
}) {
  return (
    <div
      className={`${className}${active ? ' is-active-field' : ''}`}
      style={textStyleToReactStyle(style)}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder}
      data-placeholder={placeholder}
      onFocus={onFocus}
      onBlur={(event) => onCommit(event.currentTarget.textContent?.trim() ?? '')}
    >
      {value}
    </div>
  );
}
