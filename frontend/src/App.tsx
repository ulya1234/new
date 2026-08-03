import React, { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Code,
  List,
  ListOrdered,
  Quote,
  FolderKanban,
  Table as TableIcon,
  Image as ImageIcon,
} from "lucide-react";

export default function App() {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRangeRef = useRef<Range | null>(null);

  const [activeTab, setActiveTab] = useState<"visual" | "markdown">("visual");
  const [markdownOutput, setMarkdownOutput] = useState<string>("");
  const [charCount, setCharCount] = useState<number>(0);
  const [blockCount, setBlockCount] = useState<number>(1);
  
  const [isTableModalOpen, setIsTableModalOpen] = useState<boolean>(false);
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(2);

  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [imgUrl, setImgUrl] = useState<string>("");
  const [imgAlt, setImgAlt] = useState<string>("");

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    ul: false,
    ol: false,
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
      tg.MainButton.setText("SEND ARTICLE");
      tg.MainButton.show();
      tg.MainButton.onClick(() => {
        if (!editorRef.current) return;
        const generatedMarkdown = compileHtmlToMarkdown(editorRef.current).trim();
        if (!generatedMarkdown) {
          tg.showAlert("Please enter some text before sending.");
          return;
        }
        tg.sendData(JSON.stringify({ markdown: generatedMarkdown }));
      });
    }
  }, []);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selectionRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (editorRef.current && selectionRangeRef.current) {
      editorRef.current.focus();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectionRangeRef.current);
    } else if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleEditorInteraction = () => {
    saveSelection();
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
    });

    if (editorRef.current) {
      const text = editorRef.current.innerText || "";
      setCharCount(text.length);
      const blocks =
        editorRef.current.querySelectorAll("h1, h2, h3, p, table, details, blockquote, li, img")
          .length || 1;
      setBlockCount(blocks);
    }
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    restoreSelection();
    document.execCommand(command, false, value);
    handleEditorInteraction();
  };

  const insertCodeBlock = () => {
    restoreSelection();
    const html = `<br><pre><code>// Write code here...</code></pre><br>`;
    document.execCommand("insertHTML", false, html);
    handleEditorInteraction();
  };

  const insertCollapsible = () => {
    restoreSelection();
    const detailsHtml = `<br><details open><summary><b>Collapsible Section</b></summary><p>Write content here...</p></details><br>`;
    document.execCommand("insertHTML", false, detailsHtml);
    handleEditorInteraction();
  };

  const insertTable = () => {
    restoreSelection();
    let tableHtml = "<table><thead><tr>";
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<th>Header ${c}</th>`;
    }
    tableHtml += "</tr></thead><tbody>";
    for (let r = 1; r <= rows; r++) {
      tableHtml += "<tr>";
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<td>Cell ${r}-${c}</td>`;
      }
      tableHtml += "</tr>";
    }
    tableHtml += "</tbody></table><br>";
    
    document.execCommand("insertHTML", false, tableHtml);
    setIsTableModalOpen(false);
    handleEditorInteraction();
  };

  const insertImage = () => {
    if (!imgUrl) return;
    restoreSelection();
    const html = `<br><img src="${imgUrl}" alt="${imgAlt || 'Image'}" style="max-width: 100%; border-radius: 8px;" /><br>`;
    document.execCommand("insertHTML", false, html);
    setIsImageModalOpen(false);
    setImgUrl("");
    setImgAlt("");
    handleEditorInteraction();
  };

  const compileHtmlToMarkdown = (node: Node): string => {
    let markdown = "";
    const children = node.childNodes;
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      
      if (child.nodeType === Node.TEXT_NODE) {
        markdown += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;
        const tag = element.nodeName.toLowerCase();
        
        if (tag === "b" || tag === "strong") {
          markdown += `**${compileHtmlToMarkdown(element)}**`;
        } else if (tag === "i" || tag === "em") {
          markdown += `*${compileHtmlToMarkdown(element)}*`;
        } else if (tag === "u") {
          markdown += `__${compileHtmlToMarkdown(element)}__`;
        } else if (tag === "s" || tag === "strike" || tag === "del") {
          markdown += `~~${compileHtmlToMarkdown(element)}~~`;
        } else if (tag === "code") {
          markdown += `\`${element.textContent}\``;
        } else if (tag === "pre") {
          const codeEl = element.querySelector("code");
          const codeText = codeEl ? codeEl.textContent : element.textContent;
          markdown += `\n\`\`\`\n${codeText}\n\`\`\`\n\n`;
        } else if (tag === "h1") {
          markdown += `\n# ${compileHtmlToMarkdown(element).trim()}\n\n`;
        } else if (tag === "h2") {
          markdown += `\n## ${compileHtmlToMarkdown(element).trim()}\n\n`;
        } else if (tag === "h3") {
          markdown += `\n### ${compileHtmlToMarkdown(element).trim()}\n\n`;
        } else if (tag === "blockquote") {
          const lines = compileHtmlToMarkdown(element).trim().split("\n");
          markdown += "\n" + lines.map((l) => `> ${l}`).join("\n") + "\n\n";
        } else if (tag === "ul" || tag === "ol") {
          const items = element.querySelectorAll("li");
          items.forEach((li, idx) => {
            const prefix = tag === "ol" ? `${idx + 1}. ` : "- ";
            markdown += `${prefix}${compileHtmlToMarkdown(li).trim()}\n`;
          });
          markdown += "\n";
        } else if (tag === "img") {
          const src = element.getAttribute("src") || "";
          const alt = element.getAttribute("alt") || "";
          markdown += `\n![${alt}](${src})\n\n`;
        } else if (tag === "table") {
          const trs = element.querySelectorAll("tr");
          trs.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll("th, td");
            let rowStr = "|";
            cells.forEach((cell) => {
              rowStr += ` ${compileHtmlToMarkdown(cell).trim()} |`;
            });
            markdown += rowStr + "\n";
            if (rowIndex === 0) {
              let divStr = "|";
              cells.forEach(() => {
                divStr += ":---|";
              });
              markdown += divStr + "\n";
            }
          });
          markdown += "\n";
        } else if (tag === "details") {
          const summary = element.querySelector("summary");
          const summaryText = summary
            ? compileHtmlToMarkdown(summary).trim()
            : "Details";
          const clone = element.cloneNode(true) as HTMLElement;
          const cloneSummary = clone.querySelector("summary");
          if (cloneSummary) cloneSummary.remove();
          const bodyText = compileHtmlToMarkdown(clone).trim();
          markdown += `\n<details open><summary>${summaryText}</summary>\n\n${bodyText}\n\n</details>\n\n`;
        } else if (tag === "br" || tag === "div" || tag === "p") {
          markdown += `${compileHtmlToMarkdown(element)}\n`;
        } else {
          markdown += compileHtmlToMarkdown(element);
        }
      }
    }
    return markdown;
  };

  const handleTabSwitch = (tab: "visual" | "markdown") => {
    setActiveTab(tab);
    if (tab === "markdown" && editorRef.current) {
      setMarkdownOutput(compileHtmlToMarkdown(editorRef.current).trim());
    }
  };

  return (
    <div className="app-container">
      <div className="header">
        <span className="brand-title">Document</span>
        <div className="tab-switcher">
          <button
            onClick={() => handleTabSwitch("visual")}
            className={`tab-btn ${activeTab === "visual" ? "active" : ""}`}
          >
            Editor
          </button>
          <button
            onClick={() => handleTabSwitch("markdown")}
            className={`tab-btn ${activeTab === "markdown" ? "active" : ""}`}
          >
            Markdown
          </button>
        </div>
      </div>

      {activeTab === "visual" && (
        <div className="toolbar">
          <div className="toolbar-group">
            <button
              onMouseDown={(e) => { e.preventDefault(); executeCommand("bold"); }}
              className={`tool-btn ${activeFormats.bold ? "active" : ""}`}
              title="Bold"
            >
              <Bold size={18} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); executeCommand("italic"); }}
              className={`tool-btn ${activeFormats.italic ? "active" : ""}`}
              title="Italic"
            >
              <Italic size={18} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); executeCommand("underline"); }}
              className={`tool-btn ${activeFormats.underline ? "active" : ""}`}
              title="Underline"
            >
              <Underline size={18} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); executeCommand("strikeThrough"); }}
              className={`tool-btn ${activeFormats.strikeThrough ? "active" : ""}`}
              title="Strikethrough"
            >
              <Strikethrough size={18} />
            </button>
            
            <div className="divider" />
            
            <button
              onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h1>"); }}
              className="tool-btn"
              title="Heading 1"
            >
              <Heading1 size={18} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<h2>"); }}
              className="tool-btn"
              title="Heading 2"
            >
              <Heading2 size={18} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); insertCodeBlock(); }}
              className="tool-btn"
              title="Code Block"
            >
              <Code size={18} />
            </button>

            <div className="divider" />

            <button
              onMouseDown={(e) => { e.preventDefault(); executeCommand("insertUnorderedList"); }}
              className={`tool-btn ${activeFormats.ul ? "active" : ""}`}
              title="Bullet List"
            >
              <List size={18} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); executeCommand("insertOrderedList"); }}
              className={`tool-btn ${activeFormats.ol ? "active" : ""}`}
              title="Numbered List"
            >
              <ListOrdered size={18} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); executeCommand("formatBlock", "<blockquote>"); }}
              className="tool-btn"
              title="Quote"
            >
              <Quote size={18} />
            </button>

            <div className="divider" />

            <button
              onMouseDown={(e) => { 
                e.preventDefault(); 
                saveSelection();
                setIsImageModalOpen(true); 
              }}
              className="tool-btn"
              title="Insert Image"
            >
              <ImageIcon size={18} />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); insertCollapsible(); }}
              className="tool-btn"
              title="Collapsible"
            >
              <FolderKanban size={18} />
            </button>
            <button
              onMouseDown={(e) => { 
                e.preventDefault(); 
                saveSelection();
                setIsTableModalOpen(true); 
              }}
              className="tool-btn"
              title="Table"
            >
              <TableIcon size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="editor-wrapper">
        <div
          ref={editorRef}
          contentEditable={activeTab === "visual"}
          onKeyUp={handleEditorInteraction}
          onMouseUp={handleEditorInteraction}
          onInput={handleEditorInteraction}
          onBlur={saveSelection}
          className="editor-surface"
          style={{ display: activeTab === "visual" ? "block" : "none" }}
          data-placeholder="Start writing your document here..."
        />
        {activeTab === "markdown" && (
          <pre className="markdown-preview">
            {markdownOutput || "No markdown generated yet."}
          </pre>
        )}
      </div>

      <div className="status-bar">
        <span>{charCount} characters</span>
        <span>{blockCount} {blockCount === 1 ? "block" : "blocks"}</span>
      </div>

      <div className={`modal-overlay ${isTableModalOpen ? "active" : ""}`}>
        <div className="modal-box">
          <h2>Insert Table</h2>
          <div className="modal-grid">
            <div className="input-group">
              <label>Rows</label>
              <input
                type="number"
                value={rows}
                min={1}
                max={15}
                onChange={(e) => setRows(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className="input-group">
              <label>Columns</label>
              <input
                type="number"
                value={cols}
                min={1}
                max={6}
                onChange={(e) => setCols(parseInt(e.target.value, 10) || 1)}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setIsTableModalOpen(false)}>Cancel</button>
            <button className="btn-submit" onClick={insertTable}>Insert</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${isImageModalOpen ? "active" : ""}`}>
        <div className="modal-box">
          <h2>Insert Image</h2>
          <div className="input-group full-width">
            <label>Image URL (HTTP/HTTPS)</label>
            <input
              type="text"
              placeholder="https://example.com/image.jpg"
              value={imgUrl}
              onChange={(e) => setImgUrl(e.target.value)}
            />
          </div>
          <div className="input-group full-width" style={{ marginTop: '12px' }}>
            <label>Caption / Alt Text (Optional)</label>
            <input
              type="text"
              placeholder="Beautiful scenery"
              value={imgAlt}
              onChange={(e) => setImgAlt(e.target.value)}
            />
          </div>
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button className="btn-cancel" onClick={() => setIsImageModalOpen(false)}>Cancel</button>
            <button className="btn-submit" onClick={insertImage}>Insert</button>
          </div>
        </div>
      </div>
    </div>
  );
}