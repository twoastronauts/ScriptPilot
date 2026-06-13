import { describe, expect, it } from 'vitest';
import { exportFdx, importFdx } from '@/shared/fdx';

const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="1" CustomAttr="keep-me">
  <UnknownTopLevel Foo="Bar">Secret</UnknownTopLevel>
  <TitlePage>
    <Content>
      <Paragraph Type="Title"><Text>Sample Script</Text></Paragraph>
      <Paragraph Type="Author"><Text>A Writer</Text></Paragraph>
    </Content>
  </TitlePage>
  <Content>
    <Paragraph Type="Scene Heading" CustomParagraph="yes"><Text>INT. ROOM - NIGHT</Text><PrivateData Value="preserve" /></Paragraph>
    <Paragraph Type="Action"><Text>A lamp flickers.</Text></Paragraph>
    <Paragraph Type="Character"><Text>MARA</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>We can keep the useful parts.</Text></Paragraph>
  </Content>
</FinalDraft>`;

describe('FDX adapter', () => {
  it('imports screenplay content and title metadata', () => {
    const document = importFdx(fixture, 'sample.fdx');

    expect(document.title).toBe('Sample Script');
    expect(document.author).toBe('A Writer');
    expect(document.elements[0].type).toBe('scene-heading');
    expect(document.elements[0].text).toBe('INT. ROOM - NIGHT');
    expect(document.characters[0].name).toBe('MARA');
  });

  it('exports edits while preserving unknown root and paragraph data', () => {
    const document = importFdx(fixture, 'sample.fdx');
    document.elements[0].text = 'EXT. ROOFTOP - DAWN';
    const xml = exportFdx(document);

    expect(xml).toContain('CustomAttr="keep-me"');
    expect(xml).toContain('<UnknownTopLevel Foo="Bar">Secret</UnknownTopLevel>');
    expect(xml).toContain('CustomParagraph="yes"');
    expect(xml).toContain('<PrivateData Value="preserve"/>');
    expect(xml).toContain('EXT. ROOFTOP - DAWN');
  });
});
