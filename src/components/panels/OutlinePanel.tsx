import { useWorkspace } from '@/store/workspace';

export function OutlinePanel() {
  const { document } = useWorkspace();
  const sceneHeadings = document.elements.filter((element) => element.type === 'scene-heading');

  return (
    <section className="panel">
      <div className="panel-title">
        <span>Outline Lanes</span>
        <small>{document.outlineLanes.length} lanes</small>
      </div>
      <div className="outline-lanes">
        {document.outlineLanes.map((lane) => (
          <div key={lane.id} className="outline-lane" style={{ borderLeftColor: lane.color }}>
            <strong>{lane.name}</strong>
            <small>{lane.elementTypes.join(', ')}</small>
            {lane.name === 'Script' && sceneHeadings.map((scene) => <span key={scene.id}>{scene.text}</span>)}
          </div>
        ))}
      </div>
      <div className="structure-list">
        <h3>Structure Lines</h3>
        {document.structureRanges.map((range) => (
          <div key={range.id} className="structure-row">
            <span style={{ background: range.color }} />
            <b>{range.label}</b>
            <small>{range.kind}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
