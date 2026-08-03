import React, { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading,
  Code,
  Sigma,
  List,
  ListOrdered,
  Quote,
  FolderKanban,
  Table as TableIcon,
} from "lucide-react";

export default function App() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"visual" | "markdown">("visual");
  const [markdownOutput, setMarkdownOutput] = useState<string>("");
  const [charCount, setCharCount] = useState<number>(0);
  const [blockCount, setBlockCount] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(2);

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

  const checkActiveFormats = () => {
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
        editorRef.current.querySelectorAll("h1, h2, h3, p, table, details, blockquote, li")
          .length || 1;
      setBlockCount(blocks);
    }
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    checkActiveFormats();
  };

  const insertInlineCode = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const text = range.toString() || "code";
    const codeNode = document.createElement("code");
    codeNode.innerText = text;
    range.deleteContents();
    range.insertNode(codeNode);
    selection.collapseToEnd();
    checkActiveFormats();
  };

  const insertMath = () => {
    const mathText = prompt("Enter LaTeX math formula:", "E = mc^2");
    if (!mathText || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand("insertText", false, ` $${mathText}$ `);
    checkActiveFormats();
  };

  const insertCollapsible = () => {
    const detailsHtml = `<br><details open><summary><b>Collapsible Section</b></summary><p>Write content here...</p></details><br>`;
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand("insertHTML", false, detailsHtml);
    checkActiveFormats();
  };

  const insertTable = () => {
    if (!editorRef.current) return;
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

    editorRef.current.focus();
    document.execCommand("insertHTML", false, tableHtml);
    setIsModalOpen(false);
    checkActiveFormats();
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
        } else if (tag === "h1" || tag === "h2" || tag === "h3") {
          markdown += `\n## ${compileHtmlToMarkdown(element).trim()}\n\n`;
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
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 2px",
        }}
      >
        <span style={{ fontSize: "17px", fontWeight: 700 }}>Document</span>
        <div
          style={{
            display: "flex",
            background: "var(--doc-bg)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "2px",
          }}
        >
          <button
            onClick={() => handleTabSwitch("visual")}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "visual" ? "var(--bg)" : "transparent",
              color: activeTab === "visual" ? "var(--text)" : "var(--hint)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Editor
          </button>
          <button
            onClick={() => handleTabSwitch("markdown")}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "markdown" ? "var(--bg)" : "transparent",
              color: activeTab === "markdown" ? "var(--text)" : "var(--hint)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Markdown
          </button>
        </div>
      </div>

      {activeTab === "visual" && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "var(--doc-bg)",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            padding: "6px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
            overflowX: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "3px", width: "max-content" }}>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand("bold");
              }}
              style={getBtnStyle(activeFormats.bold)}
              title="Bold"
            >
              <Bold size={17} />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand("italic");
              }}
              style={getBtnStyle(activeFormats.italic)}
              title="Italic"
            >
              <Italic size={17} />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand("underline");
              }}
              style={getBtnStyle(activeFormats.underline)}
              title="Underline"
            >
              <Underline size={17} />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand("strikeThrough");
              }}
              style={getBtnStyle(activeFormats.strikeThrough)}
              title="Strikethrough"
            >
              <Strikethrough size={17} />
            </button>

            <div style={dividerStyle} />

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand("formatBlock", "<h2>");
              }}
              style={getBtnStyle(false)}
              title="Heading"
            >
              <Heading size={17} />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                insertInlineCode();
              }}
              style={getBtnStyle(false)}
              title="Code"
            >
              <Code size={17} />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                insertMath();
              }}
              style={getBtnStyle(false)}
              title="LaTeX"
            >
              <Sigma size={17} />
            </button>

            <div style={dividerStyle} />

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand("insertUnorderedList");
              }}
              style={getBtnStyle(activeFormats.ul)}
              title="Bullet List"
            >
              <List size={17} />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand("insertOrderedList");
              }}
              style={getBtnStyle(activeFormats.ol)}
              title="Numbered List"
            >
              <ListOrdered size={17} />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand("formatBlock", "<blockquote>");
              }}
              style={getBtnStyle(false)}
              title="Quote"
            >
              <Quote size={17} />
            </button>

            <div style={dividerStyle} />

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                insertCollapsible();
              }}
              style={getBtnStyle(false)}
              title="Collapsible"
            >
              <FolderKanban size={17} />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setIsModalOpen(true);
              }}
              style={getBtnStyle(false)}
              title="Table"
            >
              <TableIcon size={17} />
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: "var(--doc-bg)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)",
          minHeight: "420px",
          overflow: "hidden",
        }}
      >
        <div
          ref={editorRef}
          contentEditable={activeTab === "visual"}
          onKeyUp={checkActiveFormats}
          onMouseUp={checkActiveFormats}
          onInput={checkActiveFormats}
          className="editor-surface"
          style={{
            display: activeTab === "visual" ? "block" : "none",
          }}
          data-placeholder="Start typing your document here..."
        />
        {activeTab === "markdown" && (
          <pre
            style={{
              padding: "24px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "13px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              minHeight: "420px",
              background: "var(--doc-bg)",
            }}
          >
            {markdownOutput || "No markdown generated yet."}
          </pre>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 4px",
          fontSize: "12px",
          color: "var(--hint)",
        }}
      >
        <span>{charCount} characters</span>
        <span>
          {blockCount} {blockCount === 1 ? "block" : "blocks"}
        </span>
      </div>

      <div className={`modal-overlay ${isModalOpen ? "active" : ""}`}>
        <div className="modal-box">
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>Insert Table</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", color: "var(--hint)", fontWeight: 500 }}>
                Rows
              </label>
              <input
                type="number"
                value={rows}
                min={1}
                max={15}
                onChange={(e) => setRows(parseInt(e.target.value, 10) || 1)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--doc-bg)",
                  color: "var(--text)",
                  outline: "none",
                  fontSize: "14px",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", color: "var(--hint)", fontWeight: 500 }}>
                Columns
              </label>
              <input
                type="number"
                value={cols}
                min={1}
                max={6}
                onChange={(e) => setCols(parseInt(e.target.value, 10) || 1)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--doc-bg)",
                  color: "var(--text)",
                  outline: "none",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifySelf: "flex-end", gap: "8px" }}>
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "none",
                background: "var(--bg)",
                color: "var(--text)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={insertTable}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "none",
                background: "var(--btn)",
                color: "var(--btn-text)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Insert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const getBtnStyle = (isActive: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  border: "none",
  background: isActive ? "var(--active-bg)" : "transparent",
  color: isActive ? "var(--active-text)" : "var(--text)",
  cursor: "pointer",
  transition: "all 0.15s ease",
  transform: isActive ? "scale(0.96)" : "scale(1)",
});

const dividerStyle: React.CSSProperties = {
  width: "1px",
  height: "20px",
  background: "var(--border)",
  margin: "0 4px",
};